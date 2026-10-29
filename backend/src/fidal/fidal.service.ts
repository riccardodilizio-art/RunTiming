import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { WiseClient } from './wise.client';
import { extractAtleti, mapAtleta, type FidalAthleteDto } from './fidal.mapper';
import { FidalDumpRow, parseFidalDump } from './fidal.dump';
import { parseAthletesCsv, parseSocietiesCsv } from './fidal.csv';
import { csvFiles } from './zip';
import type { FidalAthlete } from '@prisma/client';

// Servizio FIDAL: interroga WISE (proxy), normalizza i dati e li mette in cache
// su Postgres (tabella FidalAthlete). SCADENZA CERTIFICATO e NOME DELLA SOCIETÀ —
// che WISE non restituisce — arrivano dai file del portale tesseramento caricati
// dall'admin (importDump / importSocieties) e vengono uniti alla risposta.

@Injectable()
export class FidalService {
    private readonly logger = new Logger(FidalService.name);
    private readonly atletaPath: string;
    private readonly atletaParam: string;
    private readonly searchPath: string;
    private readonly societyPath: string;

    constructor(
        private readonly wise: WiseClient,
        private readonly prisma: PrismaService,
        config: ConfigService,
    ) {
        this.atletaPath  = config.get('WISE_ATLETA_PATH')  ?? '/Iscrizioni/Iscritti/OngGetAtletaFidalByTessera';
        this.atletaParam = config.get('WISE_ATLETA_PARAM') ?? 'tessera';
        this.searchPath  = config.get('WISE_SEARCH_PATH')  ?? '/Iscrizioni/Iscritti/OngGetAtletaFidalByParametri';
        this.societyPath = config.get('WISE_SOCIETY_PATH') ?? '/Iscrizioni/Iscritti/OngGetAtletiSocieta';
    }

    /** Risposte recenti (10 minuti): meno chiamate al gestionale FIDAL a parità di tessera. */
    private readonly recent = new Map<string, { at: number; atleta: FidalAthleteDto | null }>();

    /**
     * Verifica tesseramento per numero tessera: prima WISE (dato in tempo reale),
     * se WISE non risponde o non è configurato il database dei tesserati
     * caricato dall'admin (file del portale tesseramento). In entrambi i casi
     * nome della società e scadenza del certificato vengono dai file caricati.
     */
    async verifyByTessera(tessera: string): Promise<{ tessera: string; tesserato: boolean; atleta: FidalAthleteDto | null }> {
        const key = tessera.trim().toUpperCase();
        const hit = this.recent.get(key);
        if (hit && Date.now() - hit.at < 10 * 60_000) return { tessera: key, tesserato: !!hit.atleta, atleta: hit.atleta && { ...hit.atleta } };
        let dto: FidalAthleteDto | null;
        try {
            const raw = await this.wise.getJson<unknown>(this.atletaPath, { [this.atletaParam]: tessera });
            dto = extractAtleti(raw).map(mapAtleta).find(a => a.tessera) ?? null;
            if (dto) {
                await this.enrich([dto]);
                await this.cache(dto);
            }
        } catch (e) {
            const row = await this.prisma.fidalAthlete.findUnique({ where: { tessera: key } });
            if (!row) throw e; // né WISE né il database: verifica non disponibile
            dto = this.rowToDto(row);
            await this.enrich([dto]);
        }
        // Cache piena: si toglie la voce più vecchia (non si svuota tutto)
        if (this.recent.size >= 5000) this.recent.delete(this.recent.keys().next().value as string);
        this.recent.delete(key);
        this.recent.set(key, { at: Date.now(), atleta: dto && { ...dto } });
        return { tessera: key, tesserato: !!dto, atleta: dto };
    }

    /** Ricerca atleti per cognome/nome/categoria/società (0 = qualsiasi). */
    async searchByParams(cognome: string, nome = '', categoria = 0, societa = 0): Promise<FidalAthleteDto[]> {
        const raw = await this.wise.getJson<unknown>(this.searchPath, { cognome, nome, categoria, societa });
        const list = extractAtleti(raw).map(mapAtleta).filter(a => a.tessera);
        await this.enrich(list);
        await this.cacheMany(list);
        return list;
    }

    /**
     * Elenco atleti di una società (per codice società FIDAL). Fonte primaria:
     * il dump importato in Postgres (completo). Solo se vuoto tenta WISE.
     */
    async listBySociety(codiceSocieta: string): Promise<FidalAthleteDto[]> {
        const code = codiceSocieta.trim().toUpperCase();
        const rows = await this.prisma.fidalAthlete.findMany({
            where: { codiceSocieta: code },
            orderBy: [{ cognome: 'asc' }, { nome: 'asc' }],
        });
        if (rows.length > 0) {
            const list = rows.map(r => this.rowToDto(r));
            await this.enrich(list); // denominazione società reale
            return list;
        }
        // Fallback: WISE (endpoint non ancora confermato).
        try {
            const raw = await this.wise.getJson<unknown>(this.societyPath, { societa: code });
            const list = extractAtleti(raw).map(mapAtleta).filter(a => a.tessera);
            await this.enrich(list);
            await this.cacheMany(list);
            return list;
        } catch {
            return [];
        }
    }

    /** Converte una riga Postgres FidalAthlete nel DTO. */
    private rowToDto(r: FidalAthlete): FidalAthleteDto {
        return {
            tessera: r.tessera,
            tipo: r.tipo,
            nome: r.nome,
            cognome: r.cognome,
            dataNascita: r.dataNascita ? r.dataNascita.toISOString().slice(0, 10) : null,
            sesso: r.sesso,
            categoria: '',
            codiceSocieta: r.codiceSocieta,
            societa: r.societa,
            certScadenza: r.certScadenza ? r.certScadenza.toISOString().slice(0, 10) : null,
        };
    }

    /**
     * Importa i file atleti scaricati dal portale FIDAL (CSV, anche dentro gli zip,
     * più file insieme: l'export arriva diviso in parti) oppure il vecchio .xlsx.
     * Sostituisce COMPLETAMENTE la tabella FidalAthlete, in un'unica transazione:
     * se qualcosa va storto resta il database di prima.
     */
    async importDump(files: { buffer: Buffer; name: string }[]): Promise<{ count: number; certificati: number; files: number }> {
        const byTessera = new Map<string, FidalDumpRow>();
        let parts = 0;
        for (const f of files) {
            if (/\.xlsx?$/i.test(f.name)) {
                for (const r of parseFidalDump(f.buffer)) byTessera.set(r.tessera, r);
                parts++;
                continue;
            }
            for (const csv of csvFiles(f.buffer, f.name)) {
                const parsed = parseAthletesCsv(csv.data);
                if (!parsed.withCert) {
                    throw new BadRequestException(
                        `${csv.name}: questo file non contiene la scadenza del certificato. ` +
                        'Dal portale tesseramento, sezione Download, scarica "Atleti con data scadenza certificato Medico".',
                    );
                }
                for (const r of parsed.rows) byTessera.set(r.tessera, r);
                parts++;
            }
        }
        const rows = [...byTessera.values()];
        if (rows.length === 0) throw new BadRequestException('Nessun atleta trovato nei file');
        await this.prisma.$transaction(async tx => {
            await tx.fidalAthlete.deleteMany({});
            for (let i = 0; i < rows.length; i += 5000) {
                await tx.fidalAthlete.createMany({ data: rows.slice(i, i + 5000), skipDuplicates: true });
            }
        }, { timeout: 300_000, maxWait: 10_000 });
        this.recent.clear();
        const certificati = rows.filter(r => r.certScadenza).length;
        this.logger.log(`Import tesserati FIDAL: ${rows.length} (con certificato: ${certificati}) da ${parts} file`);
        return { count: rows.length, certificati, files: parts };
    }

    /** Importa l'anagrafica società (.csv o zip) sostituendo la tabella FidalSociety. */
    async importSocieties(buffer: Buffer, filename = ''): Promise<{ count: number }> {
        const byCode = new Map<string, ReturnType<typeof parseSocietiesCsv>[number]>();
        for (const csv of csvFiles(buffer, filename)) for (const r of parseSocietiesCsv(csv.data)) byCode.set(r.codice, r);
        const rows = [...byCode.values()];
        if (rows.length === 0) throw new BadRequestException('Nessuna società trovata nel file');
        await this.prisma.$transaction(async tx => {
            await tx.fidalSociety.deleteMany({});
            for (let i = 0; i < rows.length; i += 2000) {
                await tx.fidalSociety.createMany({ data: rows.slice(i, i + 2000), skipDuplicates: true });
            }
        }, { timeout: 120_000 });
        this.recent.clear();
        this.logger.log(`Import società FIDAL: ${rows.length}`);
        return { count: rows.length };
    }

    // ─── Cache / arricchimento ────────────────────────────────────────────────

    /**
     * Arricchisce i DTO con la scadenza certificato (dal dump atleti) e con la
     * denominazione reale della società (dall'anagrafica società), per codice.
     */
    private async enrich(list: FidalAthleteDto[]): Promise<void> {
        if (list.length === 0) return;
        const [athletes, societies] = await Promise.all([
            this.prisma.fidalAthlete.findMany({
                where: { tessera: { in: list.map(a => a.tessera) } },
                select: { tessera: true, certScadenza: true },
            }),
            this.prisma.fidalSociety.findMany({
                where: { codice: { in: [...new Set(list.map(a => a.codiceSocieta).filter(Boolean))] } },
                select: { codice: true, denominazione: true },
            }),
        ]);
        const scadByTessera = new Map(athletes.map(r => [r.tessera, r.certScadenza]));
        const nameByCode = new Map(societies.map(s => [s.codice, s.denominazione]));
        for (const dto of list) {
            const scad = scadByTessera.get(dto.tessera);
            if (scad) dto.certScadenza = scad.toISOString().slice(0, 10);
            const name = nameByCode.get(dto.codiceSocieta.toUpperCase());
            if (name) dto.societa = name;
            else if (!dto.societa) dto.societa = dto.codiceSocieta;
        }
    }

    private async cache(dto: FidalAthleteDto): Promise<void> {
        const base = {
            tipo: dto.tipo,
            nome: dto.nome,
            cognome: dto.cognome,
            dataNascita: dto.dataNascita && /^\d{4}-\d{2}-\d{2}/.test(dto.dataNascita) ? new Date(`${dto.dataNascita.slice(0, 10)}T00:00:00Z`) : null,
            sesso: dto.sesso,
            societa: dto.societa,
            codiceSocieta: dto.codiceSocieta,
        };
        // Non azzerare la scadenza esistente (dal dump) se WISE non la fornisce.
        const certScadenza = dto.certScadenza ? new Date(dto.certScadenza) : undefined;
        try {
            await this.prisma.fidalAthlete.upsert({
                where: { tessera: dto.tessera },
                create: { tessera: dto.tessera, ...base, certScadenza: certScadenza ?? null },
                update: { ...base, ...(certScadenza !== undefined ? { certScadenza } : {}) },
            });
        } catch (e) {
            this.logger.warn(`cache FIDAL fallita per ${dto.tessera}: ${e instanceof Error ? e.message : e}`);
        }
    }

    private async cacheMany(list: FidalAthleteDto[]): Promise<void> {
        await Promise.all(list.map(dto => this.cache(dto)));
    }
}
