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
    chiusuraProblem,
    limiteSocietaProblem,
    ammessiGara,
    checkTesseramento,
    richiedeFidalVerificato,
    tesseramentoDaEnte,
    Tesseramento,
    normName,
    quote,
    sportAge,
    todayRome,
    TESTO_MINORI_STANDARD, etaAnagrafica, minoreProblem,
} from './rules';
import { CreateRegistrationDto, ListQueryDto, VerifyDto } from './registrations.dto';
import { newManageToken, newPaymentRef } from '../payments/payment-ref';
import { METODO_COMBINATA, allineaCombinata, combinateEvento, prezzoAggiunta } from './combinata';
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

export interface AthleteSnapshot {
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
    /** Tesseramento con cui si iscrive. */
    tesseramento: Tesseramento;
    /** Tessera trovata a FIDAL con lo stesso cognome e data di nascita (anche con certificato scaduto). */
    fidalTrovato: boolean;
}

const json = <T>(v: Prisma.JsonValue | null | undefined): T | undefined => (v ?? undefined) as unknown as T;

/**
 * Il codice del link "gestisci iscrizione" non esce mai dalle API: chi lo ha
 * (anche lo staff) potrebbe cedere o trasferire l'iscrizione al posto dell'atleta.
 */
export function senzaToken<T extends { manageToken?: string | null }>(r: T): Omit<T, 'manageToken'> {
    const { manageToken: _t, ...rest } = r;
    void _t;
    return rest;
}

/** Dati preparati da RegistrationsService.prepare (senza importi). */
export interface PreparedRegistration {
    athlete: AthleteSnapshot;
    athleteId?: string;
    societyId?: string;
    category: RaceCategory | null;
    formData: Record<string, string | boolean>;
    certStatus: CertStatus;
    /** Minorenne: dichiarazione del genitore (se la gara la chiede). */
    genitore?: { nome: string; cognome: string; testo: string; at: string } | null;
}

/** Anagrafica "fotografata" di un'iscrizione (gli importi li aggiunge chi crea). */
export function snapshotData(race: { id: string; day: { event: { id: string } } }, p: PreparedRegistration) {
    const a = p.athlete;
    return {
        raceId: race.id,
        eventId: race.day.event.id,
        athleteId: p.athleteId,
        societyId: p.societyId,
        nome: a.nome,
        cognome: a.cognome,
        sesso: a.sesso,
        dataNascita: a.dataNascita,
        societa: a.societa,
        codiceSocieta: a.codiceSocieta,
        tessera: a.tessera,
        tesseramento: a.tesseramento,
        email: a.email,
        formData: p.formData as Prisma.InputJsonValue,
        assignedCategory: p.category?.name,
        fidalVerified: a.fidalVerified,
        certStatus: p.certStatus,
        genitore: p.genitore ? (p.genitore as unknown as Prisma.InputJsonValue) : undefined,
        manageToken: newManageToken(),
    };
}

/** Massimo di atleti per società sulla gara (iscrizioni fatte dalla società). */
export async function assertSocietyLimit(
    tx: Prisma.TransactionClient, race: { id: string; maxPerSocieta: number }, societyId: string | undefined | null, nuovi: number,
) {
    if (!societyId || !race.maxPerSocieta) return;
    const gia = await tx.registration.count({ where: { raceId: race.id, societyId, paymentStatus: { not: PaymentStatus.REJECTED } } });
    const msg = limiteSocietaProblem(race.maxPerSocieta, gia, nuovi);
    if (msg) throw new ConflictException(msg);
}

/** Stessa persona già iscritta (attiva) alla gara. */
export function findDuplicate(
    tx: Prisma.TransactionClient, raceId: string, a: { cognome: string; nome: string; dataNascita: Date | null },
) {
    return tx.registration.findFirst({
        where: {
            raceId, cognome: a.cognome, nome: a.nome, dataNascita: a.dataNascita,
            paymentStatus: { not: PaymentStatus.REJECTED },
        },
        select: { id: true },
    });
}

/**
 * Tesseramento di chi si iscrive senza profilo atleta (ospite, società, staff):
 * quello dichiarato, altrimenti ricavato da tessera e campi del modulo.
 */
export function guessTesseramento(
    dichiarato: Tesseramento | undefined,
    fidalTrovato: boolean,
    formData: Record<string, unknown> | undefined,
    schema: { id: string; catalogKey?: string }[],
    haTessera: boolean,
    societyEnte?: string,
): Tesseramento {
    if (dichiarato) return dichiarato;
    if (fidalTrovato) return 'fidal';
    const filled = (key: string) => schema.some(f => f.catalogKey === key && String(formData?.[f.id] ?? '').trim() !== '');
    if (filled('tessera_fidal')) return 'fidal';
    if (filled('tessera_runcard')) return 'runcard';
    if (schema.some(f => f.catalogKey?.startsWith('tessera_') && String(formData?.[f.id] ?? '').trim() !== '')) return 'eps';
    if (societyEnte) return tesseramentoDaEnte(societyEnte);
    return haTessera ? 'fidal' : 'libero';
}

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
            discountMessage = discountProblem(d, new Date(), race.day.event.id, race.day.event.edizionePrecedenteId) ?? undefined;
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

    /**
     * Metodo di pagamento: lo staff registra a mano (contanti, già pagato…);
     * l'atleta sceglie tra quelli ammessi dalla gara ("online" = PayPal/carta).
     */
    private chooseMethod(race: { paymentMode: string | null }, isStaff: boolean, wantedRaw?: string): PayMethod {
        if (isStaff) return 'manual';
        const allowed = allowedMethods(race.paymentMode);
        // "manual" ha senso solo per lo staff: per gli altri vale il metodo predefinito della gara
        const raw = wantedRaw === 'manual' ? undefined : wantedRaw;
        const wanted = (raw === 'online' ? 'paypal' : raw) as PayMethod | undefined;
        const method = wanted ?? allowed[0];
        if (!allowed.includes(method)) throw new BadRequestException('Metodo di pagamento non ammesso per questa gara');
        return method;
    }

    /**
     * Iscrizione a una combinata: una quota sola per più gare dell'evento. Si
     * paga sull'iscrizione "principale" (prima gara nuova); le altre la seguono.
     * Chi è già iscritto ad alcune gare della combinata paga solo la differenza.
     * Stessi controlli dell'iscrizione singola, gara per gara.
     */
    private async createCombinata(user: AuthUser | undefined, dto: CreateRegistrationDto, race: RaceWithEvent, isStaff: boolean) {
        const event = race.day.event;
        const combo = combinateEvento(event.combinate).find(c => c.id === dto.combinataId);
        if (!combo || !combo.raceIds.includes(race.id)) throw new BadRequestException('Combinata non trovata per questa gara');
        if (dto.discountCode?.trim()) throw new BadRequestException('I codici sconto non valgono sulla combinata');
        const races = await Promise.all(combo.raceIds.map(id => this.race(id)));
        if (races.some(r => r.day.event.id !== event.id)) throw new BadRequestException('Combinata non valida');
        for (const r of races) await this.assertCanRegister(user, r);

        // Controlli gara per gara (età, tesseramenti, modulo, certificato)
        const prep = [] as (Awaited<ReturnType<RegistrationsService['prepare']>> & { race: RaceWithEvent })[];
        for (const r of races) {
            try {
                prep.push({ ...(await this.prepare(user, r, { ...dto, raceId: r.id }, isStaff)), race: r });
            } catch (e) {
                if (e instanceof BadRequestException) throw new BadRequestException(`${r.name}: ${e.message}`);
                throw e;
            }
        }
        const method = this.chooseMethod(races[0], isStaff, dto.paymentMethod);
        const commissions = {
            global: await this.settings.commission(),
            event: json<CommissionConfig>(event.commission),
            race: json<CommissionConfig>(races[0].commission),
        };
        const fees = await this.settings.payments();

        const created = await this.prisma.$transaction(async tx => {
            for (const id of [...combo.raceIds].sort()) {
                await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))::text`;
            }
            // Gare a cui la persona è già iscritta: si paga la differenza
            const existing = new Map<string, { id: string; basePrice: number; discountAmount: number }>();
            for (const p of prep) {
                const d = await tx.registration.findFirst({
                    where: {
                        raceId: p.race.id, cognome: p.athlete.cognome, nome: p.athlete.nome, dataNascita: p.athlete.dataNascita,
                        paymentStatus: { not: PaymentStatus.REJECTED },
                    },
                    select: {
                        id: true, basePrice: true, discountAmount: true, combinataId: true, paymentStatus: true,
                        athleteId: true, societyId: true, groupId: true,
                    },
                });
                if (d?.combinataId === combo.id) throw new ConflictException('Atleta già iscritto a questa combinata');
                if (d) {
                    // Si aggiunge la combinata solo alla propria iscrizione (stesso account
                    // atleta o stessa società), già pagata: niente sconti su quote non incassate
                    const mine = isStaff
                        || (!!p.athleteId && d.athleteId === p.athleteId)
                        || (!!p.societyId && d.societyId === p.societyId);
                    if (!mine) {
                        throw new ConflictException(`Risulti già iscritto a ${p.race.name}: per aggiungere la combinata accedi con il tuo account o scrivi alla segreteria`);
                    }
                    if (d.paymentStatus !== PaymentStatus.CONFIRMED || d.groupId) {
                        throw new ConflictException(`Iscrizione a ${p.race.name} non ancora pagata (o di gruppo): completa prima il pagamento o scrivi alla segreteria`);
                    }
                    existing.set(p.race.id, d);
                }
            }
            const nuove = prep.filter(p => !existing.has(p.race.id));
            if (!nuove.length) throw new ConflictException('Atleta già iscritto a tutte le gare della combinata');
            for (const p of nuove) {
                if (p.race.maxParticipants > 0) {
                    const count = await tx.registration.count({ where: { raceId: p.race.id, paymentStatus: { not: PaymentStatus.REJECTED } } });
                    if (count >= p.race.maxParticipants) throw new ConflictException(`${p.race.name}: gara al completo, combinata non disponibile`);
                }
                await assertSocietyLimit(tx, p.race, p.societyId, 1);
            }
            const giaPagato = [...existing.values()].reduce((t, r) => t + r.basePrice - r.discountAmount, 0);
            const q = quote({
                basePrice: prezzoAggiunta(combo.prezzo, giaPagato), steps: null, discount: null,
                commissions, today: todayRome(), method, fees,
            });
            let paymentStatus: PaymentStatus = PaymentStatus.PENDING;
            let paymentMethod: string = method;
            if (q.total === 0) { paymentStatus = PaymentStatus.CONFIRMED; paymentMethod = 'free'; }
            else if (isStaff && dto.markPaid) paymentStatus = PaymentStatus.CONFIRMED;
            const paidAt = paymentStatus === PaymentStatus.CONFIRMED ? new Date() : null;
            const needsRef = paymentStatus === PaymentStatus.PENDING && paymentMethod !== 'manual';

            const [first, ...rest] = nuove;
            const parent = await tx.registration.create({
                data: {
                    ...snapshotData(first.race, first),
                    basePrice: q.price, discountAmount: 0, commissionAmount: q.commission, paymentFee: q.paymentFee, pricePaid: q.total,
                    paymentRef: needsRef ? newPaymentRef() : null,
                    paymentMethod, paymentStatus, paidAt,
                    combinataId: combo.id,
                    addedByOrganizer: isStaff, createdById: user?.sub,
                },
            });
            for (const p of rest) {
                await tx.registration.create({
                    data: {
                        ...snapshotData(p.race, p),
                        basePrice: 0, discountAmount: 0, commissionAmount: 0, paymentFee: 0, pricePaid: 0,
                        paymentMethod: paymentMethod === 'free' ? 'free' : METODO_COMBINATA,
                        paymentStatus, paidAt,
                        combinataId: combo.id, combinataParentId: parent.id,
                        addedByOrganizer: isStaff, createdById: user?.sub,
                    },
                });
            }
            if (existing.size) {
                await tx.registration.updateMany({ where: { id: { in: [...existing.values()].map(r => r.id) } }, data: { combinataId: combo.id } });
            }
            return {
                registration: senzaToken(parent), quote: q,
                combinata: { id: combo.id, nome: combo.nome, gare: nuove.map(p => p.race.name), giaIscritto: existing.size > 0 },
                ageWarning: prep.map(p => p.ageProblem).find(Boolean) ?? undefined,
                tesseramentoWarning: prep.map(p => p.tessProblem).find(Boolean) ?? undefined,
            };
        });
        await this.mailer.confirmation(created.registration.id);
        return created;
    }

    /** Gara letta con evento (per altri moduli, es. iscrizioni di gruppo). */
    getRace(raceId: string): Promise<RaceWithEvent> {
        return this.race(raceId);
    }

    /** Iscrizioni aperte (lo staff può sempre); restituisce se chi iscrive è staff dell'evento. */
    async assertCanRegister(user: AuthUser | undefined, race: RaceWithEvent): Promise<boolean> {
        const event = race.day.event;
        const isStaff = !!user && (user.role === Role.ADMIN || user.role === Role.ORGANIZER);
        if (isStaff) await this.assertCanManage(user!, event.id, event.createdById);
        if (!race.isOpen && !isStaff) throw new BadRequestException('Iscrizioni chiuse per questa gara');
        // Chiusura a data e ora: dopo, le iscrizioni le fa solo l'admin
        const chiusa = chiusuraProblem(race.chiusuraIscrizioni);
        if (chiusa && user?.role !== Role.ADMIN) throw new BadRequestException(chiusa);
        // Gara già disputata: niente iscrizioni (lo staff può ancora registrare a posteriori)
        if (!isStaff && race.day.date.toISOString().slice(0, 10) < todayRome()) {
            throw new BadRequestException('La gara si è già svolta: iscrizioni chiuse');
        }
        return isStaff;
    }

    /**
     * Controlli e dati di un'iscrizione, senza scrivere nulla: anagrafica, età,
     * tesseramento, categoria, modulo, certificato. Usato dall'iscrizione singola
     * e da quella di gruppo, così le regole restano in un punto solo.
     * `consensiSocieta`: la società dichiara di aver raccolto i consensi (caselle obbligatorie).
     */
    async prepare(
        user: AuthUser | undefined, race: RaceWithEvent, dto: CreateRegistrationDto, isStaff: boolean,
        opts: { consensiSocieta?: boolean } = {},
    ) {
        if (opts.consensiSocieta) {
            const fd: Record<string, string | boolean> = { ...(dto.formData ?? {}) };
            for (const f of json<FormFieldDef[]>(race.formSchema) ?? []) {
                if (f.required && f.type === 'checkbox' && fd[f.id] === undefined) fd[f.id] = true;
            }
            dto = { ...dto, formData: fd };
        }
        const { athlete, athleteId, societyId } = await this.resolveAthlete(user, race, dto);

        // Età e categoria (età "sportiva": anno gara − anno nascita)
        const age = sportAge(athlete.dataNascita, race.day.date);
        const ageProblem = checkAge(age, race.minAge, race.maxAge);
        if (ageProblem && !isStaff) throw new BadRequestException(ageProblem);

        // Tesseramenti ammessi dalla gara (es. solo FIDAL, FIDAL + Runcard)
        const ammessi = ammessiGara(race);
        let tessProblem = checkTesseramento(athlete.tesseramento, ammessi);
        if (!tessProblem && athlete.tesseramento === 'fidal' && richiedeFidalVerificato(ammessi) && !athlete.fidalTrovato) {
            tessProblem = 'Questa gara è riservata ai tesserati FIDAL: la tessera non risulta a FIDAL con questo cognome e '
                + 'questa data di nascita. Controlla i dati o scrivi alla segreteria.';
        }
        if (tessProblem && !isStaff) throw new BadRequestException(tessProblem);
        const category = assignCategory(json<RaceCategory[]>(race.categories), age, athlete.sesso);

        // Minorenni: dichiarazione del genitore, se la gara la chiede (non se iscrive la società o lo staff)
        const minore = etaAnagrafica(athlete.dataNascita, race.day.date) < 18;
        const minProblem = minoreProblem({
            eta: etaAnagrafica(athlete.dataNascita, race.day.date), richiesta: race.dichiarazioneMinori,
            viaSocieta: !!societyId, staff: isStaff, genitore: dto.genitore,
        });
        if (minProblem) throw new BadRequestException(minProblem);
        const genitore = minore && race.dichiarazioneMinori && dto.genitore && !societyId && !isStaff
            ? {
                nome: dto.genitore.nome.trim(), cognome: dto.genitore.cognome.trim(),
                testo: race.testoMinori?.trim() || TESTO_MINORI_STANDARD, at: new Date().toISOString(),
            }
            : null;

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

        return { athlete, athleteId, societyId, ageProblem, tessProblem, category, formData, certStatus, genitore };
    }

    async create(user: AuthUser | undefined, dto: CreateRegistrationDto) {
        const race = await this.race(dto.raceId);
        const event = race.day.event;
        const isStaff = await this.assertCanRegister(user, race);
        if (dto.combinataId) return this.createCombinata(user, dto, race, isStaff);
        const { athlete, athleteId, societyId, ageProblem, tessProblem, category, formData, certStatus, genitore } =
            await this.prepare(user, race, dto, isStaff);
        const method = this.chooseMethod(race, isStaff, dto.paymentMethod);

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

            const dup = await findDuplicate(tx, race.id, athlete);
            if (dup) throw new ConflictException('Atleta già iscritto a questa gara');
            await assertSocietyLimit(tx, race, societyId, 1);

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
                    ...snapshotData(race, { athlete, athleteId, societyId, category, formData, certStatus, genitore }),
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
                    addedByOrganizer: isStaff,
                    createdById: user?.sub,
                },
            });
            return {
                registration: senzaToken(reg), quote: q,
                ageWarning: ageProblem ?? undefined,
                tesseramentoWarning: tessProblem ?? undefined,
            };
        });
        // Email di conferma con i dati per pagare (in coda: non rallenta né blocca l'iscrizione)
        await this.mailer.confirmation(created.registration.id);
        return created;
    }

    /** Tessera confermata su FIDAL per quella persona e certificato valido alla data gara. */
    private async fidalCheck(
        tessera: string, cognome: string, dataNascita: string, raceDay: Date,
    ): Promise<{ ok: boolean; found: boolean; societa?: string; codiceSocieta?: string }> {
        try {
            const r = await this.fidal.verifyByTessera(tessera.trim());
            const at = r.atleta;
            if (!at || normName(at.cognome) !== normName(cognome) || at.dataNascita !== dataNascita.slice(0, 10)) return { ok: false, found: false };
            const certOk = !at.certScadenza || at.certScadenza >= raceDay.toISOString().slice(0, 10);
            // La società risulta comunque da FIDAL anche se il certificato è scaduto
            return { ok: certOk, found: true, societa: at.societa || undefined, codiceSocieta: at.codiceSocieta || undefined };
        } catch {
            return { ok: false, found: false }; // FIDAL non raggiungibile: non verificato (certificato da controllare)
        }
    }

    /** Ricava l'anagrafica in base a chi sta iscrivendo. */
    private async resolveAthlete(user: AuthUser | undefined, race: RaceWithEvent, dto: CreateRegistrationDto) {
        const ammessi = ammessiGara(race);

        if (user?.role === Role.ATHLETE) {
            const p = await this.prisma.athleteProfile.findUnique({
                where: { accountId: user.sub },
                include: { affiliations: true },
            });
            if (!p) throw new BadRequestException('Completa il tuo profilo atleta prima di iscriverti');
            // Tesseramento scelto, altrimenti il primo ammesso dalla gara (FIDAL per primo)
            const ordered = [...p.affiliations].sort((a, b) =>
                Number(tesseramentoDaEnte(b.ente) === 'fidal') - Number(tesseramentoDaEnte(a.ente) === 'fidal'));
            const aff = dto.affiliationId
                ? p.affiliations.find(a => a.id === dto.affiliationId)
                : ordered.find(a => !ammessi.length || ammessi.includes(tesseramentoDaEnte(a.ente, a.societaNome)));
            if (dto.affiliationId && !aff) throw new BadRequestException('Tesseramento non trovato nel tuo profilo');
            const tesseramento: Tesseramento = aff ? tesseramentoDaEnte(aff.ente, aff.societaNome) : 'libero';
            const raceDay = race.day.date;
            // Gara solo FIDAL: la tessera deve risultare a FIDAL (già confermata nel profilo o verificata ora)
            let fidalTrovato = tesseramento === 'fidal' && aff?.source === 'fidal_db';
            if (tesseramento === 'fidal' && !fidalTrovato && richiedeFidalVerificato(ammessi) && aff?.numeroTessera) {
                fidalTrovato = (await this.fidalCheck(aff.numeroTessera, p.cognome, p.dataNascita.toISOString(), raceDay)).found;
            }
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
                tesseramento,
                fidalTrovato,
            };
            return { athlete, athleteId: p.id, societyId: undefined };
        }

        if (!dto.athlete) throw new BadRequestException('Dati atleta mancanti');
        const a = dto.athlete;
        if (!user && !a.email) throw new BadRequestException("Indica un'email per ricevere la conferma");
        let societyId: string | undefined;
        let societyEnte: string | undefined;
        let societa = a.societa;
        let codiceSocieta = a.codiceSocieta;
        if (user?.role === Role.SOCIETY) {
            const s = await this.prisma.society.findUnique({ where: { accountId: user.sub } });
            if (!s) throw new BadRequestException('Profilo società non trovato');
            societyId = s.id;
            societyEnte = s.ente;
            societa = s.societaNome;
            codiceSocieta = s.codiceFidal ?? codiceSocieta;
        }
        const isStaffUser = user?.role === Role.ADMIN || user?.role === Role.ORGANIZER;
        // Tessera verificata DAL SERVER (WISE/dump): stesso cognome e data di nascita,
        // certificato (se noto) valido alla data gara. Il browser non può dichiararlo.
        const check = a.tessera ? await this.fidalCheck(a.tessera, a.cognome, a.dataNascita, race.day.date) : { ok: false, found: false } as { ok: boolean; found: boolean; societa?: string; codiceSocieta?: string };
        const verified = check.ok;
        const tesseramento = guessTesseramento(a.tesseramento as Tesseramento | undefined, check.found,
            dto.formData, json<FormFieldDef[]>(race.formSchema) ?? [], !!a.tessera, societyEnte);
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
            tesseramento,
            // Lo staff può confermare la tessera dopo un controllo manuale
            fidalTrovato: check.found || (!!a.fidalVerified && isStaffUser),
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
            return def && !['file', 'email', 'tel', 'date'].includes(def.type) && !(def.catalogKey && NEVER_PUBLIC.has(def.catalogKey));
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
        return { total, page, pageSize, items: items.map(senzaToken) };
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
        const rows = await this.prisma.registration.findMany({
            where,
            orderBy: { submittedAt: 'desc' },
            include: { race: { select: { name: true, distance: true, day: { select: { date: true, event: { select: { title: true, slug: true } } } } } } },
        });
        return rows.map(senzaToken);
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
        if (reg.groupId) {
            throw new ConflictException('Iscrizione di un pagamento di gruppo della società: confermala o annullala dal gruppo (Pagamenti → Gruppi società)');
        }
        if (reg.trasferitoAt && paymentStatus !== PaymentStatus.REJECTED) {
            throw new ConflictException('Iscrizione trasferita all\'edizione dopo (credito già emesso): non si può riattivare');
        }
        if (reg.combinataParentId) {
            throw new ConflictException('Iscrizione compresa in una combinata: si gestisce dall\'iscrizione principale della combinata');
        }
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
        if (reg.paymentStatus === paymentStatus) return senzaToken(reg);
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
            await allineaCombinata(tx, [id], paymentStatus, paidAt);
            return tx.registration.findUniqueOrThrow({ where: { id } });
        });
        if (paymentStatus === PaymentStatus.CONFIRMED) await this.mailer.paymentReceived(id);
        if (paymentStatus === PaymentStatus.REJECTED) await this.mailer.cancelled(id, 'organizzazione');
        return senzaToken(updated);
    }

    async setCert(user: AuthUser, id: string, certStatus: CertStatus) {
        await this.regForStaff(user, id);
        return senzaToken(await this.prisma.registration.update({ where: { id }, data: { certStatus } }));
    }
}
