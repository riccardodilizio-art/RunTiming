import { createHash } from 'crypto';
import { ResultsService } from './results.module';

const hash = (k: string) => createHash('sha256').update(k).digest('hex');
const CSV = 'Pos.;Pett.;Cognome;Nome;Time\n1;12;BIANCHI;PAOLO;0:35:10\n';

function setup(stored: string) {
    const race = { syncKey: stored };
    const tx: any = {
        resultUpload: { deleteMany: async () => ({}), create: async () => ({ id: 'u1' }) },
        resultRow: { createMany: async () => ({}) },
    };
    const prisma: any = {
        race: {
            findUnique: async () => race,
            update: async ({ data }: any) => Object.assign(race, data),
        },
        resultUpload: { findUnique: async () => null },
        $transaction: async (fn: any) => fn(tx),
    };
    return { svc: new ResultsService(prisma, {} as any), race };
}

describe('chiave semi-live', () => {
    it('nel DB c\'è solo l\'impronta: la chiave giusta passa, una sbagliata no', async () => {
        const { svc } = setup(hash('chiave-giusta'));
        await expect(svc.sync('r1', 'chiave-giusta', { csv: CSV })).resolves.toMatchObject({ ok: true });
        await expect(svc.sync('r1', 'sbagliata', { csv: CSV })).rejects.toThrow(/non valida/);
        await expect(svc.sync('r1', undefined, { csv: CSV })).rejects.toThrow(/non valida/);
    });

    it('chiave generata prima dell\'aggiornamento: funziona ancora e viene convertita in impronta', async () => {
        const { svc, race } = setup('vecchia-chiave-in-chiaro');
        await expect(svc.sync('r1', 'vecchia-chiave-in-chiaro', { csv: CSV })).resolves.toMatchObject({ ok: true });
        expect(race.syncKey).toBe(hash('vecchia-chiave-in-chiaro'));
    });

    it('chi conosce solo l\'impronta non può usarla come chiave', async () => {
        const { svc } = setup(hash('chiave-giusta'));
        await expect(svc.sync('r1', hash('chiave-giusta'), { csv: CSV })).rejects.toThrow(/non valida/);
    });
});
