import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PaymentStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.module';
import { MailService } from '../mail/mail.service';
import { GroupMailData, groupPaymentReceivedMail, groupRegistrationMail } from '../mail/templates';
import { AuthUser } from '../common/auth';
import { newPaymentRef } from '../payments/payment-ref';
import {
    PreparedRegistration, RegistrationsService, assertSocietyLimit, findDuplicate, snapshotData,
} from '../registrations/registrations.service';
import { allowedMethods } from '../registrations/rules';
import { omaggiNelGruppo, regolaOmaggi, riepilogoGruppo } from './group.rules';
import { CreateGroupDto, GroupPreviewDto } from './groups.dto';
import { frazioniGara } from '../registrations/staffetta';

const round2 = (n: number) => Math.round(n * 100) / 100;

type GroupFull = Prisma.PaymentGroupGetPayload<{
    include: { race: { include: { day: { include: { event: true } } } }; registrations: true };
}>;

/**
 * Iscrizioni di gruppo delle società: più atleti alla stessa gara, un solo
 * pagamento (un bonifico con un'unica causale) e le quote in omaggio previste
 * dalla gara ("ogni 10 iscritti, 1 gratis"). Le regole dell'iscrizione singola
 * (età, tesseramenti, modulo, certificato) sono le stesse: vedi RegistrationsService.prepare.
 */
@Injectable()
export class GroupsService {
    private readonly log = new Logger(GroupsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly regs: RegistrationsService,
        private readonly settings: SettingsService,
        private readonly mail: MailService,
    ) {}

    private async society(user: AuthUser) {
        if (user.role !== Role.SOCIETY) throw new ForbiddenException('Solo le società possono fare iscrizioni di gruppo');
        const s = await this.prisma.society.findUnique({ where: { accountId: user.sub } });
        if (!s) throw new BadRequestException('Profilo società non trovato');
        return s;
    }

    /**
     * Iscritti della società alla gara che contano per gli omaggi: solo quelli
     * già pagati (con iscrizioni non pagate e poi lasciate annullare si
     * otterrebbero omaggi gratis).
     */
    private activeOfSociety(db: Prisma.TransactionClient | PrismaService, raceId: string, societyId: string) {
        return db.registration.count({
            where: { raceId, societyId, paymentStatus: PaymentStatus.CONFIRMED },
        });
    }

    private method(paymentMode: string | null, wanted?: 'bank' | 'onsite'): 'bank' | 'onsite' {
        const allowed = allowedMethods(paymentMode).filter((m): m is 'bank' | 'onsite' => m === 'bank' || m === 'onsite');
        if (!allowed.length) throw new BadRequestException('Questa gara si paga solo online: per i gruppi scrivi alla segreteria');
        const m = wanted ?? allowed[0];
        if (!allowed.includes(m)) throw new BadRequestException('Metodo di pagamento non ammesso per questa gara');
        return m;
    }

    /** Riepilogo prima di confermare: quanti omaggi e quanto pagare. */
    async preview(user: AuthUser, dto: GroupPreviewDto) {
        const s = await this.society(user);
        const race = await this.regs.getRace(dto.raceId);
        if (frazioniGara(race.staffetta)) throw new BadRequestException('Gara a staffetta: iscrivi le squadre una alla volta');
        const method = this.method(race.paymentMode, dto.paymentMethod);
        const q = await this.regs.quote(race.id, undefined, method);
        const gia = await this.activeOfSociety(this.prisma, race.id, s.id);
        const regola = regolaOmaggi(race.gruppoOmaggi);
        const omaggi = omaggiNelGruppo(gia, dto.count, regola);
        return {
            ...riepilogoGruppo(omaggi, round2(q.total - q.paymentFee), q.paymentFee),
            giaIscritti: gia,
            regola,
            paymentMethod: method,
            scaglione: q.label,
        };
    }

    async create(user: AuthUser, dto: CreateGroupDto) {
        const s = await this.society(user);
        const race = await this.regs.getRace(dto.raceId);
        if (frazioniGara(race.staffetta)) throw new BadRequestException('Gara a staffetta: iscrivi le squadre una alla volta');
        await this.regs.assertCanRegister(user, race);
        const method = this.method(race.paymentMode, dto.paymentMethod);

        // Stessi controlli dell'iscrizione singola, atleta per atleta (5 alla volta:
        // la verifica FIDAL può essere lenta). Se uno non va, non si iscrive nessuno.
        const prepared: (PreparedRegistration | null)[] = new Array(dto.athletes.length).fill(null);
        const errori: string[] = [];
        for (let i = 0; i < dto.athletes.length; i += 5) {
            // Troppi errori: inutile continuare (e niente centinaia di verifiche FIDAL a vuoto)
            if (errori.length >= 20) { errori.push('… (controllo interrotto: correggi questi e riprova)'); break; }
            await Promise.all(dto.athletes.slice(i, i + 5).map(async (a, k) => {
                const who = `${a.athlete.cognome} ${a.athlete.nome}`.toUpperCase();
                try {
                    prepared[i + k] = await this.regs.prepare(
                        user, race, { raceId: race.id, athlete: a.athlete, formData: a.formData }, false,
                        { consensiSocieta: dto.consensi },
                    );
                } catch (e) {
                    errori.push(`${who}: ${e instanceof Error ? e.message : 'dati non validi'}`);
                }
            }));
        }
        const keys = new Set<string>();
        prepared.forEach(p => {
            if (!p) return;
            const k = `${p.athlete.cognome}|${p.athlete.nome}|${p.athlete.dataNascita.toISOString().slice(0, 10)}`;
            if (keys.has(k)) errori.push(`${p.athlete.cognome} ${p.athlete.nome}: presente due volte nell'elenco`);
            keys.add(k);
        });
        if (errori.length) {
            throw new BadRequestException({ message: `Iscrizione non fatta: ${errori.length} atleti da sistemare`, errori: errori.sort() });
        }
        const list = prepared as PreparedRegistration[];

        const q = await this.regs.quote(race.id, undefined, method);
        const quota = round2(q.total - q.paymentFee);
        const regola = regolaOmaggi(race.gruppoOmaggi);

        const groupId = await this.prisma.$transaction(async tx => {
            // Serializza con le altre iscrizioni alla stessa gara (posti, doppioni, conteggio omaggi)
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${race.id}))::text`;
            if (race.maxParticipants > 0) {
                const count = await tx.registration.count({ where: { raceId: race.id, paymentStatus: { not: PaymentStatus.REJECTED } } });
                if (count + list.length > race.maxParticipants) {
                    throw new ConflictException(`Posti insufficienti: ne restano ${Math.max(0, race.maxParticipants - count)}`);
                }
            }
            await assertSocietyLimit(tx, race, s.id, list.length);
            const dups: string[] = [];
            for (const p of list) if (await findDuplicate(tx, race.id, p.athlete)) dups.push(`${p.athlete.cognome} ${p.athlete.nome}`);
            if (dups.length) throw new ConflictException({ message: 'Alcuni atleti risultano già iscritti a questa gara', errori: dups });

            const gia = await this.activeOfSociety(tx, race.id, s.id);
            const omaggi = omaggiNelGruppo(gia, list.length, regola);
            const tot = riepilogoGruppo(omaggi, quota, q.paymentFee);
            const free = tot.totale === 0;
            const status = free ? PaymentStatus.CONFIRMED : PaymentStatus.PENDING;
            const group = await tx.paymentGroup.create({
                data: {
                    raceId: race.id,
                    eventId: race.day.event.id,
                    societyId: s.id,
                    societaNome: s.societaNome,
                    paymentRef: newPaymentRef(),
                    paymentMethod: free ? 'free' : method,
                    paymentStatus: status,
                    iscritti: tot.iscritti,
                    omaggi: tot.omaggi,
                    quota: tot.quota,
                    maggiorazione: tot.maggiorazione,
                    totale: tot.totale,
                    createdById: user.sub,
                    paidAt: free ? new Date() : null,
                },
            });
            for (const [i, p] of list.entries()) {
                const om = omaggi[i];
                await tx.registration.create({
                    data: {
                        ...snapshotData(race, p),
                        basePrice: q.price,
                        // Omaggio: la quota è tutta "sconto", niente commissione né maggiorazione
                        discountAmount: om ? q.price : q.discount,
                        commissionAmount: om ? 0 : q.commission,
                        paymentFee: om ? 0 : q.paymentFee,
                        pricePaid: om ? 0 : q.total,
                        paymentMethod: free ? 'free' : method,
                        paymentStatus: status,
                        paidAt: free ? new Date() : null,
                        groupId: group.id,
                        omaggio: om,
                        createdById: user.sub,
                    },
                });
            }
            return group.id;
        });

        const g = await this.full(groupId);
        await this.sendMail(g, 'iscrizione');
        return this.view(g);
    }

    private full(id: string): Promise<GroupFull> {
        return this.prisma.paymentGroup.findUniqueOrThrow({
            where: { id },
            include: {
                race: { include: { day: { include: { event: true } } } },
                registrations: { orderBy: [{ omaggio: 'asc' }, { cognome: 'asc' }, { nome: 'asc' }] },
            },
        });
    }

    private async bank() {
        const p = await this.settings.payments();
        return { iban: p.iban, intestatario: p.intestatario, banca: p.banca, giorni: p.bankDays };
    }

    /** Dati del gruppo per società e segreteria (con i dati del bonifico). */
    private async view(g: GroupFull) {
        return {
            id: g.id,
            paymentRef: g.paymentRef,
            paymentMethod: g.paymentMethod,
            paymentStatus: g.paymentStatus,
            societa: g.societaNome,
            evento: g.race.day.event.title,
            eventSlug: g.race.day.event.slug,
            gara: g.race.name,
            data: g.race.day.date,
            iscritti: g.iscritti,
            omaggi: g.omaggi,
            paganti: g.iscritti - g.omaggi,
            quota: g.quota,
            maggiorazione: g.maggiorazione,
            totale: g.totale,
            createdAt: g.createdAt,
            paidAt: g.paidAt,
            causale: `${g.paymentRef} ${g.societaNome}`,
            bank: g.paymentMethod === 'bank' ? await this.bank() : null,
            atleti: g.registrations.map(r => ({
                id: r.id, cognome: r.cognome, nome: r.nome, categoria: r.assignedCategory, omaggio: r.omaggio,
                pricePaid: r.pricePaid, paymentStatus: r.paymentStatus, certStatus: r.certStatus,
            })),
        };
    }

    private async sendMail(g: GroupFull, kind: 'iscrizione' | 'pagamento') {
        try {
            const soc = await this.prisma.society.findUnique({ where: { id: g.societyId }, include: { account: { select: { email: true } } } });
            const to = soc?.account?.email;
            if (!to) return;
            const d: GroupMailData = {
                societa: g.societaNome, evento: g.race.day.event.title, gara: g.race.name, data: g.race.day.date,
                paymentRef: g.paymentRef, metodo: g.paymentMethod, stato: g.paymentStatus,
                iscritti: g.iscritti, omaggi: g.omaggi, paganti: g.iscritti - g.omaggi,
                quota: g.quota, maggiorazione: g.maggiorazione, totale: g.totale,
                atleti: g.registrations.map(r => ({ nome: `${r.nome} ${r.cognome}`, omaggio: r.omaggio })),
                bank: g.paymentMethod === 'bank' ? await this.bank() : null,
            };
            const content = kind === 'iscrizione' ? groupRegistrationMail(d) : groupPaymentReceivedMail(d);
            await this.mail.enqueue(to, content, { kind: `gruppo-${kind}`, dedupeKey: `gruppo-${kind}:${g.id}` });
        } catch (e) {
            this.log.warn(`Email gruppo ${g.id} non messa in coda: ${e instanceof Error ? e.message : e}`);
        }
    }

    /** I gruppi della società (area società). */
    async mine(user: AuthUser) {
        const s = await this.society(user);
        const ids = await this.prisma.paymentGroup.findMany({
            where: { societyId: s.id }, orderBy: { createdAt: 'desc' }, take: 100, select: { id: true },
        });
        return Promise.all(ids.map(async ({ id }) => this.view(await this.full(id))));
    }

    /** Segreteria: gruppi da incassare (o già incassati / annullati). */
    async list(status?: string) {
        const st = (['PENDING', 'CONFIRMED', 'REJECTED'] as const).find(x => x === status) ?? 'PENDING';
        const ids = await this.prisma.paymentGroup.findMany({
            where: { paymentStatus: st }, orderBy: { createdAt: 'asc' }, take: 200, select: { id: true },
        });
        return Promise.all(ids.map(async ({ id }) => this.view(await this.full(id))));
    }

    /** Segreteria: conferma / annulla / rimette in attesa tutto il gruppo. */
    async setPayment(id: string, paymentStatus: PaymentStatus) {
        const g = await this.prisma.paymentGroup.findUnique({ where: { id }, include: { race: true } });
        if (!g) throw new NotFoundException('Gruppo non trovato');
        if (g.paymentStatus === paymentStatus) return this.view(await this.full(id));
        const paidAt = paymentStatus === PaymentStatus.CONFIRMED ? g.paidAt ?? new Date() : null;
        await this.prisma.$transaction(async tx => {
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${g.raceId}))::text`;
            // Iscrizioni del gruppo che seguono il gruppo: non quelle trasferite all'anno
            // dopo (credito già emesso) né quelle già cambiate per conto loro
            const members = await tx.registration.findMany({
                where: { groupId: id, paymentStatus: g.paymentStatus, trasferitoAt: null },
                select: { id: true, cognome: true, nome: true, dataNascita: true, raceId: true },
            });
            if (g.paymentStatus === PaymentStatus.REJECTED) {
                if (g.race.maxParticipants > 0) {
                    const count = await tx.registration.count({ where: { raceId: g.raceId, paymentStatus: { not: PaymentStatus.REJECTED } } });
                    if (count + members.length > g.race.maxParticipants) throw new ConflictException('Gara al completo: impossibile riattivare il gruppo');
                }
                await assertSocietyLimit(tx, g.race, g.societyId, members.filter(m => m.raceId === g.raceId).length);
                const dups: string[] = [];
                for (const m of members) if (await findDuplicate(tx, m.raceId, m)) dups.push(`${m.cognome} ${m.nome}`);
                if (dups.length) throw new ConflictException({ message: 'Impossibile riattivare: atleti già iscritti di nuovo', errori: dups });
            }
            const r = await tx.paymentGroup.updateMany({ where: { id, paymentStatus: g.paymentStatus }, data: { paymentStatus, paidAt } });
            if (r.count === 0) throw new ConflictException('Il gruppo è cambiato nel frattempo: ricarica la pagina e riprova');
            await tx.registration.updateMany({ where: { id: { in: members.map(m => m.id) } }, data: { paymentStatus, paidAt } });
        });
        const full = await this.full(id);
        if (paymentStatus === PaymentStatus.CONFIRMED) await this.sendMail(full, 'pagamento');
        return this.view(full);
    }
}
