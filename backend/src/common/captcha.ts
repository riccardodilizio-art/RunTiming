import { BadRequestException, Logger } from '@nestjs/common';

const log = new Logger('Captcha');

/**
 * Verifica anti-bot (Cloudflare Turnstile) per le azioni anonime: iscrizione
 * da ospite e registrazione account. Attiva solo se TURNSTILE_SECRET_KEY è
 * impostata; senza chiave (sviluppo) non blocca nulla.
 */
export async function assertHuman(token: string | undefined, ip?: string): Promise<void> {
    const secret = process.env.TURNSTILE_SECRET_KEY;
    if (!secret) return;
    if (!token) throw new BadRequestException('Conferma di non essere un robot');
    try {
        const body = new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) });
        const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
        const j = (await r.json()) as { success?: boolean };
        if (j.success) return;
    } catch (e) {
        log.warn(`Turnstile non raggiungibile: ${(e as Error).message}`);
    }
    throw new BadRequestException('Verifica anti-robot non riuscita, riprova');
}
