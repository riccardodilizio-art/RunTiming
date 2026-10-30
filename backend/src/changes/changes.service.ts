import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CertStatus, PaymentStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.module';
import { MailService } from '../mail/mail.service';
import { RegistrationMailer } from '../mail/registration-mailer';
import { allineaCombinata } from '../registrations/combinata';
import { changeAppliedMail, changeCededMail } from '../mail/templates';
import { AuthUser } from '../common/auth';
import { newManageToken, newPaymentRef } from '../payments/payment-ref';
import { RegistrationsService, assertSocietyLimit, findDuplicate } from '../registrations/registrations.service';
import { PayMethod, TESTO_MINORI_STANDARD, activePrice, allowedMethods, chiusuraProblem, normName, paymentFee, todayRome } from '../registrations/rules';
import { TipoCambio, codiceCredito, creditoTrasferimento, differenzaGara, quotaPagata, quoteCambi, ritiroProblem } from './change.rules';
import { ChangeDto } from './changes.dto';

type RegFull = Prisma.RegistrationGetPayload<{ include: { race: { include: { day: { include: { event: true } } } } } }>;
const include = { race: { include: { day: { include: { event: true } } } } } as const;

/** Chi chiede il cambio: utente con login, oppure chi ha il link personale (codice). */
export interface Actor {
    user?: AuthUser;
    token?: string;
}

/** Dati salvati nel cambio, applicati quando arriva il pagamento. */
interface DatiCambio {
    raceId?: string;
    /** Cambio gara di un'iscrizione non ancora pagata (si paga sul posto): nuova quota, niente differenza. */
    riprezza?: { basePrice: number; commissionAmount: number; pricePaid: number };
    raceName?: string;
    categoria?: string | null;
    certStatus?: CertStatus | null;
    athlete?: {
        nome: string; cognome: string; sesso: string; dataNascita: string;
        societa?: string | null; codiceSocieta?: string | null; tessera?: string | null; tesseramento?: string;
        email?: string | null; fidalVerified: boolean;
    };
    formData?: Record<string, string | boolean>;
    /** Cessione a un minorenne: dichiarazione del genitore. */
    genitore?: { nome: string; cognome: string; testo: string; at: string } | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const json = <T>(v: Prisma.JsonValue | null | undefined): T => (v ?? {}) as unknown as T;

/** Campi anagrafici del modulo: nella cessione si sostituiscono con quelli del nuovo atleta. */
const ANAGRAFICA = new Set(['nome', 'cognome', 'data_nascita', 'anno_nascita', 'sesso', 'email', 'telefono', 'codice_fiscale',
    'societa', 'codice_societa', 'tessera_fidal', 'tessera_runcard', 'tessera_fci', 'tessera_csi', 'tessera_uisp', 'tessera_fitri',
    'tessera_fin', 'tipo_certificato', 'num_certificato', 'scadenza_certificato', 'upload_cert_medico', 'upload_tessera']);

/**
 * Cambi dopo l'iscrizione, fatti dall'atleta (area atleta, area società o link
 * personale nell'email) fino alla chiusura delle iscrizioni; dopo, solo l'admin.
 * Le regole dell'iscrizione (età, tesseramenti, posti, doppioni) valgono anche qui.
 */
@Injectable()
export class ChangesService {
    private readonly log = new Logger(ChangesService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly regs: RegistrationsService,
        private readonly settings: SettingsService,
        private readonly mail: MailService,
        private readonly mailer: RegistrationMailer,
    ) {}

    // ─── Chi può fare cosa ──────────────────────────────────────────────────

    async load(actor: Actor, id?: string): Promise<RegFull> {
        const reg = actor.token
            ? await this.prisma.registration.findUnique({ where: { manageToken: actor.token }, include })
            : await this.prisma.registration.findUnique({ where: { id: id ?? '' }, include });
        if (!reg) throw new NotFoundException('Iscrizione non trovata');
        if (actor.token) return reg;
        const u = actor.user;
        if (!u) throw new ForbiddenException();
        if (u.role === Role.ADMIN) return reg;
        if (u.role === Role.ATHLETE) {
            const p = await this.prisma.athleteProfile.findUnique({ where: { accountId: u.sub }, select: { id: true } });
            if (p && reg.athleteId === p.id) return reg;
        }
        if (u.role === Role.SOCIETY) {
            const s = await this.prisma.society.findUnique({ where: { accountId: u.sub }, select: { id: true } });
            if (s && reg.societyId === s.id) return reg;
        }
        throw new ForbiddenException('Non puoi modificare questa iscrizione');
    }

    private isAdmin(actor: Actor) {
        return actor.user?.role === Role.ADMIN;
    }

    /** Motivo per cui i cambi non sono possibili (null = possibili). */
    private closedReason(reg: RegFull, actor: Actor): string | null {
        if (reg.paymentStatus === PaymentStatus.REJECTED) return 'Iscrizione annullata';
        if (reg.combinataId) return 'Iscrizione in una combinata: per i cambi scrivi alla segreteria';
        if (this.isAdmin(actor)) return null;
        if (reg.race.day.date.toISOString().slice(0, 10) < todayRome()) return 'La gara si è già svolta';
        if (!reg.race.isOpen) return 'Iscrizioni chiuse: per i cambi scrivi alla segreteria';
        return chiusuraProblem(reg.race.chiusuraIscrizioni);
    }

    /**
     * Cambio gara ammesso? Pagata: sì (si paga la differenza). Non pagata: solo se si
     * paga sul posto anche nella nuova gara (cambia la quota da saldare, niente soldi in gioco).
     */
    private garaOk(reg: RegFull, target: { paymentMode: string | null }, admin: boolean): boolean {
        if (admin || reg.paymentStatus === PaymentStatus.CONFIRMED) return true;
        return reg.paymentMethod === 'onsite' && !reg.discountCode && allowedMethods(target.paymentMode).includes('onsite');
    }

    private methods(paymentMode: string | null): PayMethod[] {
        return allowedMethods(paymentMode).filter(m => m === 'paypal' || m === 'bank');
    }

    // ─── Cosa si può fare ───────────────────────────────────────────────────

    async options(actor: Actor, id?: string) {
        const reg = await this.load(actor, id);
        const ev = reg.race.day.event;
        const cfg = quoteCambi(ev.quoteCambi);
        const pagato = quotaPagata(reg);
        const closed = this.closedReason(reg, actor);
        const pending = await this.prisma.regChange.findFirst({
            where: { registrationId: reg.id, appliedAt: null, paymentStatus: PaymentStatus.PENDING },
            orderBy: { createdAt: 'desc' },
        });
        let gare: { id: string; name: string; distance: string; quota: number; differenza: number; completa: boolean }[] = [];
        if (cfg.cambioGara) {
            const races = await this.prisma.race.findMany({
                where: { day: { eventId: ev.id }, id: { not: reg.raceId } },
                include: { day: true, _count: { select: { registrations: { where: { paymentStatus: { not: PaymentStatus.REJECTED } } } } } },
            });
            gare = races
                .filter(r => this.isAdmin(actor) || (r.isOpen && !chiusuraProblem(r.chiusuraIscrizioni)))
                .filter(r => this.garaOk(reg, r, this.isAdmin(actor)))
                .map(r => {
                    const quota = activePrice(r.price, r.priceSteps as never, todayRome()).price;
                    return {
                        id: r.id, name: r.name, distance: r.distance, quota,
                        differenza: differenzaGara(quota, pagato),
                        completa: r.maxParticipants > 0 && r._count.registrations >= r.maxParticipants,
                    };
                });
        }
        return {
            iscrizione: {
                id: reg.id, cognome: reg.cognome, nome: reg.nome, gara: reg.race.name, raceId: reg.raceId,
                evento: ev.title, eventSlug: ev.slug, data: reg.race.day.date, pagato, stato: reg.paymentStatus,
                pettorale: reg.pettorale, categoria: reg.assignedCategory,
            },
            chiuso: closed,
            nonPagata: reg.paymentStatus !== PaymentStatus.CONFIRMED,
            chiusura: reg.race.chiusuraIscrizioni,
            cambioGara: cfg.cambioGara ? gare : null,
            cessione: cfg.cessione,
            // Cessione a un minorenne: la gara può chiedere la dichiarazione del genitore
            minori: reg.race.dichiarazioneMinori ? { testo: reg.race.testoMinori?.trim() || TESTO_MINORI_STANDARD } : null,
            // Solo per iscrizioni pagate (il credito è la quota davvero incassata) e con quota pagabile online
            trasferimento: cfg.trasferimento == null || creditoTrasferimento(reg) <= 0
                || (cfg.trasferimento > 0 && !this.methods(reg.race.paymentMode).length && !this.isAdmin(actor))
                ? null : { quota: cfg.trasferimento, credito: creditoTrasferimento(reg) },
            // Ritiro (annullamento da solo): solo non pagate o gratuite, fino alla chiusura
            ritiro: !closed && !ritiroProblem(reg),
            metodi: this.methods(reg.race.paymentMode),
            inAttesa: pending && {
                id: pending.id, tipo: pending.tipo, descrizione: pending.descrizione, totale: pending.totale,
                paymentRef: pending.paymentRef, paymentMethod: pending.paymentMethod,
            },
        };
    }

    // ─── Richiesta ──────────────────────────────────────────────────────────

    async request(actor: Actor, dto: ChangeDto, id?: string) {
        const reg = await this.load(actor, id);
        const closed = this.closedReason(reg, actor);
        if (closed) throw new BadRequestException(closed);
        const ev = reg.race.day.event;
        const cfg = quoteCambi(ev.quoteCambi);
        const admin = this.isAdmin(actor);

        let tipo: TipoCambio = dto.tipo;
        // Modalità di pagamento: quella della gara di arrivo per il cambio gara
        let paymentMode = reg.race.paymentMode;
        let importo = 0;
        let descrizione = '';
        const dati: DatiCambio = {};

        if (tipo === 'gara') {
            if (!cfg.cambioGara && !admin) throw new BadRequestException('Il cambio gara non è previsto per questo evento');
            if (!dto.raceId || dto.raceId === reg.raceId) throw new BadRequestException('Scegli la nuova gara');
            const target = await this.regs.getRace(dto.raceId);
            if (target.day.event.id !== ev.id) throw new BadRequestException('Gara non valida');
            if (!this.garaOk(reg, target, admin)) {
                throw new BadRequestException('Prima completa il pagamento dell\'iscrizione: poi potrai cambiare gara (o scrivi alla segreteria)');
            }
            if (!admin) {
                if (!target.isOpen) throw new BadRequestException(`${target.name}: iscrizioni chiuse`);
                const ch = chiusuraProblem(target.chiusuraIscrizioni);
                if (ch) throw new BadRequestException(`${target.name}: ${ch}`);
            }
            // Stessi controlli dell'iscrizione per la nuova gara (età, tesseramento, modulo)
            // Stesso atleta: la dichiarazione del genitore già data vale anche per la nuova gara
            const gia = reg.genitore as { nome?: string; cognome?: string } | null;
            const prep = await this.prepareFor(actor, reg, target, this.snapshotAthlete(reg), reg.formData as Record<string, string | boolean>, false,
                gia?.nome && gia?.cognome ? { nome: gia.nome, cognome: gia.cognome, consenso: true } : undefined);
            const nuovaQuota = activePrice(target.price, target.priceSteps as never, todayRome()).price;
            if (reg.paymentStatus === PaymentStatus.CONFIRMED) {
                importo = differenzaGara(nuovaQuota, quotaPagata(reg));
            } else {
                // Non ancora pagata: nessuna differenza, cambia la quota da pagare sul posto
                const q = await this.regs.quote(target.id, undefined, 'onsite');
                dati.riprezza = { basePrice: q.price, commissionAmount: q.commission, pricePaid: q.total };
            }
            paymentMode = target.paymentMode;
            dati.raceId = target.id;
            dati.raceName = target.name;
            dati.categoria = prep.category?.name ?? null;
            dati.certStatus = target.requiresMedicalCert ? (reg.certStatus === CertStatus.VERIFICATO ? CertStatus.VERIFICATO : prep.certStatus) : reg.certStatus;
            descrizione = `Cambio gara: da ${reg.race.name} a ${target.name}${importo ? ` (differenza ${importo.toFixed(2)} €)` : ''}`;
        } else if (tipo === 'cessione') {
            if (cfg.cessione == null && !admin) throw new BadRequestException('La cessione del pettorale non è prevista per questo evento');
            if (!dto.athlete) throw new BadRequestException('Dati del nuovo atleta mancanti');
            if (!dto.athlete.email && !admin && actor.user?.role !== Role.SOCIETY) throw new BadRequestException("Indica l'email del nuovo atleta");
            const formData = this.formDataFor(reg, dto.athlete, dto.formData);
            const prep = await this.prepareFor(actor, reg, await this.regs.getRace(reg.raceId), dto.athlete, formData, true, dto.genitore);
            const a = prep.athlete;
            dati.athlete = {
                nome: a.nome, cognome: a.cognome, sesso: a.sesso, dataNascita: a.dataNascita.toISOString().slice(0, 10),
                societa: a.societa, codiceSocieta: a.codiceSocieta, tessera: a.tessera, tesseramento: a.tesseramento,
                email: a.email, fidalVerified: a.fidalVerified,
            };
            dati.formData = prep.formData;
            dati.genitore = prep.genitore ?? null;
            dati.categoria = prep.category?.name ?? null;
            dati.certStatus = prep.certStatus;
            importo = cfg.cessione ?? 0;
            descrizione = `Cessione del pettorale da ${reg.cognome} ${reg.nome} a ${a.cognome} ${a.nome}`;
        } else {
            tipo = 'trasferimento';
            if (cfg.trasferimento == null && !admin) throw new BadRequestException("Il trasferimento all'anno prossimo non è previsto per questo evento");
            const credito = creditoTrasferimento(reg);
            if (credito <= 0) throw new BadRequestException('Il trasferimento è possibile solo per iscrizioni già pagate');
            importo = cfg.trasferimento ?? 0;
            if (importo > 0 && !admin && !this.methods(reg.race.paymentMode).length) {
                throw new BadRequestException('Per questa gara il trasferimento si chiede alla segreteria');
            }
            descrizione = `Trasferimento all'edizione successiva (credito ${credito.toFixed(2)} €)`;
        }

        // Pagamento: online se la gara lo prevede; se si paga solo sul posto il
        // cambio si fa subito e la quota si salda al ritiro del pettorale.
        const online = this.methods(paymentMode);
        let method: string = 'free';
        if (importo > 0) {
            if (admin) method = 'manual';
            else if (!online.length) method = 'onsite';
            else {
                method = dto.paymentMethod && online.includes(dto.paymentMethod) ? dto.paymentMethod : online[0];
            }
        }
        const fee = method === 'paypal' || method === 'bank' ? paymentFee(method, importo, await this.settings.payments()) : 0;
        const aspetta = method === 'paypal' || method === 'bank';
        // Un cambio alla volta per iscrizione (anche con richieste contemporanee)
        const change = await this.prisma.$transaction(async tx => {
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'cambio:' + reg.id}))::text`;
            const pending = await tx.regChange.count({
                where: { registrationId: reg.id, appliedAt: null, paymentStatus: PaymentStatus.PENDING },
            });
            if (pending) throw new ConflictException('C\'è già un cambio in attesa di pagamento per questa iscrizione');
            return tx.regChange.create({
            data: {
                registrationId: reg.id, eventId: ev.id, tipo, dati: dati as Prisma.InputJsonValue, descrizione,
                importo, paymentFee: fee, totale: round2(importo + fee), paymentMethod: method,
                paymentStatus: method === 'free' || method === 'manual' ? PaymentStatus.CONFIRMED : PaymentStatus.PENDING,
                paidAt: method === 'free' || method === 'manual' ? new Date() : null,
                paymentRef: aspetta ? newPaymentRef() : null,
                createdById: actor.user?.sub,
            },
            });
        });
        if (aspetta) return { applicato: false, paymentRef: change.paymentRef, totale: change.totale, descrizione };
        let done: Awaited<ReturnType<ChangesService['apply']>>;
        try {
            done = await this.apply(change.id);
        } catch (e) {
            // Cambio non fatto: niente richiesta "confermata" rimasta a metà
            await this.prisma.regChange.delete({ where: { id: change.id } }).catch(() => undefined);
            throw e;
        }
        return { applicato: true, descrizione, ...done };
    }

    private snapshotAthlete(reg: RegFull) {
        return {
            nome: reg.nome, cognome: reg.cognome, sesso: reg.sesso as 'M' | 'F',
            dataNascita: reg.dataNascita?.toISOString().slice(0, 10) ?? '',
            societa: reg.societa ?? undefined, codiceSocieta: reg.codiceSocieta ?? undefined, tessera: reg.tessera ?? undefined,
            email: reg.email ?? undefined, tesseramento: reg.tesseramento ?? undefined,
        };
    }

    /** Modulo per il nuovo atleta: si tengono le scelte (es. taglia), non l'anagrafica di chi cede. */
    private formDataFor(reg: RegFull, a: NonNullable<ChangeDto['athlete']>, extra?: Record<string, string | boolean>) {
        const schema = (reg.race.formSchema ?? []) as { id: string; catalogKey?: string }[];
        const fd: Record<string, string | boolean> = { ...(reg.formData as Record<string, string | boolean>) };
        for (const f of schema) {
            if (!f.catalogKey || !ANAGRAFICA.has(f.catalogKey)) continue;
            delete fd[f.id];
            const v = ({ nome: a.nome, cognome: a.cognome, data_nascita: a.dataNascita, sesso: a.sesso, email: a.email,
                societa: a.societa, codice_societa: a.codiceSocieta, tessera_fidal: a.tessera,
                anno_nascita: a.dataNascita?.slice(0, 4) } as Record<string, string | undefined>)[f.catalogKey];
            if (v) fd[f.id] = v;
        }
        return { ...fd, ...(extra ?? {}) };
    }

    /**
     * Controlli dell'iscrizione per l'atleta nella gara: per l'atleta con
     * account e per la società si usa il loro percorso; altrimenti come ospite.
     */
    private prepareFor(
        actor: Actor, reg: RegFull, race: Awaited<ReturnType<RegistrationsService['getRace']>>,
        athlete: NonNullable<ChangeDto['athlete']>, formData: Record<string, string | boolean>, nuovoAtleta = false,
        genitore?: ChangeDto['genitore'],
    ) {
        const u = actor.user;
        const admin = u?.role === Role.ADMIN;
        const asUser = admin || u?.role === Role.SOCIETY || (u?.role === Role.ATHLETE && !nuovoAtleta) ? u : undefined;
        const isStaff = admin;
        return this.regs.prepare(asUser, race, { raceId: race.id, athlete, formData, genitore }, isStaff, {
            consensiSocieta: u?.role === Role.SOCIETY || admin,
        }).catch(e => {
            if (e instanceof BadRequestException) throw new BadRequestException(`${race.name}: ${e.message}`);
            throw e;
        });
    }

    // ─── Applicazione ───────────────────────────────────────────────────────

    /** Applica il cambio (pagato, gratuito o da saldare sul posto). Idempotente. */
    async apply(changeId: string): Promise<{ credito?: { codice: string; importo: number } }> {
        const c = await this.prisma.regChange.findUnique({ where: { id: changeId }, include: { registration: { include } } });
        if (!c) throw new NotFoundException('Cambio non trovato');
        if (c.appliedAt) return c.esito ? { credito: { codice: c.esito, importo: quotaPagata(c.registration) } } : {};
        const reg = c.registration;
        const dati = json<DatiCambio>(c.dati);
        let credito: { codice: string; importo: number; scadenza: Date } | undefined;
        let ceduto: { email: string | null; nome: string } | undefined;

        await this.prisma.$transaction(async tx => {
            const locks = [reg.raceId, dati.raceId].filter((x): x is string => !!x).sort();
            for (const l of locks) await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${l}))::text`;
            const cur = await tx.registration.findUniqueOrThrow({ where: { id: reg.id } });
            if (cur.paymentStatus === PaymentStatus.REJECTED) throw new ConflictException('Iscrizione annullata nel frattempo');

            if (c.tipo === 'gara') {
                const target = await tx.race.findUniqueOrThrow({ where: { id: dati.raceId! } });
                if (target.maxParticipants > 0) {
                    const n = await tx.registration.count({ where: { raceId: target.id, paymentStatus: { not: PaymentStatus.REJECTED } } });
                    if (n >= target.maxParticipants) throw new ConflictException(`${target.name}: gara al completo`);
                }
                if (await findDuplicate(tx, target.id, cur)) throw new ConflictException(`Atleta già iscritto a ${target.name}`);
                await assertSocietyLimit(tx, target, cur.societyId, 1);
                await tx.registration.update({
                    where: { id: reg.id },
                    data: {
                        raceId: target.id, assignedCategory: dati.categoria, certStatus: dati.certStatus ?? undefined,
                        pettorale: null,
                        ...(dati.riprezza && cur.paymentStatus !== PaymentStatus.CONFIRMED
                            ? { ...dati.riprezza, discountAmount: 0, paymentFee: 0 }
                            : { basePrice: round2(cur.basePrice + c.importo) }),
                    },
                });
            } else if (c.tipo === 'cessione') {
                const a = dati.athlete!;
                const dn = new Date(`${a.dataNascita}T00:00:00Z`);
                const nuovo = { cognome: normName(a.cognome), nome: normName(a.nome), dataNascita: dn };
                if (await findDuplicate(tx, reg.raceId, nuovo)) throw new ConflictException(`${a.cognome} ${a.nome} risulta già iscritto a questa gara`);
                ceduto = { email: cur.email, nome: cur.nome };
                await tx.registration.update({
                    where: { id: reg.id },
                    data: {
                        nome: nuovo.nome, cognome: nuovo.cognome, sesso: a.sesso, dataNascita: dn,
                        societa: a.societa ?? null, codiceSocieta: a.codiceSocieta ?? null, tessera: a.tessera ?? null,
                        tesseramento: a.tesseramento ?? null, email: a.email ?? null, fidalVerified: a.fidalVerified,
                        formData: (dati.formData ?? {}) as Prisma.InputJsonValue, assignedCategory: dati.categoria,
                        certStatus: dati.certStatus ?? undefined, athleteId: null, manageToken: newManageToken(),
                        genitore: dati.genitore ? (dati.genitore as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
                    },
                });
            } else {
                // Solo la quota davvero incassata (ricontrollata adesso)
                const importo = creditoTrasferimento(cur);
                if (importo <= 0) throw new ConflictException('Iscrizione non pagata: nessun credito da trasferire');
                const scadenza = new Date(Date.now() + 540 * 86_400_000); // circa 18 mesi: copre l'edizione dopo
                const codice = codiceCredito(newPaymentRef()); // casuale, non derivato dalla causale
                await tx.discountCode.create({
                    data: {
                        code: codice, type: 'fixed', value: importo, maxUses: 1, expiresAt: scadenza, isActive: true,
                        creditoDaEventoId: reg.race.day.event.id,
                        description: `Trasferimento da ${reg.race.day.event.title}: ${cur.cognome} ${cur.nome}`,
                    },
                });
                await tx.registration.update({
                    where: { id: reg.id }, data: { paymentStatus: PaymentStatus.REJECTED, pettorale: null, trasferitoAt: new Date() },
                });
                credito = { codice, importo, scadenza };
            }
            await tx.regChange.update({ where: { id: c.id }, data: { appliedAt: new Date(), esito: credito?.codice } });
        });

        await this.notify(reg.id, c.descrizione, reg.race.day.event.title, credito, ceduto, reg.race.name);
        return credito ? { credito: { codice: credito.codice, importo: credito.importo } } : {};
    }

    private async notify(
        regId: string, descrizione: string, evento: string,
        credito?: { codice: string; importo: number; scadenza: Date }, ceduto?: { email: string | null; nome: string }, gara?: string,
    ) {
        try {
            const r = await this.prisma.registration.findUniqueOrThrow({ where: { id: regId } });
            const manageUrl = r.manageToken && r.paymentStatus !== PaymentStatus.REJECTED
                ? `${MailService.siteUrl()}/iscrizione/${encodeURIComponent(r.manageToken)}` : null;
            await this.mail.enqueue(r.email, changeAppliedMail({ nome: r.nome, evento, descrizione, credito, manageUrl }), { kind: 'cambio' });
            if (ceduto?.email && ceduto.email !== r.email) {
                await this.mail.enqueue(ceduto.email, changeCededMail({ nome: ceduto.nome, evento, gara: gara ?? '' }), { kind: 'cambio' });
            }
        } catch (e) {
            this.log.warn(`Email cambio iscrizione ${regId} non messa in coda: ${e instanceof Error ? e.message : e}`);
        }
    }

    // ─── Ritiro dell'atleta ─────────────────────────────────────────────────

    /**
     * L'atleta annulla da solo un'iscrizione non ancora pagata (o gratuita), fino
     * alla chiusura delle iscrizioni. Libera il posto e il pettorale, restituisce
     * l'uso del codice sconto, annulla le gare comprese nella combinata e gli
     * eventuali cambi in attesa di pagamento. Le quote pagate non si rimborsano.
     */
    async ritiro(actor: Actor, id?: string) {
        const reg = await this.load(actor, id);
        const problem = this.closedReason(reg, actor) ?? ritiroProblem(reg);
        if (problem) throw new BadRequestException(problem);
        await this.prisma.$transaction(async tx => {
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${reg.raceId}))::text`;
            // Solo se è ancora com'era (es. non pagata nel frattempo con PayPal)
            const r = await tx.registration.updateMany({
                where: { id: reg.id, paymentStatus: reg.paymentStatus, paymentMethod: reg.paymentMethod, trasferitoAt: null },
                data: { paymentStatus: PaymentStatus.REJECTED, paidAt: null, pettorale: null },
            });
            if (r.count === 0) throw new ConflictException('L\'iscrizione è cambiata nel frattempo: ricarica la pagina');
            if (reg.discountCode) {
                await tx.discountCode.updateMany({
                    where: { code: reg.discountCode, usedCount: { gt: 0 } },
                    data: { usedCount: { decrement: 1 } },
                });
            }
            await allineaCombinata(tx, [reg.id], PaymentStatus.REJECTED, null);
            await tx.registration.updateMany({ where: { combinataParentId: reg.id }, data: { pettorale: null } });
            await tx.regChange.updateMany({
                where: { registrationId: reg.id, appliedAt: null, paymentStatus: PaymentStatus.PENDING },
                data: { paymentStatus: PaymentStatus.REJECTED },
            });
        });
        await this.mailer.cancelled(reg.id, 'ritiro');
        return { annullata: true };
    }

    // ─── Segreteria ─────────────────────────────────────────────────────────

    async list(status?: string) {
        const st = (['PENDING', 'CONFIRMED', 'REJECTED'] as const).find(x => x === status) ?? 'PENDING';
        const rows = await this.prisma.regChange.findMany({
            where: { paymentStatus: st, importo: { gt: 0 } },
            orderBy: { createdAt: 'asc' },
            take: 200,
            include: { registration: { select: { cognome: true, nome: true, race: { select: { name: true, day: { select: { event: { select: { title: true } } } } } } } } },
        });
        return rows.map(c => ({
            id: c.id, tipo: c.tipo, descrizione: c.descrizione, importo: c.importo, paymentFee: c.paymentFee, totale: c.totale,
            paymentMethod: c.paymentMethod, paymentStatus: c.paymentStatus, paymentRef: c.paymentRef,
            createdAt: c.createdAt, paidAt: c.paidAt, applicato: !!c.appliedAt,
            atleta: `${c.registration.cognome} ${c.registration.nome}`,
            evento: c.registration.race.day.event.title, gara: c.registration.race.name,
        }));
    }

    /** Segreteria: bonifico ricevuto (applica il cambio) oppure annullato. */
    async setPayment(id: string, paymentStatus: PaymentStatus) {
        const c = await this.prisma.regChange.findUnique({ where: { id } });
        if (!c) throw new NotFoundException('Cambio non trovato');
        if (paymentStatus === PaymentStatus.REJECTED && c.appliedAt) {
            throw new ConflictException('Cambio già fatto: non si può annullare da qui');
        }
        // Prima si fa il cambio (se non è più possibile, es. iscrizione annullata, si ferma
        // qui e il pagamento resta da sistemare a mano), poi si segna come incassato
        if (paymentStatus === PaymentStatus.CONFIRMED && !c.appliedAt) await this.apply(id);
        const r = await this.prisma.regChange.updateMany({
            where: { id, paymentStatus: c.paymentStatus },
            data: { paymentStatus, paidAt: paymentStatus === PaymentStatus.CONFIRMED ? c.paidAt ?? new Date() : null },
        });
        if (r.count === 0) throw new ConflictException('Il cambio è cambiato nel frattempo: ricarica la pagina');
        return { ok: true };
    }
}
