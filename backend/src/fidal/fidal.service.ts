import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { WiseClient } from './wise.client';
import { extractAtleti, mapAtleta, type FidalAthleteDto } from './fidal.mapper';
import { parseFidalDump } from './fidal.dump';
import { parseAthletesCsv, parseSocietiesCsv } from './fidal.csv';

// Servizio FIDAL: interroga WISE (proxy), normalizza i dati e li mette in cache
// su Postgres (tabella FidalAthlete). La SCADENZA CERTIFICATO — che WISE non
// restituisce — arriva dal dump .xlsx importato (importDump) e viene unita alla
// risposta, così la validità rispetto alla data evento è verificabile ovunque.

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

    /** Verifica tesseramento per numero tessera. */
    async verifyByTessera(tessera: string): Promise<{ tessera: string; tesserato: boolean; atleta: FidalAthleteDto | null }> {
        const raw = await this.wise.getJson<unknown>(this.atletaPath, { [this.atletaParam]: tessera });
        const dto = extractAtleti(raw).map(mapAtleta).find(a => a.tessera) ?? null;
        if (dto) {
            await this.enrich([dto]);
            await this.cache(dto);
        }
        return { tessera: tessera.toUpperCase(), tesserato: !!dto, atleta: dto };
    }

    /** Ricerca atleti per cognome/nome/categoria/società (0 = qualsiasi). */
    async searchByParams(cognome: string, nome = '', categoria = 0, societa = 0): Promise<FidalAthleteDto[]> {
        const raw = await this.wise.getJson<unknown>(this.searchPath, { cognome, nome, categoria, societa });
        const list = extractAtleti(raw).map(mapAtleta).filter(a => a.tessera);
        await this.enrich(list);
        await this.cacheMany(list);
        return list;
    }

    /** Elenco atleti di una società (per codice società FIDAL). */
    async listBySociety(codiceSocieta: string): Promise<FidalAthleteDto[]> {
        const raw = await this.wise.getJson<unknown>(this.societyPath, { societa: codiceSocieta });
        const list = extractAtleti(raw).map(mapAtleta).filter(a => a.tessera);
        await this.enrich(list);
        await this.cacheMany(list);
        return list;
    }

    /**
     * Importa il dump tesseramenti FIDAL (.csv o .xlsx) sostituendo
     * COMPLETAMENTE la tabella FidalAthlete. È l'unica fonte della scadenza
     * certificato (e, nel CSV, della data di nascita completa).
     */
    async importDump(buffer: Buffer, filename = ''): Promise<{ count: number }> {
        const rows = filename.toLowerCase().endsWith('.csv')
            ? parseAthletesCsv(buffer)
            : parseFidalDump(buffer);
        if (rows.length === 0) return { count: 0 };
        await this.prisma.fidalAthlete.deleteMany({});
        const BATCH = 5000;
        for (let i = 0; i < rows.length; i += BATCH) {
            await this.prisma.fidalAthlete.createMany({ data: rows.slice(i, i + BATCH), skipDuplicates: true });
        }
        this.logger.log(`Import dump FIDAL atleti: ${rows.length}`);
        return { count: rows.length };
    }

    /** Importa l'anagrafica società (.csv) sostituendo la tabella FidalSociety. */
    async importSocieties(buffer: Buffer): Promise<{ count: number }> {
        const rows = parseSocietiesCsv(buffer);
        if (rows.length === 0) return { count: 0 };
        await this.prisma.fidalSociety.deleteMany({});
        const BATCH = 2000;
        for (let i = 0; i < rows.length; i += BATCH) {
            await this.prisma.fidalSociety.createMany({ data: rows.slice(i, i + BATCH), skipDuplicates: true });
        }
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
        }
    }

    private async cache(dto: FidalAthleteDto): Promise<void> {
        const base = {
            tipo: dto.tipo,
            nome: dto.nome,
            cognome: dto.cognome,
            dataNascita: dto.dataNascita ? new Date(dto.dataNascita) : null,
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
