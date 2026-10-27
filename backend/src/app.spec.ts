import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';

// Smoke test: l'app si avvia con tutti i moduli collegati (niente errori di
// dependency injection) e le rotte rispettano auth, ruoli e validazione.
// Il database è sostituito da uno stub: qui non si testano le query.

const prismaStub = {
    onModuleInit: async () => undefined,
    account: { count: async () => 1, findUnique: async () => null },
    setting: { findUnique: async () => null },
    discountCode: { findUnique: async () => null },
    event: { count: async () => 0, findMany: async () => [] },
    race: { findUnique: async () => null },
};

describe('App (smoke)', () => {
    let app: INestApplication;
    let jwt: JwtService;

    beforeAll(async () => {
        const mod = await Test.createTestingModule({ imports: [AppModule] })
            .overrideProvider(PrismaService)
            .useValue(prismaStub)
            .compile();
        app = mod.createNestApplication();
        app.setGlobalPrefix('api');
        app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
        await app.init();
        jwt = mod.get(JwtService);
    });

    afterAll(() => app.close());

    const token = (role: string) => `Bearer ${jwt.sign({ sub: 'u1', email: 'x@y.it', role })}`;

    it('rotte pubbliche rispondono', async () => {
        await request(app.getHttpServer()).get('/api/events').expect(200);
        const r = await request(app.getHttpServer()).get('/api/discounts/check/NOPE').expect(200);
        expect(r.body).toEqual({ valid: false, message: 'Codice sconto non valido' });
        const c = await request(app.getHttpServer()).get('/api/settings/commission').expect(200);
        expect(c.body).toMatchObject({ fixedFee: 0, percentFee: 0 });
    });

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

    it('ruolo sbagliato → 403', () =>
        request(app.getHttpServer()).post('/api/events').set('Authorization', token('ATHLETE')).send({}).expect(403));

    it('validazione DTO → 400', () =>
        request(app.getHttpServer())
            .post('/api/events')
            .set('Authorization', token('ADMIN'))
            .send({ title: 'x', days: [] })
            .expect(400));

    it('registrazione pubblica non può creare admin', () =>
        request(app.getHttpServer())
            .post('/api/auth/register')
            .send({ email: 'a@b.it', password: 'password123', role: 'ADMIN' })
            .expect(400));
});
