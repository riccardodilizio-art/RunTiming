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
    ) {}

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
        const reg = await this.byRef(ref);
        if (reg.paymentStatus !== PaymentStatus.PENDING) throw new ConflictException('Iscrizione già pagata o annullata');
        await this.switchMethod(reg, 'bank');
        return this.info(ref);
    }

    async paypalOrder(ref: string) {
        let reg = await this.byRef(ref);
        if (reg.paymentStatus !== PaymentStatus.PENDING) throw new ConflictException('Iscrizione già pagata o annullata');
        reg = await this.switchMethod(reg, 'paypal');
        const orderId = await this.paypal.createOrder({
            registrationId: reg.id,
            paymentRef: reg.paymentRef!,
            description: `Iscrizione ${reg.race.day.event.title} – ${reg.race.name}`,
            amount: reg.pricePaid,
        });
        await this.prisma.registration.update({ where: { id: reg.id }, data: { paypalOrderId: orderId } });
        return { orderId, amount: reg.pricePaid };
    }

    /** Incasso: conferma l'iscrizione solo se PayPal ha davvero incassato l'importo giusto. */
    async paypalCapture(ref: string, orderId: string) {
        const reg = await this.byRef(ref);
        if (reg.paymentStatus === PaymentStatus.CONFIRMED) return this.info(ref);
        // Annullata (es. scadenza del pagamento anticipato): NON si incassa, il posto non c'è più
        if (reg.paymentStatus !== PaymentStatus.PENDING) throw new ConflictException('Iscrizione annullata: pagamento non possibile');
        if (reg.paypalOrderId !== orderId) throw new BadRequestException('Ordine PayPal non corrispondente');
        // Importo atteso per PayPal calcolato dalla quota, indipendente da un eventuale
        // cambio di metodo fatto in un'altra scheda mentre si pagava
        const subtotal = round2(reg.pricePaid - reg.paymentFee);
        const fee = paymentFee('paypal', subtotal, await this.settings.payments());
        const expected = round2(subtotal + fee);
        const c = await this.paypal.capture(orderId);
        if (c.status !== 'COMPLETED' || c.customId !== reg.id || c.currency !== 'EUR' || round2(c.amount ?? 0) !== expected) {
            throw new BadRequestException('Pagamento PayPal non completato');
        }
        const r = await this.prisma.registration.updateMany({
            where: { id: reg.id, paymentStatus: PaymentStatus.PENDING },
            data: { paymentStatus: PaymentStatus.CONFIRMED, paidAt: new Date(), paymentMethod: 'paypal', paymentFee: fee, pricePaid: expected },
        });
        if (r.count === 0) {
            // Incassato ma l'iscrizione è cambiata nel frattempo: da rimborsare a mano
            this.log.error(`Pagamento PayPal ${orderId} incassato su iscrizione ${reg.id} non più in attesa: verificare/rimborsare`);
        } else {
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
        const where = { raceId, paymentStatus: PaymentStatus.PENDING, paymentMethod: { in: ['paypal', 'bank'] } };
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
            return { cancelled: r.count, ids };
        });
        // Avvisa ciascun atleta (email in coda)
        for (const id of res.ids) await this.mailer.cancelled(id, 'mancato_pagamento');
        return { cancelled: res.cancelled };
    }

    /**
     * Rendiconto dell'evento: incassato da TimingRun (PayPal/carta e bonifici
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
        const totals = {
            incassatoTimingRun: sum(collected, r => r.pricePaid),
            maggiorazioni: sum(collected, r => r.paymentFee),
            commissioni: sum(collected, r => r.commissionAmount),
            daGirareOrganizzatore: sum(collected, r => r.pricePaid - r.paymentFee - r.commissionAmount),
            inAttesa: { count: pending.length, total: sum(pending, r => r.pricePaid) },
        };
        return { event, totals, byMethod, rows: regs };
    }

    async statementXlsx(eventId: string): Promise<{ name: string; buffer: Buffer }> {
        const s = await this.statement(eventId);
        const wb = new ExcelJS.Workbook();
        const sum = wb.addWorksheet('Riepilogo');
        sum.addRows([
            ['Rendiconto', s.event.title],
            [],
            ['Incassato da TimingRun (PayPal/carta + bonifici)', s.totals.incassatoTimingRun],
            ['di cui maggiorazioni metodo (TimingRun)', s.totals.maggiorazioni],
            ['di cui commissioni (TimingRun)', s.totals.commissioni],
            ["Da girare all'organizzatore", s.totals.daGirareOrganizzatore],
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

    // ─── Admin (i soldi passano da TimingRun) ─────────────────────────────

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
    controllers: [PaymentsController],
    providers: [PaymentsService, PaypalClient],
})
export class PaymentsModule {}
