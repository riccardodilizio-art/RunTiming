import {
    BadRequestException,
    Body,
    ConflictException,
    Controller,
    Get,
    Injectable,
    Logger,
    Module,
    NotFoundException,
    Param,
    Post,
    Query,
    Res,
    UseGuards,
} from '@nestjs/common';
import { allineaCombinata } from '../registrations/combinata';
import { ChangesModule } from '../changes/changes.module';
import { ChangesService } from '../changes/changes.service';
import { senzaToken } from '../registrations/registrations.service';
import { PaymentStatus, Prisma, Role } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import ExcelJS from 'exceljs';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.module';
import { AuthGuard, AuthUser, CurrentUser, Roles } from '../common/auth';
import { EventAccess } from '../common/access';
import { allowedMethods, paymentFee } from '../registrations/rules';
import { PaypalClient } from './paypal.client';
import { RegistrationMailer } from '../mail/registration-mailer';
import { siteName } from '../common/brand';

const round2 = (n: number) => Math.round(n * 100) / 100;
const normRef = (r: string) => r.trim().toUpperCase();

class CaptureDto {
    @IsString() @MaxLength(64) orderId!: string;
}

class BankQueryDto {
    @IsOptional() @IsString() @MaxLength(80) q?: string;
    @IsOptional() @IsString() status?: string;
}

type RegWithRace = Prisma.RegistrationGetPayload<{
    include: { race: { include: { day: { include: { event: true } } } } };
}>;

@Injectable()
export class PaymentsService {
    private readonly log = new Logger(PaymentsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly settings: SettingsService,
        private readonly paypal: PaypalClient,
        private readonly access: EventAccess,
        private readonly mailer: RegistrationMailer,
        private readonly changes: ChangesService,
    ) {}

    /** Il codice è di un cambio dopo l'iscrizione (cambio gara, cessione, trasferimento)? */
    private async changeByRef(ref: string) {
        const c = await this.prisma.regChange.findUnique({
            where: { paymentRef: normRef(ref) },
            include: { registration: { include: { race: { include: { day: { include: { event: true } } } } } } },
        });
        if (!c) throw new NotFoundException('Codice pagamento non trovato');
        return c;
    }

    private isRegRef(ref: string) {
        return this.prisma.registration.count({ where: { paymentRef: normRef(ref) } }).then(n => n > 0);
    }

    private async changeInfo(ref: string) {
        const c = await this.changeByRef(ref);
        const reg = c.registration;
        const p = await this.settings.payments();
        const methods = allowedMethods(reg.race.paymentMode).filter(m => m === 'paypal' || m === 'bank');
        return {
            ref: c.paymentRef,
            tipo: 'cambio',
            descrizione: c.descrizione,
            atleta: `${reg.nome} ${reg.cognome.charAt(0)}.`,
            evento: reg.race.day.event.title,
            gara: reg.race.name,
            data: reg.race.day.date,
            status: c.paymentStatus,
            method: c.paymentMethod,
            amount: c.totale,
            paymentFee: c.paymentFee,
            paidAt: c.paidAt,
            obbligatorio: true,
            options: methods.map(m => ({ method: m, fee: paymentFee(m, c.importo, p), total: round2(c.importo + paymentFee(m, c.importo, p)) })),
            bank: c.paymentMethod === 'bank'
                ? { iban: p.iban, intestatario: p.intestatario, banca: p.banca, causale: `${c.paymentRef} ${reg.cognome}`, giorni: p.bankDays }
                : null,
            paypalReady: this.paypal.configured,
        };
    }

    private async changeSwitch(ref: string, method: 'paypal' | 'bank') {
        const c = await this.changeByRef(ref);
        if (c.paymentStatus !== PaymentStatus.PENDING) throw new ConflictException('Cambio già pagato o annullato');
        if (!allowedMethods(c.registration.race.paymentMode).includes(method)) throw new BadRequestException('Metodo non ammesso per questa gara');
        const fee = paymentFee(method, c.importo, await this.settings.payments());
        await this.prisma.regChange.updateMany({
            where: { id: c.id, paymentStatus: PaymentStatus.PENDING },
            data: { paymentMethod: method, paymentFee: fee, totale: round2(c.importo + fee) },
        });
        return this.changeByRef(ref);
    }

    private async changePaypalCapture(ref: string, orderId: string) {
        const c = await this.changeByRef(ref);
        if (c.paymentStatus === PaymentStatus.CONFIRMED) return this.changeInfo(ref);
        if (c.paymentStatus !== PaymentStatus.PENDING) throw new ConflictException('Cambio annullato: pagamento non possibile');
        // Iscrizione annullata nel frattempo: non si incassa
        if (c.registration.paymentStatus === PaymentStatus.REJECTED) throw new ConflictException('Iscrizione annullata: pagamento non possibile');
        if (c.paypalOrderId !== orderId) throw new BadRequestException('Ordine PayPal non corrispondente');
        const expected = c.paypalAmount ?? c.totale;
        const cap = await this.paypal.capture(orderId);
        if (cap.status === 'PENDING') throw new ConflictException('Pagamento in verifica da parte di PayPal: la segreteria confermerà appena arriva');
        if (cap.status !== 'COMPLETED' || cap.customId !== c.id) throw new BadRequestException('Pagamento PayPal non completato');
        if (cap.currency !== 'EUR' || round2(cap.amount ?? 0) !== round2(expected)) {
            this.log.error(`Pagamento PayPal ${orderId} sul cambio ${c.id}: incassati ${cap.amount} ${cap.currency}, attesi ${expected} EUR — verificare`);
            throw new ConflictException('Pagamento ricevuto ma l\'importo non corrisponde: la segreteria verificherà e ti contatterà');
        }
        const r = await this.prisma.regChange.updateMany({
            where: { id: c.id, paymentStatus: PaymentStatus.PENDING },
            data: { paymentStatus: PaymentStatus.CONFIRMED, paidAt: new Date(), paymentMethod: 'paypal' },
        });
        if (r.count) {
            try { await this.changes.apply(c.id); }
            catch (e) { this.log.error(`Cambio ${c.id} pagato ma non applicato: ${e instanceof Error ? e.message : e} — verificare/rimborsare`); }
        } else {
            this.log.error(`Pagamento PayPal ${orderId} incassato sul cambio ${c.id} non più in attesa: verificare/rimborsare`);
        }
        return this.changeInfo(ref);
    }

    private async byRef(ref: string): Promise<RegWithRace> {
        const reg = await this.prisma.registration.findUnique({
            where: { paymentRef: normRef(ref) },
            include: { race: { include: { day: { include: { event: true } } } } },
        });
        if (!reg) throw new NotFoundException('Codice pagamento non trovato');
        return reg;
    }

    /**
     * Pagina di pagamento pubblica (link con il codice): solo quanto serve a
     * pagare, niente dati personali oltre al nome abbreviato.
     */
    async info(ref: string) {
        if (!(await this.isRegRef(ref))) return this.changeInfo(ref);
        const reg = await this.byRef(ref);
        const p = await this.settings.payments();
        const subtotal = round2(reg.pricePaid - reg.paymentFee);
        const methods = allowedMethods(reg.race.paymentMode).filter(m => m !== 'onsite' || reg.paymentMethod === 'onsite');
        return {
            ref: reg.paymentRef,
            atleta: `${reg.nome} ${reg.cognome.charAt(0)}.`,
            evento: reg.race.day.event.title,
            gara: reg.race.name,
            data: reg.race.day.date,
            status: reg.paymentStatus,
            method: reg.paymentMethod,
            amount: reg.pricePaid,
            paymentFee: reg.paymentFee,
            paidAt: reg.paidAt,
            obbligatorio: reg.race.paymentMode === 'online',
            // Importi per ciascun metodo, per poter cambiare idea (bonifico ↔ PayPal)
            options: methods.map(m => ({ method: m, fee: paymentFee(m, subtotal, p), total: round2(subtotal + paymentFee(m, subtotal, p)) })),
            bank: reg.paymentMethod === 'bank'
                ? { iban: p.iban, intestatario: p.intestatario, banca: p.banca, causale: `${reg.paymentRef} ${reg.cognome}`, giorni: p.bankDays }
                : null,
            paypalReady: this.paypal.configured,
        };
    }

    /** Cambia metodo (es. da bonifico a PayPal) ricalcolando la maggiorazione. */
    private async switchMethod(reg: RegWithRace, method: 'paypal' | 'bank') {
        if (reg.paymentMethod === method) return reg;
        if (!allowedMethods(reg.race.paymentMode).includes(method)) throw new BadRequestException('Metodo non ammesso per questa gara');
        const p = await this.settings.payments();
        const subtotal = round2(reg.pricePaid - reg.paymentFee);
        const fee = paymentFee(method, subtotal, p);
        // Aggiorna solo se ancora in attesa (nel frattempo potrebbe essere stata pagata o annullata)
        const r = await this.prisma.registration.updateMany({
            where: { id: reg.id, paymentStatus: PaymentStatus.PENDING },
            data: { paymentMethod: method, paymentFee: fee, pricePaid: round2(subtotal + fee) },
        });
        if (r.count === 0) throw new ConflictException('Iscrizione già pagata o annullata');
        return this.byRef(reg.paymentRef!);
    }

    async chooseBank(ref: string) {
        if (!(await this.isRegRef(ref))) { await this.changeSwitch(ref, 'bank'); return this.changeInfo(ref); }
        const reg = await this.byRef(ref);
        if (reg.paymentStatus !== PaymentStatus.PENDING) throw new ConflictException('Iscrizione già pagata o annullata');
        await this.switchMethod(reg, 'bank');
        return this.info(ref);
    }

    async paypalOrder(ref: string) {
        if (!(await this.isRegRef(ref))) {
            const c = await this.changeSwitch(ref, 'paypal');
            const orderId = await this.paypal.createOrder({
                registrationId: c.id, paymentRef: c.paymentRef!,
                description: `${c.descrizione} – ${c.registration.race.day.event.title}`.slice(0, 120), amount: c.totale,
            });
            await this.prisma.regChange.update({ where: { id: c.id }, data: { paypalOrderId: orderId, paypalAmount: c.totale } });
            return { orderId, amount: c.totale };
        }
        let reg = await this.byRef(ref);
        if (reg.paymentStatus !== PaymentStatus.PENDING) throw new ConflictException('Iscrizione già pagata o annullata');
        reg = await this.switchMethod(reg, 'paypal');
        const orderId = await this.paypal.createOrder({
            registrationId: reg.id,
            paymentRef: reg.paymentRef!,
            description: `Iscrizione ${reg.race.day.event.title} – ${reg.race.name}`,
            amount: reg.pricePaid,
        });
        await this.prisma.registration.update({
            where: { id: reg.id },
            data: { paypalOrderId: orderId, paypalAmount: reg.pricePaid, paypalFee: reg.paymentFee },
        });
        return { orderId, amount: reg.pricePaid };
    }

    /** Incasso: conferma l'iscrizione solo se PayPal ha davvero incassato l'importo giusto. */
    async paypalCapture(ref: string, orderId: string) {
        if (!(await this.isRegRef(ref))) return this.changePaypalCapture(ref, orderId);
        const reg = await this.byRef(ref);
        if (reg.paymentStatus === PaymentStatus.CONFIRMED) return this.info(ref);
        // Annullata (es. scadenza del pagamento anticipato): NON si incassa, il posto non c'è più
        if (reg.paymentStatus !== PaymentStatus.PENDING) throw new ConflictException('Iscrizione annullata: pagamento non possibile');
        if (reg.paypalOrderId !== orderId) throw new BadRequestException('Ordine PayPal non corrispondente');
        // Importo atteso = quello dell'ordine creato dal server (salvato alla creazione),
        // indipendente da cambi di metodo in un'altra scheda o di tariffe nel frattempo
        let expected = reg.paypalAmount;
        let fee = reg.paypalFee;
        if (expected == null || fee == null) {
            const subtotal = round2(reg.pricePaid - reg.paymentFee);
            fee = paymentFee('paypal', subtotal, await this.settings.payments());
            expected = round2(subtotal + fee);
        }
        const c = await this.paypal.capture(orderId);
        if (c.status === 'PENDING') {
            // PayPal trattiene il pagamento per verifiche: si conferma a mano quando arriva
            this.log.warn(`Pagamento PayPal ${orderId} (iscrizione ${reg.id}) in verifica da PayPal`);
            throw new ConflictException('Pagamento in verifica da parte di PayPal: la segreteria confermerà l\'iscrizione appena arriva');
        }
        if (c.status !== 'COMPLETED' || c.customId !== reg.id) throw new BadRequestException('Pagamento PayPal non completato');
        if (c.currency !== 'EUR' || round2(c.amount ?? 0) !== round2(expected)) {
            // I soldi sono stati presi ma non tornano: niente conferma automatica, va controllato
            this.log.error(`Pagamento PayPal ${orderId} su iscrizione ${reg.id}: incassati ${c.amount} ${c.currency}, attesi ${expected} EUR — verificare`);
            throw new ConflictException('Pagamento ricevuto ma l\'importo non corrisponde: la segreteria verificherà e ti contatterà');
        }
        const r = await this.prisma.registration.updateMany({
            where: { id: reg.id, paymentStatus: PaymentStatus.PENDING },
            data: { paymentStatus: PaymentStatus.CONFIRMED, paidAt: new Date(), paymentMethod: 'paypal', paymentFee: fee, pricePaid: expected },
        });
        if (r.count === 0) {
            // Incassato ma l'iscrizione è cambiata nel frattempo: da rimborsare a mano
            this.log.error(`Pagamento PayPal ${orderId} incassato su iscrizione ${reg.id} non più in attesa: verificare/rimborsare`);
        } else {
            await allineaCombinata(this.prisma, [reg.id], PaymentStatus.CONFIRMED, new Date());
            await this.mailer.paymentReceived(reg.id);
        }
        return this.info(ref);
    }

    // ─── Admin ────────────────────────────────────────────────────────────

    /** Bonifici da controllare: ricerca per causale, cognome o importo. */
    bankList(q: BankQueryDto) {
        const t = q.q?.trim();
        const status = (['PENDING', 'CONFIRMED', 'REJECTED'] as const).find(s => s === q.status) ?? 'PENDING';
        return this.prisma.registration.findMany({
            where: {
                paymentMethod: 'bank',
                paymentStatus: status,
                groupId: null, // i gruppi delle società hanno un solo bonifico: elenco a parte
                ...(t ? {
                    OR: [
                        { paymentRef: { contains: t.toUpperCase() } },
                        { cognome: { contains: t, mode: 'insensitive' } },
                        ...(Number.isFinite(Number(t.replace(',', '.'))) ? [{ pricePaid: Number(t.replace(',', '.')) }] : []),
                    ],
                } : {}),
            },
            orderBy: { submittedAt: 'asc' },
            take: 200,
            select: {
                id: true, paymentRef: true, cognome: true, nome: true, email: true, pricePaid: true, paymentFee: true,
                paymentStatus: true, submittedAt: true, paidAt: true,
                race: { select: { name: true, day: { select: { date: true, event: { select: { title: true } } } } } },
            },
        });
    }

    /** Gare a pagamento anticipato: annulla le iscrizioni online ancora non pagate. */
    async cancelUnpaid(user: AuthUser, raceId: string) {
        const race = await this.prisma.race.findUnique({
            where: { id: raceId },
            include: { day: { include: { event: { select: { id: true, createdById: true } } } } },
        });
        if (!race) throw new NotFoundException('Gara non trovata');
        await this.access.assert(user, race.day.event.id, race.day.event.createdById);
        // Solo dove il pagamento anticipato è obbligatorio: altrove si può ancora pagare sul posto
        if (race.paymentMode !== 'online') {
            throw new BadRequestException('Annullamento dei non paganti possibile solo per gare a pagamento anticipato');
        }
        // Esclusi i gruppi delle società: il loro bonifico lo gestisce la segreteria dal gruppo
        const where = { raceId, paymentStatus: PaymentStatus.PENDING, paymentMethod: { in: ['paypal', 'bank'] }, groupId: null };
        const res = await this.prisma.$transaction(async tx => {
            const ids = (await tx.registration.findMany({ where, select: { id: true } })).map(r => r.id);
            // Restituisce gli usi dei codici sconto delle iscrizioni annullate
            const codes = await tx.registration.groupBy({ by: ['discountCode'], where: { ...where, discountCode: { not: null } }, _count: true });
            for (const c of codes) {
                await tx.discountCode.updateMany({
                    where: { code: c.discountCode!, usedCount: { gte: c._count } },
                    data: { usedCount: { decrement: c._count } },
                });
            }
            const r = await tx.registration.updateMany({ where: { ...where, id: { in: ids } }, data: { paymentStatus: PaymentStatus.REJECTED } });
            // Combinate: annullate anche le iscrizioni alle altre gare comprese
            await allineaCombinata(tx, ids, PaymentStatus.REJECTED, null);
            return { cancelled: r.count, ids };
        });
        // Avvisa ciascun atleta (email in coda)
        for (const id of res.ids) await this.mailer.cancelled(id, 'mancato_pagamento');
        return { cancelled: res.cancelled };
    }

    /**
     * Rendiconto dell'evento: incassato dalla segreteria (PayPal/carta e bonifici
     * confermati), maggiorazioni e commissioni trattenute, importo da girare
     * all'organizzatore. Le quote pagate sul posto le incassa l'organizzatore.
     */
    async statement(eventId: string) {
        const event = await this.prisma.event.findUnique({ where: { id: eventId }, select: { id: true, title: true } });
        if (!event) throw new NotFoundException('Evento non trovato');
        const regs = await this.prisma.registration.findMany({
            where: { eventId },
            include: { race: { select: { name: true } } },
            orderBy: [{ raceId: 'asc' }, { cognome: 'asc' }],
        });
        const sum = (xs: typeof regs, f: (r: (typeof regs)[number]) => number) => round2(xs.reduce((a, r) => a + f(r), 0));
        const ok = regs.filter(r => r.paymentStatus === PaymentStatus.CONFIRMED);
        const collected = ok.filter(r => r.paymentMethod === 'paypal' || r.paymentMethod === 'bank');
        const byMethod = (['paypal', 'bank', 'onsite', 'manual', 'free'] as const).map(m => {
            const xs = ok.filter(r => r.paymentMethod === m);
            return { method: m, count: xs.length, total: sum(xs, r => r.pricePaid), fees: sum(xs, r => r.paymentFee) };
        });
        const pending = regs.filter(r => r.paymentStatus === PaymentStatus.PENDING);
        // Cambi dopo l'iscrizione pagati online: differenze di gara (all'organizzatore)
        // e quote di segreteria (cessione, trasferimento)
        const cambi = await this.prisma.regChange.findMany({
            where: { eventId, paymentStatus: PaymentStatus.CONFIRMED, paymentMethod: { in: ['paypal', 'bank'] } },
        });
        const cs = (f: (c: (typeof cambi)[number]) => number) => round2(cambi.reduce((a, c) => a + f(c), 0));
        const differenzeGara = cs(c => (c.tipo === 'gara' ? c.importo : 0));
        const quoteSegreteria = cs(c => (c.tipo === 'gara' ? 0 : c.importo));
        // Trasferite all'anno dopo: i soldi restano alla segreteria (coprono il credito
        // dell'edizione successiva), non si girano all'organizzatore di quest'anno
        const trasferite = regs.filter(r => r.trasferitoAt && (r.paymentMethod === 'paypal' || r.paymentMethod === 'bank'));
        const totals = {
            incassatoSegreteria: round2(sum(collected, r => r.pricePaid) + cs(c => c.totale) + sum(trasferite, r => r.pricePaid)),
            maggiorazioni: round2(sum(collected, r => r.paymentFee) + cs(c => c.paymentFee) + sum(trasferite, r => r.paymentFee)),
            commissioni: round2(sum(collected, r => r.commissionAmount) + sum(trasferite, r => r.commissionAmount)),
            creditiEmessi: { count: regs.filter(r => r.trasferitoAt).length, total: sum(regs.filter(r => r.trasferitoAt), r => r.basePrice - r.discountAmount) },
            daGirareOrganizzatore: round2(sum(collected, r => r.pricePaid - r.paymentFee - r.commissionAmount) + differenzeGara),
            quoteSegreteria,
            cambi: { count: cambi.length, differenzeGara, quoteSegreteria },
            // Quote incassate direttamente dall'organizzatore (sul posto / a mano):
            // la commissione della segreteria su queste la deve l'organizzatore
            commissioniDaOrganizzatore: sum(ok.filter(r => r.paymentMethod === 'onsite' || r.paymentMethod === 'manual'), r => r.commissionAmount),
            inAttesa: { count: pending.length, total: sum(pending, r => r.pricePaid) },
        };
        return { event, totals, byMethod, rows: regs.map(senzaToken) };
    }

    async statementXlsx(eventId: string): Promise<{ name: string; buffer: Buffer }> {
        const s = await this.statement(eventId);
        const wb = new ExcelJS.Workbook();
        const sum = wb.addWorksheet('Riepilogo');
        sum.addRows([
            ['Rendiconto', s.event.title],
            [],
            [`Incassato da ${siteName()} (PayPal/carta + bonifici)`, s.totals.incassatoSegreteria],
            [`di cui maggiorazioni metodo (${siteName()})`, s.totals.maggiorazioni],
            [`di cui commissioni (${siteName()})`, s.totals.commissioni],
            ["Da girare all'organizzatore", s.totals.daGirareOrganizzatore],
            ["Commissioni dovute dall'organizzatore (quote incassate da lui)", s.totals.commissioniDaOrganizzatore],
            ['In attesa di pagamento', `${s.totals.inAttesa.count} iscrizioni · ${s.totals.inAttesa.total} €`],
            [],
            ['Metodo', 'Pagate', 'Totale €', 'Maggiorazioni €'],
            ...s.byMethod.map(m => [m.method, m.count, m.total, m.fees]),
        ]);
        sum.getColumn(1).width = 48;
        sum.getColumn(2).width = 22;
        const det = wb.addWorksheet('Iscrizioni');
        det.addRow(['Gara', 'Cognome', 'Nome', 'Metodo', 'Stato', 'Codice', 'Quota', 'Sconto', 'Commissione', 'Maggiorazione', 'Pagato', 'Data pagamento']);
        det.getRow(1).font = { bold: true };
        for (const r of s.rows) {
            det.addRow([
                r.race.name, r.cognome, r.nome, r.paymentMethod ?? '', r.paymentStatus, r.paymentRef ?? '',
                r.basePrice, r.discountAmount, r.commissionAmount, r.paymentFee, r.pricePaid, r.paidAt ?? '',
            ]);
        }
        det.columns.forEach(c => (c.width = 14));
        const name = `rendiconto-${s.event.title.replace(/[^\w-]+/g, '-').toLowerCase()}.xlsx`;
        return { name, buffer: Buffer.from(await wb.xlsx.writeBuffer()) };
    }
}

@Controller()
@Throttle({ default: { limit: 30, ttl: 60_000 } })
export class PaymentsController {
    constructor(private readonly payments: PaymentsService) {}

    // ─── Atleta (link con codice pagamento, anche senza account) ─────────

    @Get('payments/:ref')
    info(@Param('ref') ref: string) {
        return this.payments.info(ref);
    }

    @Post('payments/:ref/bank')
    chooseBank(@Param('ref') ref: string) {
        return this.payments.chooseBank(ref);
    }

    @Post('payments/:ref/paypal/order')
    paypalOrder(@Param('ref') ref: string) {
        return this.payments.paypalOrder(ref);
    }

    @Post('payments/:ref/paypal/capture')
    paypalCapture(@Param('ref') ref: string, @Body() dto: CaptureDto) {
        return this.payments.paypalCapture(ref, dto.orderId);
    }

    // ─── Admin (i soldi passano dalla segreteria) ─────────────────────────────

    @Get('admin/payments/bank')
    @UseGuards(AuthGuard)
    @Roles(Role.ADMIN)
    bank(@Query() q: BankQueryDto) {
        return this.payments.bankList(q);
    }

    @Post('races/:id/cancel-unpaid')
    @UseGuards(AuthGuard)
    @Roles(Role.ADMIN, Role.ORGANIZER)
    cancelUnpaid(@CurrentUser() user: AuthUser, @Param('id') id: string) {
        return this.payments.cancelUnpaid(user, id);
    }

    @Get('events/:id/statement')
    @UseGuards(AuthGuard)
    @Roles(Role.ADMIN)
    async statement(@Param('id') id: string) {
        const s = await this.payments.statement(id);
        return { event: s.event, totals: s.totals, byMethod: s.byMethod };
    }

    @Get('events/:id/statement.xlsx')
    @UseGuards(AuthGuard)
    @Roles(Role.ADMIN)
    async statementXlsx(@Param('id') id: string, @Res() res: Response) {
        const { name, buffer } = await this.payments.statementXlsx(id);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
        res.send(buffer);
    }
}

@Module({
    imports: [ChangesModule],
    controllers: [PaymentsController],
    providers: [PaymentsService, PaypalClient],
})
export class PaymentsModule {}
