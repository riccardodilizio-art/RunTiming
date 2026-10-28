import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectThrottlerOptions, InjectThrottlerStorage, ThrottlerGuard } from '@nestjs/throttler';
import type { ThrottlerModuleOptions, ThrottlerRequest, ThrottlerStorage } from '@nestjs/throttler';
import { AuthUser, PER_IP_KEY, TokenVerifier } from './auth';

/**
 * Limite di richieste:
 * - rotte di accesso (login, registrazione, password, verifica tessera): SEMPRE
 *   per IP, il login non conta (un account si crea gratis);
 * - anonimi: per IP (serve TRUST_PROXY corretto dietro nginx/Cloudflare);
 * - utenti con login VALIDO (token verificato sul DB): per account, non per IP
 *   (al campo gara molti telefoni escono dallo stesso IP);
 * - admin e organizzatori: nessun limite (iscrizioni a raffica il giorno gara);
 * - società: limite ×10 (iscrivono il gruppo in un colpo solo).
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
    constructor(
        @InjectThrottlerOptions() options: ThrottlerModuleOptions,
        @InjectThrottlerStorage() storage: ThrottlerStorage,
        reflector: Reflector,
        private readonly tokens: TokenVerifier,
    ) {
        super(options, storage, reflector);
    }

    /** Utente dal token, verificato (firma, versione, account attivo, ruolo dal DB). Una volta per richiesta. */
    private async user(req: Record<string, any>): Promise<AuthUser | null> {
        if (req.__throttleUser !== undefined) return req.__throttleUser;
        const h: string | undefined = req.headers?.authorization;
        let u: AuthUser | null = null;
        if (h?.startsWith('Bearer ')) {
            try { u = await this.tokens.verify(h.slice(7)); } catch { u = null; }
        }
        req.__throttleUser = u;
        return u;
    }

    protected async handleRequest(props: ThrottlerRequest): Promise<boolean> {
        const perIp = this.reflector.getAllAndOverride<boolean>(PER_IP_KEY, [props.context.getHandler(), props.context.getClass()]);
        if (perIp) return super.handleRequest(props);
        const { req } = this.getRequestResponse(props.context);
        const u = await this.user(req);
        if (u && (u.role === 'ADMIN' || u.role === 'ORGANIZER')) return true;
        if (!u) return super.handleRequest(props);
        return super.handleRequest({
            ...props,
            limit: u.role === 'SOCIETY' ? props.limit * 10 : props.limit,
            getTracker: async () => `u:${u.sub}`,
        });
    }
}
