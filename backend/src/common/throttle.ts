import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { ThrottlerRequest } from '@nestjs/throttler';
import { jwtSecret } from './auth';

/**
 * Limite di richieste:
 * - anonimi: per IP (serve TRUST_PROXY corretto dietro nginx/Cloudflare);
 * - utenti con login: per account, non per IP (al campo gara molti telefoni
 *   escono dallo stesso IP);
 * - admin e organizzatori: nessun limite (iscrizioni a raffica il giorno gara);
 * - società: limite ×20 (iscrivono l'intero gruppo in un colpo solo).
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
    private jwt?: JwtService;

    private user(req: Record<string, any>): { sub: string; role: string } | null {
        const h: string | undefined = req.headers?.authorization;
        if (!h?.startsWith('Bearer ')) return null;
        try {
            this.jwt ??= new JwtService({ secret: jwtSecret() });
            const p = this.jwt.verify<{ sub: string; role: string }>(h.slice(7));
            return p?.sub ? p : null;
        } catch {
            return null; // token non valido: si conta per IP (e l'AuthGuard risponderà 401)
        }
    }

    protected async handleRequest(props: ThrottlerRequest): Promise<boolean> {
        const { req } = this.getRequestResponse(props.context);
        const u = this.user(req);
        if (u && (u.role === 'ADMIN' || u.role === 'ORGANIZER')) return true;
        if (!u) return super.handleRequest(props);
        return super.handleRequest({
            ...props,
            limit: u.role === 'SOCIETY' ? props.limit * 20 : props.limit,
            getTracker: async () => `u:${u.sub}`,
        });
    }
}
