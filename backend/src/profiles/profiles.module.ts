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
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { FidalModule } from '../fidal/fidal.module';
import { FidalService } from '../fidal/fidal.service';
import { normName } from '../registrations/rules';
import { AuthGuard, AuthUser, CurrentUser, Roles } from '../common/auth';
import {
    AthleteProfileDto,
    CertDecisionDto,
    CreateStaffDto,
    SearchDto,
    SocietyProfileDto,
    UpdateStaffDto,
} from './profiles.dto';

const PAGE = 50;

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
    private async fidalConfirmed(tessera: string, cognome: string, dataNascita: string): Promise<boolean> {
        try {
            const r = await this.fidal.verifyByTessera(tessera.trim());
            return !!r.atleta
                && normName(r.atleta.cognome) === normName(cognome)
                && r.atleta.dataNascita === dataNascita.slice(0, 10);
        } catch {
            return false;
        }
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
        const prev = await this.prisma.athleteProfile.findUnique({ where: { accountId } });
        const certExpiry = dto.certExpiry ? new Date(dto.certExpiry) : null;
        const certChanged =
            (dto.certType ?? null) !== (prev?.certType ?? null) ||
            (certExpiry?.getTime() ?? null) !== (prev?.certExpiry?.getTime() ?? null);
        const certStatus = !dto.certType ? null : certChanged ? CertStatus.IN_ATTESA : prev?.certStatus ?? CertStatus.IN_ATTESA;

        const data = {
            nome: dto.nome.trim(),
            cognome: dto.cognome.trim(),
            dataNascita: new Date(dto.dataNascita),
            sesso: dto.sesso,
            codFiscale: dto.codFiscale?.toUpperCase() ?? null,
            phone: dto.phone ?? null,
            club: dto.club ?? null,
            certType: dto.certType ?? null,
            certExpiry,
            certStatus,
        };
        const sources = await Promise.all(
            (dto.affiliations ?? []).map(async a =>
                a.ente === 'fidal' && a.numeroTessera && (await this.fidalConfirmed(a.numeroTessera, dto.cognome, dto.dataNascita))
                    ? 'fidal_db'
                    : 'manual',
            ),
        );
        try {
            return await this.prisma.$transaction(async tx => {
                const p = await tx.athleteProfile.upsert({
                    where: { accountId },
                    create: { ...data, accountId },
                    update: data,
                });
                if (dto.affiliations) {
                    await tx.affiliation.deleteMany({ where: { athleteId: p.id } });
                    if (dto.affiliations.length) {
                        await tx.affiliation.createMany({
                            data: dto.affiliations.map((a, i) => ({
                                athleteId: p.id,
                                ente: a.ente,
                                societaNome: a.societaNome,
                                codiceSocieta: a.codiceSocieta ?? null,
                                numeroTessera: a.numeroTessera ?? null,
                                certScadenza: a.certScadenza ? new Date(a.certScadenza) : null,
                                // "fidal_db" solo se confermato da WISE lato server, mai dal client
                                source: sources[i],
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

    saveSociety(accountId: string, dto: SocietyProfileDto) {
        const data = {
            societaNome: dto.societaNome.trim(),
            ente: dto.ente,
            codiceFidal: dto.codiceFidal?.toUpperCase() ?? null,
            ...(dto.roster ? { roster: dto.roster as Prisma.InputJsonValue } : {}),
        };
        return this.prisma.society.upsert({
            where: { accountId },
            create: { ...data, roster: (dto.roster ?? []) as Prisma.InputJsonValue, accountId },
            update: data,
        });
    }

    // ─── Account staff (admin) ───────────────────────────────────────────

    staff() {
        return this.prisma.account.findMany({
            where: { role: { in: [Role.ADMIN, Role.ORGANIZER] } },
            select: { id: true, email: true, role: true, displayName: true, assignedEventIds: true, createdAt: true },
            orderBy: { email: 'asc' },
        });
    }

    async createStaff(dto: CreateStaffDto) {
        const a = await this.auth.createAccount(dto.email, dto.password, dto.role, dto.displayName, dto.assignedEventIds ?? []);
        return { id: a.id, email: a.email, role: a.role, displayName: a.displayName, assignedEventIds: a.assignedEventIds };
    }

    async updateStaff(id: string, dto: UpdateStaffDto) {
        const a = await this.prisma.account.findUnique({ where: { id } });
        if (!a) throw new NotFoundException('Account non trovato');
        if (a.role !== Role.ADMIN && a.role !== Role.ORGANIZER) throw new ForbiddenException('Non è un account staff');
        return this.prisma.account.update({
            where: { id },
            data: { displayName: dto.displayName, assignedEventIds: dto.assignedEventIds },
            select: { id: true, email: true, role: true, displayName: true, assignedEventIds: true },
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
    updateStaff(@Param('id') id: string, @Body() dto: UpdateStaffDto) {
        return this.profiles.updateStaff(id, dto);
    }
}

@Module({
    imports: [FidalModule],
    controllers: [ProfilesController],
    providers: [ProfilesService],
})
export class ProfilesModule {}
