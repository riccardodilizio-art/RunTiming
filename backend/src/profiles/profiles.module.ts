import {
    BadRequestException,
    Body,
    ConflictException,
    Controller,
    ForbiddenException,
    Get,
    Injectable,
    Module,
    NotFoundException,
    Param,
    Patch,
    Post,
    Put,
    Query,
    UseGuards,
} from '@nestjs/common';
import { CertStatus, Prisma, Role } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';
import { dateOnly } from '../common/validators';
import { AuthService } from '../auth/auth.service';
import { FidalModule } from '../fidal/fidal.module';
import { FidalService } from '../fidal/fidal.service';
import { ETA_MIN_ACCOUNT, etaAnagrafica, normName } from '../registrations/rules';
import { AuthGuard, AuthUser, CurrentUser, Roles } from '../common/auth';
import {
    AthleteProfileDto,
    CertDecisionDto,
    CreateStaffDto,
    SearchDto,
    SocietyProfileDto,
    SocietyFidalDecisionDto,
    UpdateStaffDto,
} from './profiles.dto';

const PAGE = 50;

interface FidalCheck {
    ok: boolean;
    cert?: string | null;
    societa?: string | null;
    codiceSocieta?: string | null;
}

@Injectable()
export class ProfilesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly auth: AuthService,
        private readonly fidal: FidalService,
    ) {}

    /**
     * Tessera FIDAL confermata su WISE (stesso cognome e data di nascita)?
     * Se WISE non risponde, il tesseramento resta "manual" (non verificato).
     */
    private async fidalConfirmed(tessera: string, cognome: string, dataNascita: string): Promise<FidalCheck> {
        try {
            const r = await this.fidal.verifyByTessera(tessera.trim());
            const a = r.atleta;
            const ok = !!a && normName(a.cognome) === normName(cognome) && a.dataNascita === dataNascita.slice(0, 10);
            if (!ok || !a) return { ok: false };
            // Società e scadenza certificato dal dato FIDAL, non da quanto scrive l'atleta
            return { ok: true, cert: a.certScadenza ?? null, societa: a.societa || null, codiceSocieta: a.codiceSocieta || null };
        } catch {
            return { ok: false };
        }
    }

    /**
     * Atleta con login: dati FIDAL della SUA tessera (società, scadenza certificato),
     * solo se la tessera corrisponde a cognome e data di nascita del suo profilo.
     * Serve a compilare il tesseramento nel profilo senza scriverlo a mano.
     */
    async myFidal(accountId: string, tessera: string) {
        const p = await this.prisma.athleteProfile.findUnique({ where: { accountId } });
        if (!p) throw new BadRequestException('Salva prima il profilo (nome, cognome, data di nascita)');
        const c = await this.fidalConfirmed(tessera, p.cognome, p.dataNascita.toISOString().slice(0, 10));
        if (!c.ok) return { trovato: false };
        return { trovato: true, societaNome: c.societa, codiceSocieta: c.codiceSocieta, certScadenza: c.cert };
    }

    // ─── Atleta ──────────────────────────────────────────────────────────

    athleteMe(accountId: string) {
        return this.prisma.athleteProfile.findUnique({ where: { accountId }, include: { affiliations: true } });
    }

    /**
     * Crea o aggiorna il profilo. Se cambiano tipo o scadenza del certificato,
     * torna "in attesa" finché l'admin non lo verifica (una volta sola, poi vale
     * per tutte le gare fino alla scadenza).
     */
    async saveAthlete(accountId: string, dto: AthleteProfileDto) {
        // Account personale dai 14 anni: sotto lo iscrive un genitore (dal suo account o senza account)
        if (etaAnagrafica(dto.dataNascita, new Date()) < ETA_MIN_ACCOUNT) {
            throw new BadRequestException(`L'account atleta si può creare dai ${ETA_MIN_ACCOUNT} anni: sotto, l'iscrizione la fa un genitore`);
        }
        const prev = await this.prisma.athleteProfile.findUnique({ where: { accountId } });
        const certExpiry = dto.certExpiry ? new Date(dto.certExpiry) : null;
        const certChanged =
            (dto.certType ?? null) !== (prev?.certType ?? null) ||
            (certExpiry?.getTime() ?? null) !== (prev?.certExpiry?.getTime() ?? null);
        const certStatus = !dto.certType ? null : certChanged ? CertStatus.IN_ATTESA : prev?.certStatus ?? CertStatus.IN_ATTESA;

        const data = {
            nome: dto.nome.trim(),
            cognome: dto.cognome.trim(),
            dataNascita: dateOnly(dto.dataNascita),
            sesso: dto.sesso,
            codFiscale: dto.codFiscale?.toUpperCase() ?? null,
            phone: dto.phone ?? null,
            club: dto.club ?? null,
            certType: dto.certType ?? null,
            certExpiry,
            certStatus,
        };
        const checks = await Promise.all(
            (dto.affiliations ?? []).map(async a =>
                a.ente === 'fidal' && a.numeroTessera
                    ? this.fidalConfirmed(a.numeroTessera, dto.cognome, dto.dataNascita)
                    : ({ ok: false } as FidalCheck),
            ),
        );
        try {
            return await this.prisma.$transaction(async tx => {
                const p = await tx.athleteProfile.upsert({
                    where: { accountId },
                    create: { ...data, accountId },
                    update: data,
                });
                // Cambiano nome, cognome o data di nascita: un tesseramento verificato su FIDAL
                // per la persona di prima non vale più (va riverificato inviandolo di nuovo).
                const identityChanged = !!prev && (
                    normName(prev.nome) !== normName(dto.nome) ||
                    normName(prev.cognome) !== normName(dto.cognome) ||
                    prev.dataNascita.toISOString().slice(0, 10) !== dto.dataNascita.slice(0, 10)
                );
                if (identityChanged && !dto.affiliations) {
                    await tx.affiliation.updateMany({ where: { athleteId: p.id, source: 'fidal_db' }, data: { source: 'manual' } });
                }
                if (dto.affiliations) {
                    await tx.affiliation.deleteMany({ where: { athleteId: p.id } });
                    if (dto.affiliations.length) {
                        await tx.affiliation.createMany({
                            data: dto.affiliations.map((a, i) => ({
                                athleteId: p.id,
                                ente: a.ente,
                                // Tessera confermata: società come risulta a FIDAL
                                societaNome: (checks[i].ok && checks[i].societa) || a.societaNome,
                                codiceSocieta: (checks[i].ok && checks[i].codiceSocieta) || a.codiceSocieta || null,
                                numeroTessera: a.numeroTessera ?? null,
                                certScadenza: checks[i].ok
                                    ? (checks[i].cert ? new Date(checks[i].cert as string) : null)
                                    : a.certScadenza ? new Date(a.certScadenza) : null,
                                // "fidal_db" solo se confermato da WISE lato server, mai dal client
                                source: checks[i].ok ? 'fidal_db' : 'manual',
                            })),
                        });
                    }
                }
                return tx.athleteProfile.findUnique({ where: { id: p.id }, include: { affiliations: true } });
            });
        } catch (e) {
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                throw new ConflictException('Codice fiscale già associato a un altro account');
            }
            throw e;
        }
    }

    /** Admin: atleti con certificato da verificare (o ricerca per nome). */
    athletes(q: SearchDto, pendingOnly: boolean) {
        const t = q.q?.trim();
        return this.prisma.athleteProfile.findMany({
            where: {
                ...(pendingOnly ? { certStatus: CertStatus.IN_ATTESA } : {}),
                ...(t ? { OR: [{ cognome: { contains: t, mode: 'insensitive' } }, { nome: { contains: t, mode: 'insensitive' } }] } : {}),
            },
            orderBy: [{ cognome: 'asc' }, { nome: 'asc' }],
            skip: ((q.page ?? 1) - 1) * PAGE,
            take: PAGE,
            include: { affiliations: true, account: { select: { email: true } } },
        });
    }

    async decideCert(id: string, certStatus: CertStatus) {
        const p = await this.prisma.athleteProfile.findUnique({ where: { id } });
        if (!p) throw new NotFoundException('Atleta non trovato');
        if (certStatus === CertStatus.VERIFICATO && (!p.certType || !p.certExpiry)) {
            throw new BadRequestException("L'atleta non ha inserito un certificato");
        }
        // Le iscrizioni dell'atleta in attesa del certificato seguono la decisione
        await this.prisma.registration.updateMany({
            where: { athleteId: id, certStatus: CertStatus.IN_ATTESA },
            data: { certStatus },
        });
        return this.prisma.athleteProfile.update({ where: { id }, data: { certStatus } });
    }

    // ─── Società ─────────────────────────────────────────────────────────

    societyMe(accountId: string) {
        return this.prisma.society.findUnique({ where: { accountId } });
    }

    async saveSociety(accountId: string, dto: SocietyProfileDto) {
        // Roster: solo oggetti di dimensione ragionevole (niente dati arbitrari o enormi)
        if (dto.roster?.some(r => !r || typeof r !== 'object' || Array.isArray(r) || JSON.stringify(r).length > 4000)) {
            throw new BadRequestException('Roster non valido');
        }
        const codiceFidal = dto.codiceFidal?.trim().toUpperCase() || null;
        const current = await this.prisma.society.findUnique({ where: { accountId }, select: { codiceFidal: true } });
        const data = {
            societaNome: dto.societaNome.trim(),
            ente: dto.ente,
            codiceFidal,
            // Codice nuovo o cambiato: torna da approvare
            ...(current?.codiceFidal !== codiceFidal ? { fidalApproved: false } : {}),
            ...(dto.roster ? { roster: dto.roster as Prisma.InputJsonValue } : {}),
        };
        return this.prisma.society.upsert({
            where: { accountId },
            create: { ...data, roster: (dto.roster ?? []) as Prisma.InputJsonValue, accountId },
            update: data,
        });
    }

    /** Admin: società registrate (con il nome ufficiale FIDAL del codice, per il confronto). */
    async societies(pendingOnly: boolean) {
        const rows = await this.prisma.society.findMany({
            where: pendingOnly ? { codiceFidal: { not: null }, fidalApproved: false } : {},
            select: {
                id: true, societaNome: true, ente: true, codiceFidal: true, fidalApproved: true, createdAt: true,
                account: { select: { email: true, displayName: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 500,
        });
        const codes = rows.map(r => r.codiceFidal).filter((c): c is string => !!c);
        const official = codes.length
            ? await this.prisma.fidalSociety.findMany({ where: { codice: { in: codes } }, select: { codice: true, denominazione: true, citta: true } })
            : [];
        const byCode = new Map(official.map(o => [o.codice.toUpperCase(), o]));
        const approvedCodes = new Set(
            (await this.prisma.society.findMany({ where: { fidalApproved: true, codiceFidal: { in: codes } }, select: { id: true, codiceFidal: true } }))
                .map(x => `${x.codiceFidal}|${x.id}`),
        );
        return rows.map(r => ({
            ...r,
            fidalUfficiale: r.codiceFidal ? byCode.get(r.codiceFidal) ?? null : null,
            // Lo stesso codice è già approvato per un'altra società
            codiceGiaApprovatoAltrove: !!r.codiceFidal && [...approvedCodes].some(k => k.startsWith(`${r.codiceFidal}|`) && k !== `${r.codiceFidal}|${r.id}`),
        }));
    }

    async decideSocietyFidal(id: string, approved: boolean) {
        const s = await this.prisma.society.findUnique({ where: { id }, select: { codiceFidal: true } });
        if (!s) throw new NotFoundException('Società non trovata');
        // Un'approvazione alla volta per codice: due approvazioni contemporanee non passano entrambe
        return this.prisma.$transaction(async tx => {
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'fidal:' + (s.codiceFidal ?? id)}))::text`;
            return this.decideSocietyFidalLocked(tx, id, approved);
        });
    }

    private async decideSocietyFidalLocked(tx: Prisma.TransactionClient, id: string, approved: boolean) {
        const s = await tx.society.findUnique({ where: { id }, select: { codiceFidal: true } });
        if (!s) throw new NotFoundException('Società non trovata');
        if (approved && !s.codiceFidal) throw new BadRequestException('La società non ha indicato un codice FIDAL');
        if (approved) {
            const other = await tx.society.findFirst({
                where: { id: { not: id }, codiceFidal: s.codiceFidal, fidalApproved: true },
                select: { societaNome: true, account: { select: { email: true } } },
            });
            if (other) {
                throw new ConflictException(`Codice già approvato per un'altra società (${other.societaNome}, ${other.account.email}): revoca prima quello`);
            }
        }
        return tx.society.update({
            where: { id },
            data: { fidalApproved: approved },
            select: { id: true, codiceFidal: true, fidalApproved: true },
        });
    }

    // ─── Account staff (admin) ───────────────────────────────────────────

    staff() {
        return this.prisma.account.findMany({
            where: { role: { in: [Role.ADMIN, Role.ORGANIZER] } },
            select: { id: true, email: true, role: true, displayName: true, assignedEventIds: true, disabled: true, createdAt: true },
            orderBy: { email: 'asc' },
        });
    }

    async createStaff(dto: CreateStaffDto) {
        const a = await this.auth.createAccount(dto.email, dto.password, dto.role, dto.displayName, dto.assignedEventIds ?? []);
        return { id: a.id, email: a.email, role: a.role, displayName: a.displayName, assignedEventIds: a.assignedEventIds };
    }

    async updateStaff(id: string, dto: UpdateStaffDto, by?: string) {
        const a = await this.prisma.account.findUnique({ where: { id } });
        if (!a) throw new NotFoundException('Account non trovato');
        if (a.role !== Role.ADMIN && a.role !== Role.ORGANIZER) throw new ForbiddenException('Non è un account staff');
        if (dto.disabled && id === by) throw new BadRequestException('Non puoi disattivare il tuo stesso account');
        return this.prisma.account.update({
            where: { id },
            data: {
                displayName: dto.displayName,
                assignedEventIds: dto.assignedEventIds,
                ...(dto.disabled !== undefined ? { disabled: dto.disabled } : {}),
                // Disattivando si chiudono subito anche i login già aperti
                ...(dto.disabled ? { tokenVersion: { increment: 1 } } : {}),
            },
            select: { id: true, email: true, role: true, displayName: true, assignedEventIds: true, disabled: true },
        });
    }
}

@Controller()
@UseGuards(AuthGuard)
export class ProfilesController {
    constructor(private readonly profiles: ProfilesService) {}

    @Get('athletes/me')
    @Roles(Role.ATHLETE)
    athleteMe(@CurrentUser() u: AuthUser) {
        return this.profiles.athleteMe(u.sub);
    }

    @Put('athletes/me')
    @Roles(Role.ATHLETE)
    saveAthlete(@CurrentUser() u: AuthUser, @Body() dto: AthleteProfileDto) {
        return this.profiles.saveAthlete(u.sub, dto);
    }

    /** Admin: GET /api/athletes?q=&pending=1 (certificati da verificare). */
    /** GET /api/athletes/me/fidal?tessera=… — compila il tesseramento FIDAL del profilo. */
    @Get('athletes/me/fidal')
    @Roles(Role.ATHLETE)
    @Throttle({ default: { limit: 20, ttl: 60_000 } })
    myFidal(@CurrentUser() u: AuthUser, @Query('tessera') tessera?: string) {
        if (!tessera?.trim() || tessera.length > 30) throw new BadRequestException('Indica il numero di tessera');
        return this.profiles.myFidal(u.sub, tessera);
    }

    @Get('athletes')
    @Roles(Role.ADMIN)
    athletes(@Query() q: SearchDto, @Query('pending') pending?: string) {
        return this.profiles.athletes(q, pending === '1' || pending === 'true');
    }

    @Patch('athletes/:id/cert')
    @Roles(Role.ADMIN)
    decideCert(@Param('id') id: string, @Body() dto: CertDecisionDto) {
        return this.profiles.decideCert(id, dto.certStatus);
    }

    @Get('societies/me')
    @Roles(Role.SOCIETY)
    societyMe(@CurrentUser() u: AuthUser) {
        return this.profiles.societyMe(u.sub);
    }

    @Put('societies/me')
    @Roles(Role.SOCIETY)
    saveSociety(@CurrentUser() u: AuthUser, @Body() dto: SocietyProfileDto) {
        return this.profiles.saveSociety(u.sub, dto);
    }

    /** Admin: GET /api/societies?pending=1 (codici FIDAL da approvare). */
    @Get('societies')
    @Roles(Role.ADMIN)
    societies(@Query('pending') pending?: string) {
        return this.profiles.societies(pending === '1' || pending === 'true');
    }

    @Patch('societies/:id/fidal')
    @Roles(Role.ADMIN)
    decideSocietyFidal(@Param('id') id: string, @Body() dto: SocietyFidalDecisionDto) {
        return this.profiles.decideSocietyFidal(id, dto.approved);
    }

    @Get('accounts')
    @Roles(Role.ADMIN)
    staff() {
        return this.profiles.staff();
    }

    @Post('accounts')
    @Roles(Role.ADMIN)
    createStaff(@Body() dto: CreateStaffDto) {
        return this.profiles.createStaff(dto);
    }

    @Patch('accounts/:id')
    @Roles(Role.ADMIN)
    updateStaff(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateStaffDto) {
        return this.profiles.updateStaff(id, dto, u.sub);
    }
}

@Module({
    imports: [FidalModule],
    controllers: [ProfilesController],
    providers: [ProfilesService],
})
export class ProfilesModule {}
