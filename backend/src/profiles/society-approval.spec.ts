import { ProfilesService } from './profiles.module';

// La società sceglie il proprio codice FIDAL; l'import degli atleti lo sblocca l'admin.
function setup(current: { codiceFidal: string | null; fidalApproved: boolean } | null) {
    const saved: any[] = [];
    const prisma: any = {
        society: {
            findUnique: async () => current,
            upsert: async (args: any) => { saved.push(args); return args.update; },
            update: async ({ data }: any) => ({ ...current, ...data }),
            findFirst: async () => null,
        },
        $queryRaw: async () => [],
        $transaction: async (fn: any) => fn(prisma),
    };
    return { svc: new ProfilesService(prisma, {} as any, {} as any), saved };
}

const dto = (codiceFidal?: string) => ({ societaNome: 'Atletica Prova', ente: 'fidal', codiceFidal });

describe('approvazione codice FIDAL società', () => {
    it('codice cambiato → torna da approvare', async () => {
        const { svc, saved } = setup({ codiceFidal: 'CH001', fidalApproved: true });
        await svc.saveSociety('acc1', dto('ch999') as any);
        expect(saved[0].update).toMatchObject({ codiceFidal: 'CH999', fidalApproved: false });
    });

    it('stesso codice (es. modifica del roster) → approvazione mantenuta', async () => {
        const { svc, saved } = setup({ codiceFidal: 'CH001', fidalApproved: true });
        await svc.saveSociety('acc1', dto('ch001') as any);
        expect(saved[0].update).not.toHaveProperty('fidalApproved');
    });

    it('società nuova: nasce non approvata', async () => {
        const { svc, saved } = setup(null);
        await svc.saveSociety('acc1', dto('CH001') as any);
        expect(saved[0].update.fidalApproved).toBe(false);
        expect(saved[0].create.fidalApproved).toBe(false);
    });

    it('non si approva una società senza codice', async () => {
        const { svc } = setup({ codiceFidal: null, fidalApproved: false });
        await expect(svc.decideSocietyFidal('s1', true)).rejects.toThrow(/codice FIDAL/);
    });
});
