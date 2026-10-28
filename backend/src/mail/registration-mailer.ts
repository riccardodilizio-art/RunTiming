import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CertStatus, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.module';
import { MailService } from './mail.service';
import {
    RegMailData,
    cancelledMail,
    paymentReceivedMail,
    paymentReminderMail,
    registrationMail,
} from './templates';

type RegFull = Prisma.RegistrationGetPayload<{ include: { race: { include: { day: { include: { event: true } } } } } }>;
const include = { race: { include: { day: { include: { event: true } } } } } as const;

/**
 * Email legate alle iscrizioni: conferma (con i dati per pagare), pagamento
 * ricevuto, promemoria e annullamento per le gare a pagamento anticipato.
 * Ogni metodo mette l'email in coda e non lancia mai errori.
 */
@Injectable()
export class RegistrationMailer implements OnModuleInit, OnModuleDestroy {
    private readonly log = new Logger(RegistrationMailer.name);
    private timer?: NodeJS.Timeout;

    constructor(
        private readonly prisma: PrismaService,
        private readonly settings: SettingsService,
        private readonly mail: MailService,
    ) {}

    onModuleInit() {
        if (process.env.NODE_ENV === 'test' || process.env.MAIL_WORKER === 'off') return;
        // Promemoria pagamento: controllo ogni ora
        this.timer = setInterval(() => void this.sendReminders(), 60 * 60_000);
        this.timer.unref();
    }

    onModuleDestroy() {
        if (this.timer) clearInterval(this.timer);
    }

    private async data(reg: RegFull): Promise<RegMailData> {
        const p = await this.settings.payments();
        return {
            nome: reg.nome,
            cognome: reg.cognome,
            evento: reg.race.day.event.title,
            gara: reg.race.name,
            data: reg.race.day.date,
            categoria: reg.assignedCategory,
            importo: reg.pricePaid,
            metodo: reg.paymentMethod,
            stato: reg.paymentStatus,
            paymentRef: reg.paymentRef,
            obbligatorio: reg.race.paymentMode === 'online',
            bank: reg.paymentMethod === 'bank'
                ? { iban: p.iban, intestatario: p.intestatario, banca: p.banca, giorni: p.bankDays }
                : null,
            certificatoMancante: reg.certStatus === CertStatus.IN_ATTESA,
            siteUrl: MailService.siteUrl(),
        };
    }

    private async load(id: string): Promise<RegFull | null> {
        return this.prisma.registration.findUnique({ where: { id }, include });
    }

    private async safely(what: string, fn: () => Promise<void>) {
        try {
            await fn();
        } catch (e) {
            this.log.error(`Email "${what}" non preparata: ${(e as Error).message}`);
        }
    }

    /** Subito dopo l'iscrizione. */
    confirmation(id: string) {
        return this.safely('iscrizione', async () => {
            const reg = await this.load(id);
            if (!reg?.email) return;
            // Iscrizioni fatte da una società: la società vede tutto nella sua area, e un
            // account società (gratuito) non deve poter far partire email verso indirizzi qualsiasi
            if (reg.societyId && !reg.athleteId) return;
            await this.mail.enqueue(reg.email, registrationMail(await this.data(reg)), { kind: 'iscrizione', dedupeKey: `iscrizione:${id}` });
        });
    }

    /** PayPal riuscito o bonifico confermato dalla segreteria. */
    paymentReceived(id: string) {
        return this.safely('pagamento', async () => {
            const reg = await this.load(id);
            if (!reg?.email || reg.paymentStatus !== PaymentStatus.CONFIRMED || (reg.societyId && !reg.athleteId)) return;
            if (reg.paymentMethod !== 'paypal' && reg.paymentMethod !== 'bank') return;
            await this.mail.enqueue(reg.email, paymentReceivedMail(await this.data(reg)), { kind: 'pagamento', dedupeKey: `pagamento:${id}` });
        });
    }

    /** Iscrizione annullata. La chiave include la data: se viene riattivata e riannullata si avvisa di nuovo. */
    cancelled(id: string, motivo: 'mancato_pagamento' | 'organizzazione') {
        return this.safely('annullamento', async () => {
            const reg = await this.load(id);
            if (!reg?.email || reg.paymentStatus !== PaymentStatus.REJECTED || (reg.societyId && !reg.athleteId)) return;
            await this.mail.enqueue(reg.email, cancelledMail(await this.data(reg), motivo), {
                kind: 'annullamento', dedupeKey: `annullamento:${id}:${new Date().toISOString().slice(0, 16)}`,
            });
        });
    }

    /**
     * Promemoria (una volta sola) per le gare a pagamento anticipato: iscrizioni
     * PayPal/bonifico ancora da pagare dopo (giorni bonifico − 2) giorni, gara non ancora disputata.
     */
    async sendReminders(now = new Date()): Promise<number> {
        let n = 0;
        try {
            const p = await this.settings.payments();
            const afterDays = Math.max(1, p.bankDays - 2);
            const before = new Date(now.getTime() - afterDays * 24 * 60 * 60_000);
            const today = new Date(now.toISOString().slice(0, 10));
            const regs = await this.prisma.registration.findMany({
                where: {
                    paymentStatus: PaymentStatus.PENDING,
                    paymentMethod: { in: ['paypal', 'bank'] },
                    reminderSentAt: null,
                    email: { not: null },
                    submittedAt: { lte: before },
                    race: { paymentMode: 'online', day: { date: { gte: today } } },
                },
                include,
                take: 500,
            });
            for (const reg of regs) {
                // Segna prima di mettere in coda: anche se due processi girano insieme parte un solo promemoria
                const mark = await this.prisma.registration.updateMany({
                    where: { id: reg.id, reminderSentAt: null },
                    data: { reminderSentAt: now },
                });
                if (mark.count === 0) continue;
                await this.mail.enqueue(reg.email, paymentReminderMail(await this.data(reg)), { kind: 'promemoria', dedupeKey: `promemoria:${reg.id}` });
                n++;
            }
        } catch (e) {
            this.log.error(`Promemoria pagamento: ${(e as Error).message}`);
        }
        return n;
    }
}
