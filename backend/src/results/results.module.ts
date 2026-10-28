import {
    BadRequestException,
    Body,
    ConflictException,
    Controller,
    Get,
    Header,
    Headers,
    Injectable,
    Module,
    NotFoundException,
    Param,
    Post,
    Put,
    UnauthorizedException,
    UseGuards,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard, AuthUser, CurrentUser, Roles } from '../common/auth';
import { EventAccess } from '../common/access';
import { Result, csvToResults } from './rr-csv';

class PutResultsDto {
    @IsIn(['live', 'final']) status!: 'live' | 'final';
    @IsOptional() @IsString() @MaxLength(200) fileName?: string;
    /** Risultati già nel formato del sito (import Excel dall'admin). */
    @IsArray() @ArrayMaxSize(50000) results!: Result[];
}

class SyncCsvDto {
    /** Contenuto della lista Race Result (CSV della Simple API). */
    @IsString() @MaxLength(20_000_000) csv!: string;
    /** "final" quando dal PC di gara si dichiara la classifica definitiva. */
    @IsOptional() @IsIn(['live', 'final']) status?: 'live' | 'final';
}

const STATUSES = ['finisher', 'dnf', 'dns', 'dsq'] as const;
const str = (v: unknown, max: number) => (typeof v === 'string' || typeof v === 'number' ? String(v).slice(0, max) : '');

/**
 * Classifica caricata dallo staff: si tengono solo i campi previsti, con
 * lunghezze limitate (niente dati arbitrari pubblicati, niente elementi vuoti).
 */
export function sanitizeResults(list: unknown[]): Result[] {
    return list.map((x, i) => {
        if (!x || typeof x !== 'object' || Array.isArray(x)) throw new BadRequestException(`Riga ${i + 1} della classifica non valida`);
        const r = x as Record<string, unknown>;
        const status = STATUSES.includes(r.status as (typeof STATUSES)[number]) ? (r.status as Result['status']) : 'finisher';
        const position = Number(r.position);
        const out: Result = {
            position: Number.isFinite(position) && position >= 0 && position < 1e6 ? Math.floor(position) : i + 1,
            bib: str(r.bib, 20),
            athleteName: str(r.athleteName, 120),
            category: str(r.category, 60),
            time: str(r.time, 20),
            status,
        };
        if (r.team != null) out.team = str(r.team, 120);
        if (r.gap != null) out.gap = str(r.gap, 20);
        if (Array.isArray(r.lapSplits)) {
            out.lapSplits = r.lapSplits.slice(0, 200).filter(l => l && typeof l === 'object')
                .map(l => Object.fromEntries(Object.entries(l as object).slice(0, 10).map(([k, v]) => [k.slice(0, 30), typeof v === 'number' ? v : str(v, 40)]))) as unknown as Result['lapSplits'];
        }
        return out;
    });
}

const safeEqual = (a: string, b: string) =>
    a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
/** Nel DB si salva solo l'impronta della chiave: chi legge il DB non può usarla. */
const keyHash = (k: string) => createHash('sha256').update(k).digest('hex');

/**
 * La chiave semi-live corrisponde a quella della gara? Le chiavi generate prima
 * che si salvasse l'impronta valgono ancora e vengono convertite al primo uso.
 */
export async function syncKeyMatches(prisma: PrismaService, raceId: string, key: string | undefined): Promise<boolean> {
    if (!key || key.length > 200) return false;
    const race = await prisma.race.findUnique({ where: { id: raceId }, select: { syncKey: true } });
    if (!race?.syncKey) return false;
    if (safeEqual(keyHash(key), race.syncKey)) return true;
    const legacy = !/^[0-9a-f]{64}$/.test(race.syncKey) && safeEqual(key, race.syncKey);
    if (legacy) await prisma.race.update({ where: { id: raceId }, data: { syncKey: keyHash(key) } });
    return legacy;
}

@Injectable()
export class ResultsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly access: EventAccess,
    ) {}

    private async raceForStaff(user: AuthUser, raceId: string) {
        const race = await this.prisma.race.findUnique({
            where: { id: raceId },
            include: { day: { include: { event: { select: { id: true, createdById: true } } } } },
        });
        if (!race) throw new NotFoundException('Gara non trovata');
        await this.access.assert(user, race.day.event.id, race.day.event.createdById);
        return race;
    }

    /** Classifica pubblica di una gara. */
    async get(raceId: string) {
        const up = await this.prisma.resultUpload.findUnique({
            where: { raceId },
            include: { rows: { orderBy: { position: 'asc' }, select: { data: true } } },
        });
        if (!up) return { status: null, updatedAt: null, results: [] };
        return {
            status: up.status,
            source: up.source,
            updatedAt: up.uploadedAt,
            results: up.rows.map(r => r.data as unknown as Result),
        };
    }

    /** Sostituisce la classifica della gara (una sola versione per gara). */
    private async replace(raceId: string, results: Result[], status: string, source: string, fileName: string, mapping: unknown) {
        // Ordine: arrivati per posizione, poi ritirati / non partiti
        const ordered = [...results].sort((a, b) =>
            (a.status === 'finisher' ? 0 : 1) - (b.status === 'finisher' ? 0 : 1) || a.position - b.position);
        await this.prisma.$transaction(async tx => {
            await tx.resultUpload.deleteMany({ where: { raceId } });
            const up = await tx.resultUpload.create({
                data: { raceId, fileName, columnMapping: mapping as Prisma.InputJsonValue, status, source },
            });
            await tx.resultRow.createMany({
                data: ordered.map((r, i) => ({
                    uploadId: up.id,
                    raceId,
                    section: r.category || null,
                    position: i + 1, // ordine di visualizzazione
                    data: r as unknown as Prisma.InputJsonValue,
                })),
            });
        }, { timeout: 60_000 });
        return { ok: true, status, count: ordered.length };
    }

    async put(user: AuthUser, raceId: string, dto: PutResultsDto) {
        await this.raceForStaff(user, raceId);
        return this.replace(raceId, sanitizeResults(dto.results), dto.status, 'upload', dto.fileName ?? 'import', {});
    }

    /** Genera (o rigenera) la chiave del programma semi-live per la gara. */
    async newSyncKey(user: AuthUser, raceId: string) {
        await this.raceForStaff(user, raceId);
        const syncKey = randomBytes(24).toString('base64url');
        await this.prisma.race.update({ where: { id: raceId }, data: { syncKey: keyHash(syncKey) } });
        return { raceId, syncKey }; // mostrata una sola volta
    }

    /** Invio dal PC di gara: autenticato solo dalla chiave della gara. */
    async sync(raceId: string, key: string | undefined, dto: SyncCsvDto) {
        if (!(await syncKeyMatches(this.prisma, raceId, key))) throw new UnauthorizedException('Chiave semi-live non valida');
        const current = await this.prisma.resultUpload.findUnique({ where: { raceId }, select: { status: true, source: true } });
        if (current?.status === 'final' && current.source === 'upload' && dto.status !== 'final') {
            // Classifica ufficiale caricata dall'admin: il semi-live non la sovrascrive
            throw new ConflictException('Classifica già pubblicata come ufficiale: invio semi-live ignorato');
        }
        let parsed: ReturnType<typeof csvToResults>;
        try {
            parsed = csvToResults(dto.csv);
        } catch (e) {
            throw new BadRequestException((e as Error).message);
        }
        // Lista vuota (es. filtro sbagliato in Race Result): non si cancella la classifica pubblicata
        if (parsed.results.length === 0) throw new BadRequestException('Nessun risultato nella lista inviata: classifica non modificata');
        const status = dto.status ?? 'live';
        const res = await this.replace(raceId, parsed.results, status, 'sync', 'race-result', { recognized: parsed.recognized });
        return { ...res, recognized: parsed.recognized };
    }
}

@Controller()
export class ResultsController {
    constructor(private readonly results: ResultsService) {}

    /** Pubblica: GET /api/races/:id/results (cache breve: si aggiorna durante la gara). */
    @Get('races/:id/results')
    @Header('Cache-Control', 'public, max-age=15')
    get(@Param('id') id: string) {
        return this.results.get(id);
    }

    @Put('races/:id/results')
    @UseGuards(AuthGuard)
    @Roles(Role.ADMIN, Role.ORGANIZER)
    put(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: PutResultsDto) {
        return this.results.put(user, id, dto);
    }

    @Post('races/:id/sync-key')
    @UseGuards(AuthGuard)
    @Roles(Role.ADMIN, Role.ORGANIZER)
    syncKey(@CurrentUser() user: AuthUser, @Param('id') id: string) {
        return this.results.newSyncKey(user, id);
    }

    /** Programma semi-live: header X-Sync-Key, body { csv, status? }. */
    @Post('sync/races/:id/results')
    sync(@Param('id') id: string, @Headers('x-sync-key') key: string | undefined, @Body() dto: SyncCsvDto) {
        return this.results.sync(id, key, dto);
    }
}

@Module({
    controllers: [ResultsController],
    providers: [ResultsService],
})
export class ResultsModule {}
