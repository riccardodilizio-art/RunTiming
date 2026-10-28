import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { configureApp, trustProxy } from './setup';
import { jwtSecret } from './common/auth';

// Smoke test: l'app si avvia con tutti i moduli collegati (niente errori di
// dependency injection) e le rotte rispettano auth, ruoli, validazione e
// le protezioni di sicurezza. Database sostituito da uno stub.

// Account esistenti: l'id è il ruolo (es. "ADMIN"), tokenVersion 0
const accounts: Record<string, { id: string; email: string; role: string; tokenVersion: number }> = {
    ADMIN: { id: 'ADMIN', email: 'a@x.it', role: 'ADMIN', tokenVersion: 0 },
    ORGANIZER: { id: 'ORGANIZER', email: 'o@x.it', role: 'ORGANIZER', tokenVersion: 0 },
    ATHLETE: { id: 'ATHLETE', email: 't@x.it', role: 'ATHLETE', tokenVersion: 0 },
    SOCIETY: { id: 'SOCIETY', email: 's@x.it', role: 'SOCIETY', tokenVersion: 0 },
    PROMOSSO: { id: 'PROMOSSO', email: 'p@x.it', role: 'ATHLETE', tokenVersion: 3 },
};

const prismaStub = {
    onModuleInit: async () => undefined,
    account: {
        count: async () => 1,
        findUnique: async ({ where }: { where: { id?: string } }) => (where.id ? accounts[where.id] ?? null : null),
    },
    setting: { findUnique: async () => null },
    discountCode: { findUnique: async () => null },
    event: {
        count: async () => 1,
        findMany: async () => [],
        findUnique: async () => ({
            id: 'e1', slug: 'demo', title: 'Demo',
            days: [{ id: 'd1', date: new Date(), races: [{ id: 'r1', name: '10 km', syncKey: 'HASH-SEGRETO', _count: { registrations: 0, resultRows: 0 } }] }],
        }),
    },
    race: { findUnique: async () => null },
    society: { findUnique: async () => ({ codiceFidal: 'CH000', fidalApproved: false }) },
};

describe('App (smoke + sicurezza)', () => {
    let app: NestExpressApplication;
    let jwt: JwtService;

    beforeAll(async () => {
        const mod = await Test.createTestingModule({ imports: [AppModule] })
            .overrideProvider(PrismaService)
            .useValue(prismaStub)
            .compile();
        app = mod.createNestApplication<NestExpressApplication>({ bodyParser: false });
        configureApp(app);
        await app.init();
        jwt = mod.get(JwtService);
    });

    afterAll(() => app.close());

    const token = (id: string, extra: Record<string, unknown> = {}) =>
        `Bearer ${jwt.sign({ sub: id, email: 'x@y.it', role: accounts[id]?.role ?? 'ADMIN', tv: 0, ...extra })}`;

    it('rotte pubbliche rispondono', async () => {
        await request(app.getHttpServer()).get('/api/events').expect(200);
        const r = await request(app.getHttpServer()).get('/api/discounts/check/NOPE').expect(200);
        expect(r.body).toEqual({ valid: false, message: 'Codice sconto non valido' });
        const c = await request(app.getHttpServer()).get('/api/settings/commission').expect(200);
        expect(c.body).toMatchObject({ fixedFee: 0, percentFee: 0 });
    });

    it('[critico] la pagina evento NON espone la chiave semi-live', async () => {
        const r = await request(app.getHttpServer()).get('/api/events/demo').expect(200);
        expect(JSON.stringify(r.body)).not.toContain('HASH-SEGRETO');
        expect(r.body.days[0].races[0]).not.toHaveProperty('syncKey');
    });

    it('[critico] JWT_SECRET debole o mancante → il server non parte', () => {
        const old = process.env.JWT_SECRET;
        for (const v of ['', 'dev-secret', 'change-me-in-prod', 'corto']) {
            process.env.JWT_SECRET = v;
            expect(() => jwtSecret()).toThrow(/JWT_SECRET/);
        }
        process.env.JWT_SECRET = old;
    });

    it('[critico] token firmato con un altro segreto → 401', () => {
        const forged = new JwtService({ secret: 'un-altro-segreto-un-altro-segreto-xx' }).sign({ sub: 'ADMIN', role: 'ADMIN', tv: 0 });
        return request(app.getHttpServer()).post('/api/events').set('Authorization', `Bearer ${forged}`).send({}).expect(401);
    });

    it('token con ruolo ADMIN ma account atleta nel DB → vale il ruolo del DB (403)', () =>
        request(app.getHttpServer())
            .post('/api/events')
            .set('Authorization', token('ATHLETE', { role: 'ADMIN' }))
            .send({})
            .expect(403));

    it('token di prima del cambio password → 401', () =>
        request(app.getHttpServer()).get('/api/auth/me').set('Authorization', token('PROMOSSO', { tv: 2 })).expect(401));

    it('account inesistente / eliminato → 401', () =>
        request(app.getHttpServer()).get('/api/auth/me').set('Authorization', token('NESSUNO')).expect(401));

    it('iscrizione con token non valido → 401', () =>
        request(app.getHttpServer())
            .post('/api/registrations')
            .set('Authorization', 'Bearer non-valido')
            .send({ raceId: 'x' })
            .expect(401));

    it('staff list senza login → 401', () =>
        request(app.getHttpServer()).get('/api/races/x/registrations').expect(401));

    it('semi-live con chiave sbagliata → 401', () =>
        request(app.getHttpServer())
            .post('/api/sync/races/x/results')
            .set('X-Sync-Key', 'sbagliata')
            .send({ csv: 'Pos;Atleta;Tempo\n1;ROSSI;40:00' })
            .expect(401));

    it('import FIDAL senza login → 401', () =>
        request(app.getHttpServer()).post('/api/fidal/import').expect(401));

    it('[grave] ricerca FIDAL per nome e roster società: niente accesso anonimo', async () => {
        await request(app.getHttpServer()).get('/api/fidal/cerca?cognome=ROSSI').expect(401);
        await request(app.getHttpServer()).get('/api/fidal/societa/CH000').expect(401);
        await request(app.getHttpServer()).get('/api/fidal/cerca?cognome=ROSSI').set('Authorization', token('ATHLETE')).expect(403);
    });

    it('[grave] la società vede solo il proprio roster FIDAL', () =>
        request(app.getHttpServer()).get('/api/fidal/societa/XX999').set('Authorization', token('SOCIETY')).expect(403));

    it('[grave] verifica tessera FIDAL senza cognome → 400', () =>
        request(app.getHttpServer()).get('/api/fidal/verifica?tessera=AB123').expect(400));

    it('ruolo sbagliato → 403', () =>
        request(app.getHttpServer()).post('/api/events').set('Authorization', token('ATHLETE')).send({}).expect(403));

    it('validazione DTO → 400', () =>
        request(app.getHttpServer())
            .post('/api/events')
            .set('Authorization', token('ADMIN'))
            .send({ title: 'x', days: [] })
            .expect(400));

    it('[medio] link evento javascript:/data:/protocol-relative rifiutati', async () => {
        for (const regulationUrl of ['javascript:alert(1)', 'data:text/html,x', '//evil.example']) {
            await request(app.getHttpServer())
                .post('/api/events')
                .set('Authorization', token('ADMIN'))
                .send({ title: 'Evento', regulationUrl, days: [] })
                .expect(400);
        }
    });

    it('[medio] data di nascita assurda rifiutata', async () => {
        for (const dataNascita of ['2999-01-01', '1800-05-05', '2020-02-30']) {
            const r = await request(app.getHttpServer())
                .post('/api/events/demo/verify')
                .send({ cognome: 'ROSSI', dataNascita });
            expect(r.status).toBe(400);
        }
    });

    it('[medio] body oltre 1 MB su rotte normali → 413', () =>
        request(app.getHttpServer())
            .post('/api/registrations')
            .set('Content-Type', 'application/json')
            .send(JSON.stringify({ raceId: 'x', formData: { a: 'x'.repeat(1_200_000) } }))
            .expect(413));

    it('[medio] troppi tentativi di login → 429', async () => {
        let last = 0;
        for (let i = 0; i < 12; i++) {
            last = (await request(app.getHttpServer()).post('/api/auth/login').send({ email: 'x@y.it', password: 'sbagliata' })).status;
        }
        expect(last).toBe(429);
    });

    it('[nuovo] staff e società non vengono bloccati dal limite iscrizioni (giorno gara)', async () => {
        for (const who of ['ORGANIZER', 'SOCIETY']) {
            let blocked = false;
            for (let i = 0; i < 15; i++) {
                const r = await request(app.getHttpServer()).post('/api/registrations').set('Authorization', token(who)).send({});
                if (r.status === 429) blocked = true;
            }
            expect(blocked).toBe(false);
        }
    });

    it('[nuovo] società: roster FIDAL del proprio codice solo dopo l\'approvazione admin', async () => {
        const r = await request(app.getHttpServer()).get('/api/fidal/societa/CH000').set('Authorization', token('SOCIETY')).expect(403);
        expect(r.body.message).toMatch(/approvazione/);
    });

    it('[nuovo] approvazione codici FIDAL: solo admin', async () => {
        await request(app.getHttpServer()).get('/api/societies?pending=1').set('Authorization', token('ORGANIZER')).expect(403);
        await request(app.getHttpServer()).patch('/api/societies/s1/fidal').set('Authorization', token('SOCIETY')).send({ approved: true }).expect(403);
    });

    it('[nuovo] la società non può cercare nell\'anagrafica FIDAL per nome', () =>
        request(app.getHttpServer()).get('/api/fidal/cerca?cognome=ROSSI').set('Authorization', token('SOCIETY')).expect(403));

    it('[nuovo] TRUST_PROXY interpretato correttamente', () => {
        expect(trustProxy(undefined)).toBe(false);
        expect(trustProxy('')).toBe(false);
        expect(trustProxy('true')).toBe(1);
        expect(trustProxy('2')).toBe(2);
        expect(trustProxy('loopback')).toBe('loopback');
    });

    it('registrazione pubblica non può creare admin', () =>
        request(app.getHttpServer())
            .post('/api/auth/register')
            .send({ email: 'a@b.it', password: 'password123', role: 'ADMIN' })
            .expect(400));

    it('CORS: origine non dichiarata non autorizzata', async () => {
        const r = await request(app.getHttpServer()).get('/api/events').set('Origin', 'https://evil.example');
        expect(r.headers['access-control-allow-origin']).toBeUndefined();
    });
});
