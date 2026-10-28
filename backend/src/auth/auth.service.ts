import { ConflictException, Injectable, Logger, NotFoundException, OnApplicationBootstrap, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const normEmail = (e: string) => e.trim().toLowerCase();

let dummy: Promise<string> | undefined;
const dummyHash = () => (dummy ??= argon2.hash('password-inesistente-per-tempi-costanti'));

@Injectable()
export class AuthService implements OnApplicationBootstrap {
    private readonly log = new Logger(AuthService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly jwt: JwtService,
    ) {}

    /**
     * Primo avvio: se non esiste nessun admin e sono impostate ADMIN_EMAIL /
     * ADMIN_PASSWORD, crea l'account admin. Niente password nel codice.
     */
    async onApplicationBootstrap() {
        const email = process.env.ADMIN_EMAIL;
        const password = process.env.ADMIN_PASSWORD;
        if (!email || !password) return;
        try {
            const admins = await this.prisma.account.count({ where: { role: Role.ADMIN } });
            if (admins > 0) return;
            await this.createAccount(email, password, Role.ADMIN, 'Amministratore');
            this.log.log(`Creato account admin ${email}`);
        } catch (e) {
            this.log.warn(`Seed admin non riuscito: ${(e as Error).message}`);
        }
    }

    async createAccount(email: string, password: string, role: Role, displayName?: string, assignedEventIds: string[] = []) {
        const e = normEmail(email);
        if (await this.prisma.account.findUnique({ where: { email: e } })) {
            throw new ConflictException('Email già registrata');
        }
        return this.prisma.account.create({
            data: { email: e, passwordHash: await argon2.hash(password), role, displayName, assignedEventIds },
        });
    }

    /** Registrazione pubblica: solo atleti e società. */
    async register(email: string, password: string, displayName?: string, role: Role = Role.ATHLETE) {
        const account = await this.createAccount(email, password, role, displayName);
        return this.sign(account.id, account.email, account.role, account.tokenVersion);
    }

    async login(email: string, password: string) {
        const account = await this.prisma.account.findUnique({ where: { email: normEmail(email) } });
        // Verifica argon2 anche se l'email non esiste: stessi tempi di risposta,
        // così non si scopre quali email sono registrate.
        const ok = await argon2.verify(account?.passwordHash ?? (await dummyHash()), password);
        if (!account || !ok) throw new UnauthorizedException('Credenziali non valide');
        return this.sign(account.id, account.email, account.role, account.tokenVersion);
    }

    async me(id: string) {
        const a = await this.prisma.account.findUnique({
            where: { id },
            select: {
                id: true, email: true, role: true, displayName: true, assignedEventIds: true, createdAt: true,
                athlete: { select: { id: true } },
                society: { select: { id: true, societaNome: true } },
            },
        });
        if (!a) throw new NotFoundException('Account non trovato');
        return a;
    }

    async changePassword(id: string, current: string, next: string) {
        const a = await this.prisma.account.findUnique({ where: { id } });
        if (!a || !(await argon2.verify(a.passwordHash, current))) {
            throw new UnauthorizedException('Password attuale non corretta');
        }
        const u = await this.prisma.account.update({
            where: { id },
            // tokenVersion+1: i login aperti su altri dispositivi non valgono più
            data: { passwordHash: await argon2.hash(next), tokenVersion: { increment: 1 } },
        });
        // Nuovo token per chi ha appena cambiato la password (resta collegato qui)
        return { ok: true, ...this.sign(u.id, u.email, u.role, u.tokenVersion) };
    }

    private sign(sub: string, email: string, role: Role, tv: number) {
        return { accessToken: this.jwt.sign({ sub, email, role, tv }), role };
    }
}
