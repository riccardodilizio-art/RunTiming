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

/** Utente autenticato estratto dal JWT (vedi AuthService.sign). */
export interface AuthUser {
    sub: string;
    email: string;
    role: Role;
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

/** Richiede un JWT valido e, se presente @Roles, uno dei ruoli indicati. */
@Injectable()
export class AuthGuard implements CanActivate {
    constructor(
        private readonly jwt: JwtService,
        private readonly reflector: Reflector,
    ) {}

    canActivate(ctx: ExecutionContext): boolean {
        const req = ctx.switchToHttp().getRequest();
        const token = bearer(req);
        if (!token) throw new UnauthorizedException('Accesso richiesto');
        try {
            req.user = this.jwt.verify<AuthUser>(token);
        } catch {
            throw new UnauthorizedException('Sessione scaduta o non valida');
        }
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
    constructor(private readonly jwt: JwtService) {}

    canActivate(ctx: ExecutionContext): boolean {
        const req = ctx.switchToHttp().getRequest();
        const token = bearer(req);
        if (!token) return true;
        try {
            req.user = this.jwt.verify<AuthUser>(token);
        } catch {
            throw new UnauthorizedException('Sessione scaduta o non valida');
        }
        return true;
    }
}
