import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { WiseClient } from './wise.client';
import { extractAtleti, mapAtleta, type FidalAthleteDto } from './fidal.mapper';

// Servizio FIDAL: interroga WISE (proxy), normalizza i dati e li mette in cache
// su Postgres (tabella FidalAthlete), così le ricerche successive sono locali e
// non dipendono dalla disponibilità/latenza del portale.
//
// I percorsi degli endpoint sono configurabili via env perché WISE non è
// documentato: i default riflettono ciò che abbiamo osservato dal traffico.

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
        this.atletaPath  = config.get('WISE_ATLETA_PATH')  ?? '/Iscrizioni/Iscritti/OnGetAtleta';
        this.atletaParam = config.get('WISE_ATLETA_PARAM') ?? 'ntessera';
        this.searchPath  = config.get('WISE_SEARCH_PATH')  ?? '/Iscrizioni/Iscritti/OngGetAtletaFidalByParametri';
        this.societyPath = config.get('WISE_SOCIETY_PATH') ?? '/Iscrizioni/Iscritti/OngGetAtletiSocieta';
    }

    /** Verifica tesseramento per numero tessera. */
    async verifyByTessera(tessera: string): Promise<{ tessera: string; tesserato: boolean; atleta: FidalAthleteDto | null }> {
        const raw = await this.wise.getJson<unknown>(this.atletaPath, { [this.atletaParam]: tessera });
        const dto = extractAtleti(raw).map(mapAtleta).find(a => a.tessera) ?? null;
        if (dto) await this.cache(dto);
        return { tessera: tessera.toUpperCase(), tesserato: !!dto, atleta: dto };
    }

    /** Ricerca atleti per cognome/nome/categoria/società (0 = qualsiasi). */
    async searchByParams(cognome: string, nome = '', categoria = 0, societa = 0): Promise<FidalAthleteDto[]> {
        const raw = await this.wise.getJson<unknown>(this.searchPath, { cognome, nome, categoria, societa });
        const list = extractAtleti(raw).map(mapAtleta).filter(a => a.tessera);
        await this.cacheMany(list);
        return list;
    }

    /** Elenco atleti di una società (per codice società FIDAL). */
    async listBySociety(codiceSocieta: string): Promise<FidalAthleteDto[]> {
        const raw = await this.wise.getJson<unknown>(this.societyPath, { societa: codiceSocieta });
        const list = extractAtleti(raw).map(mapAtleta).filter(a => a.tessera);
        await this.cacheMany(list);
        return list;
    }

    // ─── Cache su Postgres ────────────────────────────────────────────────────

    private toRow(dto: FidalAthleteDto) {
        return {
            tessera: dto.tessera,
            tipo: dto.tipo,
            nome: dto.nome,
            cognome: dto.cognome,
            dataNascita: dto.dataNascita ? new Date(dto.dataNascita) : null,
            sesso: dto.sesso,
            societa: dto.societa,
            codiceSocieta: dto.codiceSocieta,
        };
    }

    private async cache(dto: FidalAthleteDto): Promise<void> {
        const row = this.toRow(dto);
        try {
            await this.prisma.fidalAthlete.upsert({
                where: { tessera: row.tessera },
                create: row,
                update: row,
            });
        } catch (e) {
            this.logger.warn(`cache FIDAL fallita per ${row.tessera}: ${e instanceof Error ? e.message : e}`);
        }
    }

    private async cacheMany(list: FidalAthleteDto[]): Promise<void> {
        await Promise.all(list.map(dto => this.cache(dto)));
    }
}
