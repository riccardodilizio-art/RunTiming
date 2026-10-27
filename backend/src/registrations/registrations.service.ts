import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { CertStatus, PaymentStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.module';
import { AuthUser } from '../common/auth';
import { EventAccess } from '../common/access';
import { discountProblem, normCode } from '../discounts/discounts.module';
import {
    CommissionConfig,
    PriceStep,
    RaceCategory,
    assignCategory,
    checkAge,
    normName,
    quote,
    sportAge,
    todayRome,
} from './rules';
import { CreateRegistrationDto, ListQueryDto, VerifyDto } from './registrations.dto';

/** Chiavi di catalogo che vengono dal profilo atleta, non dal modulo extra. */
const PROFILE_KEYS = new Set([
    'nome', 'cognome', 'data_nascita', 'anno_nascita', 'sesso', 'email', 'telefono', 'codice_fiscale',
    'societa', 'codice_societa', 'tessera_fidal', 'tessera_runcard', 'tessera_fci', 'tessera_csi',
    'tessera_uisp', 'tessera_fitri', 'tessera_fin', 'tipo_certificato', 'num_certificato',
    'scadenza_certificato', 'gruppo_sanguigno', 'upload_cert_medico', 'upload_tessera',
]);

interface FormFieldDef {
    id: string;
    catalogKey?: string;
    type: string;
    label: string;
    required: boolean;
}

type RaceWithEvent = Prisma.RaceGetPayload<{ include: { day: { include: { event: true } } } }>;

interface AthleteSnapshot {
    nome: string;
    cognome: string;
    sesso: string;
    dataNascita: Date;
    societa?: string | null;
    codiceSocieta?: string | null;
    tessera?: string | null;
    email?: string | null;
    fidalVerified: boolean;
    /** Certificato già noto come valido alla data gara (profilo atleta). */
    certValid: boolean;
}

const json = <T>(v: Prisma.JsonValue | null | undefined): T | undefined => (v ?? undefined) as unknown as T;

@Injectable()
export class RegistrationsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly settings: SettingsService,
        private readonly access: EventAccess,
    ) {}

    // ─── Lettura gara / permessi ────────────────────────────────────────────

    private async race(raceId: string): Promise<RaceWithEvent> {
        const race = await this.prisma.race.findUnique({
            where: { id: raceId },
            include: { day: { include: { event: true } } },
        });
        if (!race) throw new NotFoundException('Gara non trovata');
        return race;
    }

    private assertCanManage(user: AuthUser, eventId: string, createdById?: string | null) {
        return this.access.assert(user, eventId, createdById);
    }

    // ─── Preventivo ─────────────────────────────────────────────────────────

    async quote(raceId: string, code?: string) {
        const race = await this.race(raceId);
        let discount = null;
        let discountMessage: string | undefined;
        if (code?.trim()) {
            const d = await this.prisma.discountCode.findUnique({ where: { code: normCode(code) } });
            discountMessage = discountProblem(d) ?? undefined;
            if (!discountMessage) discount = d;
        }
        const q = quote({
            basePrice: race.price,
            steps: json<PriceStep[]>(race.priceSteps),
            discount,
            commissions: {
                global: await this.settings.commission(),
                event: json<CommissionConfig>(race.day.event.commission),
                race: json<CommissionConfig>(race.commission),
            },
            today: todayRome(),
        });
        return { ...q, discountCode: discount?.code, discountMessage };
    }

    // ─── Creazione ──────────────────────────────────────────────────────────

    async create(user: AuthUser, dto: CreateRegistrationDto) {
        const race = await this.race(dto.raceId);
        const event = race.day.event;
        const isStaff = user.role === Role.ADMIN || user.role === Role.ORGANIZER;
        if (isStaff) await this.assertCanManage(user, event.id, event.createdById);
        if (!race.isOpen && !isStaff) throw new BadRequestException('Iscrizioni chiuse per questa gara');

        const { athlete, athleteId, societyId } = await this.resolveAthlete(user, race, dto);

        // Età e categoria (età "sportiva": anno gara − anno nascita)
        const age = sportAge(athlete.dataNascita, race.day.date);
        const ageProblem = checkAge(age, race.minAge, race.maxAge);
        if (ageProblem && !isStaff) throw new BadRequestException(ageProblem);
        const category = assignCategory(json<RaceCategory[]>(race.categories), age, athlete.sesso);

        // Campi extra obbligatori del modulo gara (i file arriveranno con lo storage)
        const formData = dto.formData ?? {};
        const missing = (json<FormFieldDef[]>(race.formSchema) ?? [])
            .filter(f => f.required && f.type !== 'file' && !(f.catalogKey && PROFILE_KEYS.has(f.catalogKey)))
            .filter(f => {
                const v = formData[f.id];
                return v === undefined || v === '' || v === false;
            })
            .map(f => f.label);
        if (missing.length) throw new BadRequestException(`Campi obbligatori mancanti: ${missing.join(', ')}`);

        // Certificato: tesserato FIDAL → valido in automatico (vedi LOGICA-SITO §2.1)
        let certStatus: CertStatus = CertStatus.NON_RICHIESTO;
        if (race.requiresMedicalCert) {
            certStatus = athlete.fidalVerified || athlete.certValid ? CertStatus.VERIFICATO : CertStatus.IN_ATTESA;
        }

        // Prezzo calcolato dal server
        const q = await this.quote(race.id, dto.discountCode);
        if (dto.discountCode?.trim() && q.discountMessage) throw new BadRequestException(q.discountMessage);

        let paymentStatus: PaymentStatus = PaymentStatus.PENDING;
        let paymentMethod: string;
        if (q.total === 0) {
            paymentStatus = PaymentStatus.CONFIRMED;
            paymentMethod = 'free';
        } else if (isStaff) {
            paymentMethod = dto.paymentMethod ?? 'manual';
            if (dto.markPaid) paymentStatus = PaymentStatus.CONFIRMED;
        } else {
            const mode = race.paymentMode ?? 'online';
            const wanted = dto.paymentMethod ?? (mode === 'onsite' ? 'onsite' : 'online');
            const allowed = mode === 'both' ? ['online', 'onsite'] : mode === 'none' ? ['onsite'] : [mode];
            if (!allowed.includes(wanted)) throw new BadRequestException('Metodo di pagamento non ammesso per questa gara');
            paymentMethod = wanted;
        }

        return this.prisma.$transaction(async tx => {
            // Serializza le iscrizioni sulla stessa gara (posti limitati, doppioni)
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${race.id}))::text`;

            if (race.maxParticipants > 0) {
                const count = await tx.registration.count({
                    where: { raceId: race.id, paymentStatus: { not: PaymentStatus.REJECTED } },
                });
                if (count >= race.maxParticipants) throw new ConflictException('Gara al completo');
            }

            const dup = await tx.registration.findFirst({
                where: {
                    raceId: race.id,
                    cognome: athlete.cognome,
                    nome: athlete.nome,
                    dataNascita: athlete.dataNascita,
                    paymentStatus: { not: PaymentStatus.REJECTED },
                },
                select: { id: true },
            });
            if (dup) throw new ConflictException('Atleta già iscritto a questa gara');

            if (q.discountCode) {
                // Incremento atomico: fallisce se nel frattempo il codice si è esaurito
                const d = await tx.discountCode.findUniqueOrThrow({ where: { code: q.discountCode } });
                const ok = await tx.discountCode.updateMany({
                    where: { id: d.id, isActive: true, ...(d.maxUses != null ? { usedCount: { lt: d.maxUses } } : {}) },
                    data: { usedCount: { increment: 1 } },
                });
                if (ok.count === 0) throw new ConflictException('Codice sconto esaurito');
            }

            const reg = await tx.registration.create({
                data: {
                    raceId: race.id,
                    eventId: event.id,
                    athleteId,
                    societyId,
                    nome: athlete.nome,
                    cognome: athlete.cognome,
                    sesso: athlete.sesso,
                    dataNascita: athlete.dataNascita,
                    societa: athlete.societa,
                    codiceSocieta: athlete.codiceSocieta,
                    tessera: athlete.tessera,
                    email: athlete.email,
                    formData: formData as Prisma.InputJsonValue,
                    basePrice: q.price,
                    discountAmount: q.discount,
                    commissionAmount: q.commission,
                    pricePaid: q.total,
                    discountCode: q.discountCode,
                    paymentMethod,
                    paymentStatus,
                    assignedCategory: category?.name,
                    fidalVerified: athlete.fidalVerified,
                    addedByOrganizer: isStaff,
                    createdById: user.sub,
                    certStatus,
                },
            });
            return { registration: reg, quote: q, ageWarning: ageProblem ?? undefined };
        });
    }

    /** Ricava l'anagrafica in base a chi sta iscrivendo. */
    private async resolveAthlete(user: AuthUser, race: RaceWithEvent, dto: CreateRegistrationDto) {
        const ente = (race.ente ?? '').toLowerCase();

        if (user.role === Role.ATHLETE) {
            const p = await this.prisma.athleteProfile.findUnique({
                where: { accountId: user.sub },
                include: { affiliations: true },
            });
            if (!p) throw new BadRequestException('Completa il tuo profilo atleta prima di iscriverti');
            const aff = dto.affiliationId
                ? p.affiliations.find(a => a.id === dto.affiliationId)
                : p.affiliations.find(a => a.ente.toLowerCase() === ente);
            if (dto.affiliationId && !aff) throw new BadRequestException('Tesseramento non trovato nel tuo profilo');
            if (ente === 'fidal' && aff?.ente.toLowerCase() !== 'fidal') {
                throw new BadRequestException('Per questa gara serve un tesseramento FIDAL o Runcard nel profilo');
            }
            const raceDay = race.day.date;
            const athlete: AthleteSnapshot = {
                nome: normName(p.nome),
                cognome: normName(p.cognome),
                sesso: p.sesso,
                dataNascita: p.dataNascita,
                societa: aff?.societaNome ?? p.club,
                codiceSocieta: aff?.codiceSocieta,
                tessera: aff?.numeroTessera,
                email: user.email,
                fidalVerified: aff?.ente.toLowerCase() === 'fidal' && aff.source === 'fidal_db',
                certValid: p.certStatus === CertStatus.VERIFICATO && !!p.certExpiry && p.certExpiry >= raceDay,
            };
            return { athlete, athleteId: p.id, societyId: undefined };
        }

        if (!dto.athlete) throw new BadRequestException('Dati atleta mancanti');
        const a = dto.athlete;
        let societyId: string | undefined;
        let societa = a.societa;
        let codiceSocieta = a.codiceSocieta;
        if (user.role === Role.SOCIETY) {
            const s = await this.prisma.society.findUnique({ where: { accountId: user.sub } });
            if (!s) throw new BadRequestException('Profilo società non trovato');
            societyId = s.id;
            societa = s.societaNome;
            codiceSocieta = s.codiceFidal ?? codiceSocieta;
        }
        if (ente === 'fidal' && !a.tessera) throw new BadRequestException('Per questa gara serve la tessera FIDAL o Runcard');
        const athlete: AthleteSnapshot = {
            nome: normName(a.nome),
            cognome: normName(a.cognome),
            sesso: a.sesso,
            dataNascita: new Date(a.dataNascita),
            societa,
            codiceSocieta,
            tessera: a.tessera,
            email: a.email,
            // Solo lo staff può dichiarare "verificato" (es. dopo controllo WISE)
            fidalVerified: !!a.fidalVerified && user.role !== Role.SOCIETY,
            certValid: false,
        };
        return { athlete, athleteId: undefined, societyId };
    }

    // ─── Elenchi ────────────────────────────────────────────────────────────

    private where(raceId: string, q: ListQueryDto, onlyActive: boolean): Prisma.RegistrationWhereInput {
        const where: Prisma.RegistrationWhereInput = { raceId };
        if (onlyActive) where.paymentStatus = { not: PaymentStatus.REJECTED };
        if (q.paymentStatus) where.paymentStatus = q.paymentStatus as PaymentStatus;
        const text = q.q?.trim();
        if (text) {
            where.OR = [
                { cognome: { contains: text, mode: 'insensitive' } },
                { nome: { contains: text, mode: 'insensitive' } },
                { societa: { contains: text, mode: 'insensitive' } },
            ];
        }
        return where;
    }

    /**
     * Elenco iscritti PUBBLICO, paginato. Espone solo nome, società e le
     * colonne/campi che l'admin ha reso pubblici sulla gara (publicColumns /
     * publicFields). Niente email, date di nascita, tessere.
     */
    async publicList(raceId: string, q: ListQueryDto) {
        const race = await this.race(raceId);
        const page = q.page ?? 1;
        const pageSize = Math.min(q.pageSize ?? 50, 100);
        const where = this.where(raceId, { q: q.q }, true);
        const [total, rows] = await Promise.all([
            this.prisma.registration.count({ where }),
            this.prisma.registration.findMany({
                where,
                orderBy: [{ cognome: 'asc' }, { nome: 'asc' }],
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
        ]);
        const cols = new Set(race.publicColumns);
        const fields = race.publicFields;
        return {
            total,
            page,
            pageSize,
            columns: race.publicColumns,
            items: rows.map(r => {
                const fd = (r.formData ?? {}) as Record<string, unknown>;
                return {
                    cognome: r.cognome,
                    nome: r.nome,
                    societa: r.societa,
                    ...(cols.has('category') ? { categoria: r.assignedCategory } : {}),
                    ...(cols.has('payment') ? { pagamento: r.paymentStatus } : {}),
                    ...(cols.has('cert') ? { certificato: r.certStatus } : {}),
                    ...(fields.length ? { campi: Object.fromEntries(fields.map(f => [f, fd[f] ?? null])) } : {}),
                };
            }),
        };
    }

    /** Elenco completo per admin / organizzatore. */
    async staffList(user: AuthUser, raceId: string, q: ListQueryDto) {
        const race = await this.race(raceId);
        await this.assertCanManage(user, race.day.event.id, race.day.event.createdById);
        const page = q.page ?? 1;
        const pageSize = q.pageSize ?? 50;
        const where = this.where(raceId, q, false);
        const [total, items] = await Promise.all([
            this.prisma.registration.count({ where }),
            this.prisma.registration.findMany({
                where,
                orderBy: [{ cognome: 'asc' }, { nome: 'asc' }],
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
        ]);
        return { total, page, pageSize, items };
    }

    /** Tutte le iscrizioni attive della gara (per l'export). */
    async exportRows(user: AuthUser, raceId: string) {
        const race = await this.race(raceId);
        await this.assertCanManage(user, race.day.event.id, race.day.event.createdById);
        const rows = await this.prisma.registration.findMany({
            where: { raceId, paymentStatus: { not: PaymentStatus.REJECTED } },
            orderBy: [{ cognome: 'asc' }, { nome: 'asc' }],
        });
        return { race, rows };
    }

    /** Le iscrizioni dell'utente: atleta (le sue) o società (dei suoi atleti). */
    async mine(user: AuthUser) {
        let where: Prisma.RegistrationWhereInput;
        if (user.role === Role.ATHLETE) {
            const p = await this.prisma.athleteProfile.findUnique({ where: { accountId: user.sub } });
            where = { athleteId: p?.id ?? '__none__' };
        } else if (user.role === Role.SOCIETY) {
            const s = await this.prisma.society.findUnique({ where: { accountId: user.sub } });
            where = { societyId: s?.id ?? '__none__' };
        } else {
            where = { createdById: user.sub };
        }
        return this.prisma.registration.findMany({
            where,
            orderBy: { submittedAt: 'desc' },
            include: { race: { select: { name: true, distance: true, day: { select: { date: true, event: { select: { title: true, slug: true } } } } } } },
        });
    }

    // ─── Verifica pubblica ─────────────────────────────────────────────────

    /** Sul modello Endu: cognome + data di nascita → stato delle iscrizioni all'evento. */
    async verify(eventSlug: string, dto: VerifyDto) {
        const event = await this.prisma.event.findUnique({ where: { slug: eventSlug }, select: { id: true } });
        if (!event) throw new NotFoundException('Evento non trovato');
        const rows = await this.prisma.registration.findMany({
            where: {
                eventId: event.id,
                cognome: normName(dto.cognome),
                dataNascita: new Date(dto.dataNascita),
            },
            include: { race: { select: { name: true } } },
        });
        return rows.map(r => ({
            gara: r.race.name,
            nome: `${r.cognome} ${r.nome}`,
            societa: r.societa,
            categoria: r.assignedCategory,
            pagamento: r.paymentStatus,
            certificato: r.certStatus,
            iscrittoIl: r.submittedAt,
        }));
    }

    // ─── Aggiornamenti staff ────────────────────────────────────────────────

    private async regForStaff(user: AuthUser, id: string) {
        const reg = await this.prisma.registration.findUnique({
            where: { id },
            include: { race: { include: { day: { include: { event: true } } } } },
        });
        if (!reg) throw new NotFoundException('Iscrizione non trovata');
        await this.assertCanManage(user, reg.eventId, reg.race.day.event.createdById);
        return reg;
    }

    async setPayment(user: AuthUser, id: string, paymentStatus: PaymentStatus) {
        await this.regForStaff(user, id);
        return this.prisma.registration.update({ where: { id }, data: { paymentStatus } });
    }

    async setCert(user: AuthUser, id: string, certStatus: CertStatus) {
        await this.regForStaff(user, id);
        return this.prisma.registration.update({ where: { id }, data: { certStatus } });
    }
}
