import { createHash } from 'crypto';
import { AuthService } from './auth.service';

const hash = (t: string) => createHash('sha256').update(t).digest('hex');

function setup() {
    const account = { id: 'a1', email: 'luca@example.com', passwordHash: 'vecchia', tokenVersion: 0 };
    const resets: any[] = [];
    const prisma: any = {
        account: {
            findUnique: async ({ where }: any) => (where.email === account.email || where.id === account.id ? account : null),
            update: async ({ data }: any) => {
                account.passwordHash = data.passwordHash;
                account.tokenVersion += data.tokenVersion?.increment ?? 0;
                return account;
            },
        },
        passwordReset: {
            count: async () => resets.filter(r => r.createdAt > new Date(Date.now() - 3600_000)).length,
            updateMany: async ({ where, data }: any) => {
                const hit = resets.filter(r => (where.id ? r.id === where.id : r.accountId === where.accountId) && r.usedAt === null);
                hit.forEach(r => Object.assign(r, data));
                return { count: hit.length };
            },
            create: async ({ data }: any) => { const r = { id: `p${resets.length + 1}`, usedAt: null, createdAt: new Date(), ...data }; resets.push(r); return r; },
            findUnique: async ({ where }: any) => resets.find(r => r.tokenHash === where.tokenHash) ?? null,
        },
        $transaction: async (arg: any) => (typeof arg === 'function' ? arg(prisma) : Promise.all(arg)),
    };
    const mail: any = { enqueue: jest.fn(async () => undefined) };
    const svc = new AuthService(prisma, {} as any, mail);
    /** Token in chiaro preso dal link dell'ultima email. */
    const lastToken = () => decodeURIComponent(String(mail.enqueue.mock.calls.at(-1)[1].text).match(/token=([^\s]+)/)![1]);
    return { svc, account, resets, mail, lastToken };
}

describe('password dimenticata', () => {
    it('email sconosciuta: stessa risposta, nessuna email', async () => {
        const { svc, mail } = setup();
        await expect(svc.forgotPassword('nessuno@example.com')).resolves.toEqual({ ok: true });
        expect(mail.enqueue).not.toHaveBeenCalled();
    });

    it('nel database c\'è solo l\'impronta del token, non il token', async () => {
        const { svc, resets, lastToken } = setup();
        await svc.forgotPassword('Luca@Example.com ');
        const token = lastToken();
        expect(resets[0].tokenHash).toBe(hash(token));
        expect(JSON.stringify(resets)).not.toContain(token);
    });

    it('link valido: nuova password, vecchi login chiusi, link non riutilizzabile', async () => {
        const { svc, account, lastToken } = setup();
        await svc.forgotPassword('luca@example.com');
        const token = lastToken();
        await svc.resetPassword(token, 'NuovaPassword1');
        expect(account.passwordHash).not.toBe('vecchia');
        expect(account.tokenVersion).toBe(1);
        await expect(svc.resetPassword(token, 'AltraPassword1')).rejects.toThrow(/non valido o scaduto/);
    });

    it('link scaduto dopo un\'ora', async () => {
        const { svc, resets, lastToken } = setup();
        await svc.forgotPassword('luca@example.com');
        resets[0].expiresAt = new Date(Date.now() - 1000);
        await expect(svc.resetPassword(lastToken(), 'NuovaPassword1')).rejects.toThrow(/scaduto/);
    });

    it('un nuovo link annulla quello precedente', async () => {
        const { svc, lastToken } = setup();
        await svc.forgotPassword('luca@example.com');
        const first = lastToken();
        await svc.forgotPassword('luca@example.com');
        await expect(svc.resetPassword(first, 'NuovaPassword1')).rejects.toThrow(/non valido/);
        await expect(svc.resetPassword(lastToken(), 'NuovaPassword1')).resolves.toEqual({ ok: true });
    });

    it('massimo 3 email all\'ora per account', async () => {
        const { svc, mail } = setup();
        for (let i = 0; i < 5; i++) await svc.forgotPassword('luca@example.com');
        expect(mail.enqueue).toHaveBeenCalledTimes(3);
    });

    it('token inventato → rifiutato', async () => {
        const { svc } = setup();
        await expect(svc.resetPassword('x'.repeat(43), 'NuovaPassword1')).rejects.toThrow(/non valido/);
    });
});

describe('blocco tentativi per email', () => {
    it('10 password sbagliate → account bloccato 15 minuti, anche con la password giusta; la reimpostazione sblocca', async () => {
        const argon2 = await import('argon2');
        const { resetLoginFailures, LOGIN_MAX_FAILS } = await import('./auth.service');
        resetLoginFailures();
        const { svc, account } = setup();
        account.passwordHash = await argon2.hash('Giusta123');
        (svc as any).jwt = { sign: () => 'tok' };
        for (let i = 0; i < LOGIN_MAX_FAILS; i++) await expect(svc.login('luca@example.com', 'sbagliata')).rejects.toThrow(/Credenziali/);
        await expect(svc.login('LUCA@example.com', 'Giusta123')).rejects.toThrow(/Troppi tentativi/);
        resetLoginFailures();
        await expect(svc.login('luca@example.com', 'Giusta123')).resolves.toMatchObject({ accessToken: 'tok' });
    }, 30_000);
});

describe('blocco per account E indirizzo IP', () => {
    it('chi sbaglia apposta da un IP non blocca l\'accesso dell\'admin da un altro IP', async () => {
        const argon2 = await import('argon2');
        const { resetLoginFailures, LOGIN_MAX_FAILS } = await import('./auth.service');
        resetLoginFailures();
        const { svc, account } = setup();
        account.passwordHash = await argon2.hash('Giusta123');
        (svc as any).jwt = { sign: () => 'tok' };
        for (let i = 0; i < LOGIN_MAX_FAILS; i++) await expect(svc.login('luca@example.com', 'x', '203.0.113.9')).rejects.toThrow();
        await expect(svc.login('luca@example.com', 'Giusta123', '203.0.113.9')).rejects.toThrow(/Troppi tentativi/);
        await expect(svc.login('luca@example.com', 'Giusta123', '198.51.100.7')).resolves.toMatchObject({ accessToken: 'tok' });
    }, 30_000);
});
