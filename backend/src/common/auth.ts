import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
    SetMetadata,
    UnauthorizedException,
    createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Utente autenticato. Il ruolo è quello ATTUALE nel database, non quello nel token. */
export interface AuthUser {
    sub: string;
    email: string;
    role: Role;
}

interface TokenPayload {
    sub: string;
    email: string;
    role: Role;
    /** Versione del login: se la password cambia, i token vecchi non valgono più. */
    tv?: number;
}

const WEAK_SECRETS = new Set(['dev-secret', 'change-me-in-prod', 'secret', 'changeme', 'test']);

/**
 * Segreto che firma i login. Senza un valore lungo e non banale il server non
 * parte: con un segreto noto chiunque potrebbe crearsi un accesso da admin.
 */
export function jwtSecret(): string {
    const s = process.env.JWT_SECRET ?? '';
    if (s.length < 32 || WEAK_SECRETS.has(s)) {
        throw new Error(
            'JWT_SECRET mancante o troppo debole: impostane uno casuale di almeno 32 caratteri nel .env ' +
            "(es. generato con: node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\")",
        );
    }
    return s;
}

const ROLES_KEY = 'roles';

/** Limita la rotta ai ruoli indicati. Senza @Roles basta essere autenticati. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** Inietta l'utente autenticato (o undefined sulle rotte con OptionalAuthGuard). */
export const CurrentUser = createParamDecorator(
    (_: unknown, ctx: ExecutionContext): AuthUser | undefined => ctx.switchToHttp().getRequest().user,
);

function bearer(req: { headers: Record<string, string | undefined> }): string | undefined {
    const h = req.headers['authorization'];
    return h?.startsWith('Bearer ') ? h.slice(7) : undefined;
}

/**
 * Verifica firma e scadenza del token, poi rilegge l'account: ruolo dal DB
 * (un cambio di ruolo vale subito) e versione del login (cambio password =
 * vecchi accessi annullati). Account eliminato = accesso negato.
 */
@Injectable()
export class TokenVerifier {
    constructor(
        private readonly jwt: JwtService,
        private readonly prisma: PrismaService,
    ) {}

    async verify(token: string): Promise<AuthUser> {
        let p: TokenPayload;
        try {
            p = this.jwt.verify<TokenPayload>(token);
        } catch {
            throw new UnauthorizedException('Sessione scaduta o non valida');
        }
        const acc = await this.prisma.account.findUnique({
            where: { id: p.sub },
            select: { id: true, email: true, role: true, tokenVersion: true },
        });
        if (!acc || (p.tv ?? 0) !== acc.tokenVersion) {
            throw new UnauthorizedException('Sessione scaduta o non valida');
        }
        return { sub: acc.id, email: acc.email, role: acc.role };
    }
}

/** Richiede un login valido e, se presente @Roles, uno dei ruoli indicati. */
@Injectable()
export class AuthGuard implements CanActivate {
    constructor(
        private readonly tokens: TokenVerifier,
        private readonly reflector: Reflector,
    ) {}

    async canActivate(ctx: ExecutionContext): Promise<boolean> {
        const req = ctx.switchToHttp().getRequest();
        const token = bearer(req);
        if (!token) throw new UnauthorizedException('Accesso richiesto');
        req.user = await this.tokens.verify(token);
        const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
            ctx.getHandler(),
            ctx.getClass(),
        ]);
        if (roles?.length && !roles.includes(req.user.role)) {
            throw new ForbiddenException('Permessi insufficienti');
        }
        return true;
    }
}

/** Come AuthGuard ma senza token lascia passare (utente = undefined). */
@Injectable()
export class OptionalAuthGuard implements CanActivate {
    constructor(private readonly tokens: TokenVerifier) {}

    async canActivate(ctx: ExecutionContext): Promise<boolean> {
        const req = ctx.switchToHttp().getRequest();
        const token = bearer(req);
        if (token) req.user = await this.tokens.verify(token);
        return true;
    }
}
