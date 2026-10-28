import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { CertStatus, PaymentStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { dateOnly } from '../common/validators';
import { SettingsService } from '../settings/settings.module';
import { AuthUser } from '../common/auth';
import { EventAccess } from '../common/access';
import { FidalService } from '../fidal/fidal.service';
import { RegistrationMailer } from '../mail/registration-mailer';
import { discountProblem, normCode } from '../discounts/discounts.module';
import {
    CommissionConfig,
    PayMethod,
    PriceStep,
    allowedMethods,
    RaceCategory,
    assignCategory,
    checkAge,
    normName,
    quote,
    sportAge,
    todayRome,
} from './rules';
import { CreateRegistrationDto, ListQueryDto, VerifyDto } from './registrations.dto';
import { newPaymentRef } from '../payments/payment-ref';
import { siteName } from '../common/brand';

/** Chiavi di catalogo che vengono dal profilo atleta, non dal modulo extra. */
const PROFILE_KEYS = new Set([
    'nome', 'cognome', 'data_nascita', 'anno_nascita', 'sesso', 'email', 'telefono', 'codice_fiscale',
    'societa', 'codice_societa', 'tessera_fidal', 'tessera_runcard', 'tessera_fci', 'tessera_csi',
    'tessera_uisp', 'tessera_fitri', 'tessera_fin', 'tipo_certificato', 'num_certificato',
    'scadenza_certificato', 'gruppo_sanguigno', 'upload_cert_medico', 'upload_tessera',
]);

/** Campi del modulo che non compaiono MAI nell'elenco pubblico degli iscritti. */
const NEVER_PUBLIC = new Set([
    'email', 'telefono', 'codice_fiscale', 'data_nascita', 'tessera_fidal', 'tessera_runcard', 'tessera_fci', 'tessera_csi',
    'tessera_uisp', 'tessera_fitri', 'tessera_fin', 'tipo_certificato', 'num_certificato', 'scadenza_certificato',
    'gruppo_sanguigno', 'upload_cert_medico', 'upload_tessera',
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

/** Tiene solo i campi del modulo della gara; testi tagliati a 500 caratteri. */
export function sanitizeFormData(
    data: Record<string, unknown> | undefined,
    schema: FormFieldDef[],
): Record<string, string | boolean> {
    const out: Record<string, string | boolean> = {};
    if (!data) return out;
    for (const f of schema.slice(0, 200)) {
        const v = data[f.id];
        if (typeof v === 'boolean') out[f.id] = v;
        else if (typeof v === 'string') out[f.id] = v.slice(0, 500);
        else if (typeof v === 'number' && Number.isFinite(v)) out[f.id] = String(v);
    }
    return out;
}

@Injectable()
export class RegistrationsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly settings: SettingsService,
        private readonly access: EventAccess,
        private readonly fidal: FidalService,
        private readonly mailer: RegistrationMailer,
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

    async quote(raceId: string, code?: string, method?: PayMethod) {
        const race = await this.race(raceId);
        let discount = null;
        let discountMessage: string | undefined;
        if (code?.trim()) {
            const d = await this.prisma.discountCode.findUnique({ where: { code: normCode(code) } });
            discountMessage = discountProblem(d, new Date(), race.day.event.id) ?? undefined;
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
            method,
            fees: await this.settings.payments(),
        });
        return { ...q, discountCode: discount?.code, discountMessage };
    }

    // ─── Creazione ──────────────────────────────────────────────────────────

    async create(user: AuthUser | undefined, dto: CreateRegistrationDto) {
        const race = await this.race(dto.raceId);
        const event = race.day.event;
        const isStaff = !!user && (user.role === Role.ADMIN || user.role === Role.ORGANIZER);
        if (isStaff) await this.assertCanManage(user!, event.id, event.createdById);
        if (!race.isOpen && !isStaff) throw new BadRequestException('Iscrizioni chiuse per questa gara');
        // Gara già disputata: niente iscrizioni (lo staff può ancora registrare a posteriori)
        if (!isStaff && race.day.date.toISOString().slice(0, 10) < todayRome()) {
            throw new BadRequestException('La gara si è già svolta: iscrizioni chiuse');
        }

        const { athlete, athleteId, societyId } = await this.resolveAthlete(user, race, dto);

        // Età e categoria (età "sportiva": anno gara − anno nascita)
        const age = sportAge(athlete.dataNascita, race.day.date);
        const ageProblem = checkAge(age, race.minAge, race.maxAge);
        if (ageProblem && !isStaff) throw new BadRequestException(ageProblem);
        const category = assignCategory(json<RaceCategory[]>(race.categories), age, athlete.sesso);

        // Modulo: si tengono SOLO i campi previsti dalla gara, con lunghezze limitate
        // (niente dati arbitrari o enormi nel database)
        const formData = sanitizeFormData(dto.formData, json<FormFieldDef[]>(race.formSchema) ?? []);
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

        // Metodo di pagamento: lo staff registra a mano (contanti, già pagato…);
        // l'atleta sceglie tra quelli ammessi dalla gara ("online" = PayPal/carta).
        const allowed = allowedMethods(race.paymentMode);
        let method: PayMethod;
        if (isStaff) {
            method = 'manual';
        } else {
            // "manual" ha senso solo per lo staff: per gli altri vale il metodo predefinito della gara
            const raw = dto.paymentMethod === 'manual' ? undefined : dto.paymentMethod;
            const wanted = (raw === 'online' ? 'paypal' : raw) as PayMethod | undefined;
            method = wanted ?? allowed[0];
            if (!allowed.includes(method)) throw new BadRequestException('Metodo di pagamento non ammesso per questa gara');
        }

        // Prezzo calcolato dal server (con l'eventuale maggiorazione del metodo)
        const q = await this.quote(race.id, dto.discountCode, method);
        if (dto.discountCode?.trim() && q.discountMessage) throw new BadRequestException(q.discountMessage);

        let paymentStatus: PaymentStatus = PaymentStatus.PENDING;
        let paymentMethod: string = method;
        if (q.total === 0) {
            paymentStatus = PaymentStatus.CONFIRMED;
            paymentMethod = 'free';
        } else if (isStaff && dto.markPaid) {
            paymentStatus = PaymentStatus.CONFIRMED;
        }
        const needsRef = paymentStatus === PaymentStatus.PENDING && paymentMethod !== 'manual';

        const created = await this.prisma.$transaction(async tx => {
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
                    paymentFee: q.paymentFee,
                    pricePaid: q.total,
                    paymentRef: needsRef ? newPaymentRef() : null,
                    paidAt: paymentStatus === PaymentStatus.CONFIRMED ? new Date() : null,
                    discountCode: q.discountCode,
                    paymentMethod,
                    paymentStatus,
                    assignedCategory: category?.name,
                    fidalVerified: athlete.fidalVerified,
                    addedByOrganizer: isStaff,
                    createdById: user?.sub,
                    certStatus,
                },
            });
            return { registration: reg, quote: q, ageWarning: ageProblem ?? undefined };
        });
        // Email di conferma con i dati per pagare (in coda: non rallenta né blocca l'iscrizione)
        await this.mailer.confirmation(created.registration.id);
        return created;
    }

    /** Tessera confermata su FIDAL per quella persona e certificato valido alla data gara. */
    private async fidalCheck(
        tessera: string, cognome: string, dataNascita: string, raceDay: Date,
    ): Promise<{ ok: boolean; societa?: string; codiceSocieta?: string }> {
        try {
            const r = await this.fidal.verifyByTessera(tessera.trim());
            const at = r.atleta;
            if (!at || normName(at.cognome) !== normName(cognome) || at.dataNascita !== dataNascita.slice(0, 10)) return { ok: false };
            const certOk = !at.certScadenza || at.certScadenza >= raceDay.toISOString().slice(0, 10);
            // La società risulta comunque da FIDAL anche se il certificato è scaduto
            return { ok: certOk, societa: at.societa || undefined, codiceSocieta: at.codiceSocieta || undefined };
        } catch {
            return { ok: false }; // FIDAL non raggiungibile: non verificato (certificato da controllare)
        }
    }

    /** Ricava l'anagrafica in base a chi sta iscrivendo. */
    private async resolveAthlete(user: AuthUser | undefined, race: RaceWithEvent, dto: CreateRegistrationDto) {
        const ente = (race.ente ?? '').toLowerCase();

        if (user?.role === Role.ATHLETE) {
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
                // Verificato su FIDAL e (se nota) scadenza certificato non prima della gara
                fidalVerified: aff?.ente.toLowerCase() === 'fidal' && aff.source === 'fidal_db'
                    && (!aff.certScadenza || aff.certScadenza >= raceDay),
                certValid: p.certStatus === CertStatus.VERIFICATO && !!p.certExpiry && p.certExpiry >= raceDay,
            };
            return { athlete, athleteId: p.id, societyId: undefined };
        }

        if (!dto.athlete) throw new BadRequestException('Dati atleta mancanti');
        const a = dto.athlete;
        if (!user && !a.email) throw new BadRequestException("Indica un'email per ricevere la conferma");
        let societyId: string | undefined;
        let societa = a.societa;
        let codiceSocieta = a.codiceSocieta;
        if (user?.role === Role.SOCIETY) {
            const s = await this.prisma.society.findUnique({ where: { accountId: user.sub } });
            if (!s) throw new BadRequestException('Profilo società non trovato');
            societyId = s.id;
            societa = s.societaNome;
            codiceSocieta = s.codiceFidal ?? codiceSocieta;
        }
        if (ente === 'fidal' && !a.tessera) throw new BadRequestException('Per questa gara serve la tessera FIDAL o Runcard');
        const isStaffUser = user?.role === Role.ADMIN || user?.role === Role.ORGANIZER;
        // Tessera verificata DAL SERVER (WISE/dump): stesso cognome e data di nascita,
        // certificato (se noto) valido alla data gara. Il browser non può dichiararlo.
        const check = a.tessera ? await this.fidalCheck(a.tessera, a.cognome, a.dataNascita, race.day.date) : { ok: false };
        const verified = check.ok;
        // Tessera confermata: società come risulta a FIDAL (non come scritta nel modulo)
        if (check.codiceSocieta && user?.role !== Role.SOCIETY) {
            societa = check.societa ?? societa;
            codiceSocieta = check.codiceSocieta;
        }
        const athlete: AthleteSnapshot = {
            nome: normName(a.nome),
            cognome: normName(a.cognome),
            sesso: a.sesso,
            dataNascita: dateOnly(a.dataNascita),
            societa,
            codiceSocieta,
            tessera: a.tessera,
            email: a.email,
            // Verifica del server, oppure dichiarazione dello staff (es. controllo manuale)
            fidalVerified: verified || (!!a.fidalVerified && isStaffUser),
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
        // Mai pubblici, anche se scelti per errore: contatti, documenti e dati sanitari
        const schema = json<FormFieldDef[]>(race.formSchema) ?? [];
        const fields = race.publicFields.filter(f => {
            const def = schema.find(x => x.id === f);
            return def && def.type !== 'file' && !(def.catalogKey && NEVER_PUBLIC.has(def.catalogKey));
        });
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
                dataNascita: dateOnly(dto.dataNascita),
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

    /**
     * Cambio stato pagamento dallo staff.
     * - PayPal/carta e bonifico: i soldi arrivano alla segreteria del sito → li conferma SOLO l'admin
     *   (un organizzatore non può "confermare" denaro che la segreteria non ha ricevuto).
     *   L'organizzatore può però ANNULLARE un'iscrizione online ancora non pagata
     *   (es. posti occupati da iscrizioni mai pagate).
     * - Riattivare un'iscrizione annullata ricontrolla i posti e il codice sconto.
     * - Annullare restituisce l'uso del codice sconto.
     * - Tutto avviene solo se l'iscrizione è ancora com'era quando l'abbiamo letta.
     */
    async setPayment(user: AuthUser, id: string, paymentStatus: PaymentStatus) {
        const reg = await this.regForStaff(user, id);
        const online = reg.paymentMethod === 'paypal' || reg.paymentMethod === 'bank';
        if (user.role !== Role.ADMIN && online) {
            const rejectUnpaid = reg.paymentStatus === PaymentStatus.PENDING && paymentStatus === PaymentStatus.REJECTED;
            if (!rejectUnpaid) {
                throw new ForbiddenException(`I pagamenti PayPal/carta e bonifico li gestisce solo la segreteria ${siteName()}`);
            }
            // Solo dopo il termine per il bonifico (+2 giorni di accredito): prima il
            // pagamento potrebbe essere già partito e arrivare alla segreteria
            const p = await this.settings.payments();
            const termine = reg.submittedAt.getTime() + (p.bankDays + 2) * 24 * 60 * 60_000;
            if (Date.now() < termine) {
                throw new ForbiddenException(
                    `Pagamento ancora nei termini: potrai annullarla dal ${new Date(termine).toLocaleDateString('it-IT', { timeZone: 'Europe/Rome' })} (oppure chiedi alla segreteria ${siteName()})`,
                );
            }
        }
        if (reg.paymentStatus === paymentStatus) return reg;
        const paidAt = paymentStatus === PaymentStatus.CONFIRMED ? reg.paidAt ?? new Date() : null;
        const updated = await this.prisma.$transaction(async tx => {
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${reg.raceId}))::text`;
            const wasRejected = reg.paymentStatus === PaymentStatus.REJECTED;
            const toRejected = paymentStatus === PaymentStatus.REJECTED;
            if (wasRejected && reg.race.maxParticipants > 0) {
                const count = await tx.registration.count({
                    where: { raceId: reg.raceId, paymentStatus: { not: PaymentStatus.REJECTED } },
                });
                if (count >= reg.race.maxParticipants) throw new ConflictException('Gara al completo: impossibile riattivare');
            }
            if (reg.discountCode && toRejected) {
                await tx.discountCode.updateMany({
                    where: { code: reg.discountCode, usedCount: { gt: 0 } },
                    data: { usedCount: { decrement: 1 } },
                });
            }
            if (reg.discountCode && wasRejected) {
                // Riattivazione: il codice deve essere ancora utilizzabile
                const d = await tx.discountCode.findUnique({ where: { code: reg.discountCode } });
                const ok = d && d.isActive && (!d.expiresAt || d.expiresAt >= new Date()) && (d.maxUses == null || d.usedCount < d.maxUses);
                if (!ok) throw new ConflictException('Il codice sconto di questa iscrizione è esaurito o scaduto: impossibile riattivarla');
                await tx.discountCode.update({ where: { code: reg.discountCode }, data: { usedCount: { increment: 1 } } });
            }
            // Aggiorna solo se nessuno l'ha cambiata nel frattempo (es. pagamento PayPal in corso)
            const r = await tx.registration.updateMany({
                where: { id, paymentStatus: reg.paymentStatus, paymentMethod: reg.paymentMethod },
                data: { paymentStatus, paidAt },
            });
            if (r.count === 0) throw new ConflictException('L\'iscrizione è cambiata nel frattempo: ricarica la pagina e riprova');
            return tx.registration.findUniqueOrThrow({ where: { id } });
        });
        if (paymentStatus === PaymentStatus.CONFIRMED) await this.mailer.paymentReceived(id);
        if (paymentStatus === PaymentStatus.REJECTED) await this.mailer.cancelled(id, 'organizzazione');
        return updated;
    }

    async setCert(user: AuthUser, id: string, certStatus: CertStatus) {
        await this.regForStaff(user, id);
        return this.prisma.registration.update({ where: { id }, data: { certStatus } });
    }
}
