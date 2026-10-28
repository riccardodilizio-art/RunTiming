import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { PrismaService } from '../prisma/prisma.service';
import type { MailContent } from './templates';
import { signature } from '../common/brand';

/**
 * Email transazionali con Amazon SES.
 *
 * Le email non partono durante la richiesta: si scrivono nella coda (tabella
 * EmailOutbox) e un ciclo le invia ogni pochi secondi. Così un'iscrizione non
 * fallisce mai per colpa dell'email, i picchi (apertura iscrizioni) vengono
 * smaltiti senza superare i limiti di SES, e se SES non risponde si riprova.
 *
 * Senza configurazione (MAIL_FROM + chiavi AWS) le email restano in coda con
 * stato "disabled": il sito funziona lo stesso e si vede cosa sarebbe partito.
 */
@Injectable()
export class MailService implements OnModuleInit, OnModuleDestroy {
    private readonly log = new Logger(MailService.name);
    private timer?: NodeJS.Timeout;
    private running = false;
    private ses?: SESv2Client;

    static readonly BATCH = 40;          // email per giro
    static readonly INTERVAL_MS = 10_000; // un giro ogni 10 secondi (max ~4 email/s)
    static readonly MAX_ATTEMPTS = 6;

    constructor(private readonly prisma: PrismaService) {}

    get configured(): boolean {
        return !!process.env.MAIL_FROM && !!process.env.AWS_ACCESS_KEY_ID && !!process.env.AWS_SECRET_ACCESS_KEY;
    }

    /** Indirizzo pubblico del sito, per i link nelle email. */
    static siteUrl(): string {
        return (process.env.SITE_URL ?? 'http://localhost:8080').replace(/\/$/, '');
    }

    /** Email per indirizzo nelle ultime 24 ore oltre le quali non se ne mandano altre (anti-spam). */
    static readonly MAX_PER_ADDRESS_DAY = 15;
    /** Dopo quanti giorni si cancellano le email già inviate o non inviabili. */
    static readonly KEEP_DAYS = 30;
    private lastPurge = 0;

    onModuleInit() {
        if (process.env.NODE_ENV === 'production' && this.configured && !/^https:\/\//.test(process.env.SITE_URL ?? '')) {
            // Link nelle email (pagamento, password) verso localhost o in chiaro: meglio non partire
            throw new Error('SITE_URL mancante o non https: impostalo (es. https://iltuosito.it) prima di attivare le email');
        }
        if (process.env.NODE_ENV === 'test' || process.env.MAIL_WORKER === 'off') return;
        if (!this.configured) this.log.warn('Email non configurate (MAIL_FROM / AWS_*): restano in coda come "disabled"');
        this.timer = setInterval(() => void this.tick(), MailService.INTERVAL_MS);
        this.timer.unref();
    }

    onModuleDestroy() {
        if (this.timer) clearInterval(this.timer);
    }

    /**
     * Mette un'email in coda. Non lancia mai errori: un problema con l'email non
     * deve far fallire l'operazione che l'ha generata (iscrizione, pagamento…).
     */
    async enqueue(to: string | null | undefined, mail: MailContent, opts: { kind: string; dedupeKey?: string; sendAfter?: Date } ) {
        const addr = to?.trim().toLowerCase();
        if (!addr || addr.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) return;
        try {
            // Anti-spam: un indirizzo non riceve più di N email al giorno dal sito
            // (impedisce di usare le iscrizioni per bombardare una casella)
            // Il recupero password ha già il suo limite (3/ora) e non deve essere
            // bloccabile riempiendo la casella con iscrizioni finte
            const recent = opts.kind === 'password' ? 0 : await this.prisma.emailOutbox.count({
                where: { to: addr, kind: { not: 'password' }, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60_000) } },
            });
            if (recent >= MailService.MAX_PER_ADDRESS_DAY) {
                this.log.warn(`Email "${opts.kind}" a ${addr} non inviata: limite giornaliero per indirizzo raggiunto`);
                return;
            }
            // Link di recupero password: se le email non sono attive non si conserva il link
            const secret = opts.kind === 'password' && !this.configured;
            await this.prisma.emailOutbox.create({
                data: {
                    to: addr, subject: mail.subject,
                    html: secret ? '[contenuto non conservato]' : mail.html,
                    text: secret ? '[contenuto non conservato]' : mail.text,
                    kind: opts.kind,
                    dedupeKey: opts.dedupeKey, sendAfter: opts.sendAfter,
                    status: this.configured ? 'pending' : 'disabled',
                },
            });
        } catch (e) {
            // P2002 = già in coda con la stessa dedupeKey (es. promemoria già inviato)
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return;
            this.log.error(`Email "${opts.kind}" a ${addr} non messa in coda: ${(e as Error).message}`);
        }
    }

    /** Un giro di invio: prende le email in attesa e le spedisce una alla volta. */
    async tick(): Promise<number> {
        if (this.running || !this.configured) return 0;
        this.running = true;
        let sent = 0;
        try {
            const batch = await this.prisma.emailOutbox.findMany({
                where: { status: 'pending', sendAfter: { lte: new Date() } },
                orderBy: { createdAt: 'asc' },
                take: MailService.BATCH,
            });
            for (const m of batch) {
                // Prenota l'email (se un altro processo l'ha già presa, si salta)
                const claimed = await this.prisma.emailOutbox.updateMany({
                    where: { id: m.id, status: 'pending' },
                    data: { status: 'sending', attempts: { increment: 1 } },
                });
                if (claimed.count === 0) continue;
                try {
                    await this.send(m.to, m);
                    await this.prisma.emailOutbox.update({
                        where: { id: m.id },
                        data: {
                            status: 'sent', sentAt: new Date(), lastError: null,
                            // Il link per la password vale come una chiave: inviato, non si conserva
                            ...(m.kind === 'password' ? { html: '[inviata]', text: '[inviata]' } : {}),
                        },
                    });
                    sent++;
                } catch (e) {
                    const attempts = m.attempts + 1;
                    const failed = attempts >= MailService.MAX_ATTEMPTS || isPermanent(e);
                    // Nuovo tentativo con attesa crescente: 1, 2, 4, 8, 16 minuti
                    const retry = new Date(Date.now() + 60_000 * 2 ** (attempts - 1));
                    await this.prisma.emailOutbox.update({
                        where: { id: m.id },
                        data: { status: failed ? 'failed' : 'pending', sendAfter: retry, lastError: String((e as Error).message).slice(0, 500) },
                    });
                    this.log.warn(`Email ${m.id} (${m.kind}) non inviata [tentativo ${attempts}]: ${(e as Error).message}`);
                }
            }
            await this.purge();
        } catch (e) {
            this.log.error(`Coda email: ${(e as Error).message}`);
        } finally {
            this.running = false;
        }
        return sent;
    }

    /** Una volta all'ora: cancella le email vecchie e i link password non più validi. */
    async purge(now = Date.now()) {
        if (now - this.lastPurge < 60 * 60_000) return;
        this.lastPurge = now;
        await this.prisma.emailOutbox.deleteMany({
            where: { status: { in: ['sent', 'failed', 'disabled'] }, createdAt: { lt: new Date(now - MailService.KEEP_DAYS * 24 * 60 * 60_000) } },
        });
        // Email password non partite: dopo 2 ore il link è comunque scaduto
        await this.prisma.emailOutbox.updateMany({
            where: { kind: 'password', status: { not: 'sent' }, createdAt: { lt: new Date(now - 2 * 60 * 60_000) } },
            data: { html: '[scaduta]', text: '[scaduta]', status: 'failed' },
        });
    }

    private async send(to: string, m: { subject: string; html: string; text: string }) {
        this.ses ??= new SESv2Client({ region: process.env.AWS_REGION || 'eu-south-1' });
        const name = signature();
        await this.ses.send(new SendEmailCommand({
            FromEmailAddress: `${encodeName(name)} <${process.env.MAIL_FROM}>`,
            Destination: { ToAddresses: [to] },
            ReplyToAddresses: process.env.MAIL_REPLY_TO ? [process.env.MAIL_REPLY_TO] : undefined,
            Content: {
                Simple: {
                    Subject: { Data: m.subject, Charset: 'UTF-8' },
                    Body: { Html: { Data: m.html, Charset: 'UTF-8' }, Text: { Data: m.text, Charset: 'UTF-8' } },
                },
            },
            ConfigurationSetName: process.env.SES_CONFIGURATION_SET || undefined,
        }));
    }
}

/** Errori che non si risolvono riprovando (indirizzo rifiutato, mittente non verificato…). */
function isPermanent(e: unknown): boolean {
    const name = (e as { name?: string })?.name ?? '';
    return ['MessageRejected', 'MailFromDomainNotVerifiedException', 'AccountSuspendedException', 'BadRequestException', 'NotFoundException']
        .includes(name);
}

/** Nome mittente con caratteri non ASCII (es. "–") codificato per l'intestazione From. */
function encodeName(name: string): string {
    return /^[\x20-\x7e]*$/.test(name) ? `"${name.replace(/"/g, '')}"` : `=?UTF-8?B?${Buffer.from(name).toString('base64')}?=`;
}
