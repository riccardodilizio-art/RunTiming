import { ConflictException, Injectable, Logger, NotFoundException, OnApplicationBootstrap, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { passwordResetMail } from '../mail/templates';

const normEmail = (e: string) => e.trim().toLowerCase();
const tokenHash = (t: string) => createHash('sha256').update(t).digest('hex');
/** Durata del link "password dimenticata". */
export const RESET_MINUTES = 60;

let dummy: Promise<string> | undefined;
const dummyHash = () => (dummy ??= argon2.hash('password-inesistente-per-tempi-costanti'));

@Injectable()
export class AuthService implements OnApplicationBootstrap {
    private readonly log = new Logger(AuthService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly jwt: JwtService,
        private readonly mail: MailService,
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

    /**
     * "Password dimenticata": se l'email ha un account invia un link monouso
     * valido 1 ora. Risponde sempre allo stesso modo, così non si scopre quali
     * email sono registrate. Nel DB si salva solo l'impronta del token.
     */
    async forgotPassword(email: string): Promise<{ ok: true }> {
        const account = await this.prisma.account.findUnique({ where: { email: normEmail(email) }, select: { id: true, email: true } });
        if (!account) return { ok: true };
        // Massimo 3 link nell'ultima ora per account (niente caselle inondate di email)
        const recent = await this.prisma.passwordReset.count({
            where: { accountId: account.id, createdAt: { gte: new Date(Date.now() - 60 * 60_000) } },
        });
        if (recent >= 3) return { ok: true };
        const token = randomBytes(32).toString('base64url');
        await this.prisma.$transaction([
            // Un solo link valido per volta: i precedenti non funzionano più
            this.prisma.passwordReset.updateMany({ where: { accountId: account.id, usedAt: null }, data: { usedAt: new Date() } }),
            this.prisma.passwordReset.create({
                data: { accountId: account.id, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + RESET_MINUTES * 60_000) },
            }),
        ]);
        const link = `${MailService.siteUrl()}/reimposta-password?token=${encodeURIComponent(token)}`;
        await this.mail.enqueue(account.email, passwordResetMail(link, RESET_MINUTES), { kind: 'password' });
        return { ok: true };
    }

    /** Imposta la nuova password dal link: monouso, scaduto dopo 1 ora, chiude tutti i login aperti. */
    async resetPassword(token: string, password: string): Promise<{ ok: true }> {
        const invalid = () => new UnauthorizedException('Link non valido o scaduto: richiedine uno nuovo');
        const r = await this.prisma.passwordReset.findUnique({ where: { tokenHash: tokenHash(token) } });
        if (!r || r.usedAt || r.expiresAt < new Date()) throw invalid();
        const hash = await argon2.hash(password);
        await this.prisma.$transaction(async tx => {
            // Segna il link come usato solo se nessun altro l'ha appena usato
            const used = await tx.passwordReset.updateMany({ where: { id: r.id, usedAt: null }, data: { usedAt: new Date() } });
            if (used.count === 0) throw invalid();
            await tx.account.update({
                where: { id: r.accountId },
                data: { passwordHash: hash, tokenVersion: { increment: 1 } },
            });
        });
        return { ok: true };
    }

    private sign(sub: string, email: string, role: Role, tv: number) {
        return { accessToken: this.jwt.sign({ sub, email, role, tv }), role };
    }
}
