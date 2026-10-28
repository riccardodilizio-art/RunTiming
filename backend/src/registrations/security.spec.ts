import { PaymentStatus, Role } from '@prisma/client';
import { RegistrationsService } from './registrations.service';

// Regressioni sui buchi trovati nella prova di attacco (nomi inventati).

const organizer = { id: 'o1', email: 'o@x.it', role: Role.ORGANIZER } as any;
const admin = { id: 'a1', email: 'a@x.it', role: Role.ADMIN } as any;

function setup(reg: Record<string, unknown> = {}, raceDate = new Date('2099-12-13'), discount: any = null) {
    const r: any = {
        id: 'reg1', eventId: 'e1', raceId: 'r1', cognome: 'VERDI', nome: 'LUCA', societa: null,
        assignedCategory: 'SM', paymentStatus: PaymentStatus.PENDING, certStatus: 'IN_ATTESA',
        paymentMethod: 'bank', paymentRef: 'RT-SEGRETO1', discountCode: null, paidAt: null, submittedAt: new Date(),
        race: { name: '10 km', maxParticipants: 0, day: { event: { createdById: 'o1' } } },
        ...reg,
    };
    const tx: any = {
        $queryRaw: async () => [],
        registration: {
            count: async () => 0,
            update: async ({ data }: any) => Object.assign(r, data),
            updateMany: async ({ where, data }: any) => {
                if (where.paymentStatus !== r.paymentStatus || where.paymentMethod !== r.paymentMethod) return { count: 0 };
                Object.assign(r, data);
                return { count: 1 };
            },
            findUniqueOrThrow: async () => r,
        },
        discountCode: {
            updateMany: jest.fn(async () => ({ count: 1 })),
            update: jest.fn(async () => ({})),
            findUnique: async () => discount,
        },
    };
    const prisma: any = {
        registration: { findUnique: async () => r, findMany: async () => [r] },
        event: { findUnique: async () => ({ id: 'e1' }) },
        race: {
            findUnique: async () => ({
                id: 'r1', isOpen: true, minAge: null, maxAge: null,
                day: { date: raceDate, event: { id: 'e1', createdById: 'o1' } },
            }),
        },
        $transaction: async (fn: any) => fn(tx),
    };
    const access: any = { assert: async () => undefined };
    const mailer: any = { confirmation: jest.fn(), paymentReceived: jest.fn(), cancelled: jest.fn() };
    const settings: any = { payments: async () => ({ bankDays: 5 }) };
    const svc = new RegistrationsService(prisma, settings, access, {} as any, mailer);
    return { svc, r, tx, mailer };
}

describe('sicurezza iscrizioni', () => {
    it('[grave] l\'organizzatore NON può confermare un bonifico (i soldi arrivano alla segreteria)', async () => {
        const { svc, r } = setup({ paymentMethod: 'bank' });
        await expect(svc.setPayment(organizer, 'reg1', PaymentStatus.CONFIRMED)).rejects.toThrow(/solo la segreteria/);
        expect(r.paymentStatus).toBe(PaymentStatus.PENDING);
    });

    it('[grave] l\'organizzatore NON può confermare PayPal/carta', async () => {
        const { svc } = setup({ paymentMethod: 'paypal' });
        await expect(svc.setPayment(organizer, 'reg1', PaymentStatus.CONFIRMED)).rejects.toThrow(/solo la segreteria/);
    });

    it('l\'organizzatore può confermare il pagamento sul posto', async () => {
        const { svc, r } = setup({ paymentMethod: 'onsite' });
        await svc.setPayment(organizer, 'reg1', PaymentStatus.CONFIRMED);
        expect(r.paymentStatus).toBe(PaymentStatus.CONFIRMED);
        expect(r.paidAt).toBeInstanceOf(Date);
    });

    it('l\'admin conferma il bonifico ricevuto → email "pagamento ricevuto"', async () => {
        const { svc, r, mailer } = setup({ paymentMethod: 'bank' });
        await svc.setPayment(admin, 'reg1', PaymentStatus.CONFIRMED);
        expect(r.paymentStatus).toBe(PaymentStatus.CONFIRMED);
        expect(mailer.paymentReceived).toHaveBeenCalledWith('reg1');
    });

    it('iscrizione annullata dall\'organizzazione → email di annullamento', async () => {
        const { svc, mailer } = setup({ paymentMethod: 'onsite' });
        await svc.setPayment(organizer, 'reg1', PaymentStatus.REJECTED);
        expect(mailer.cancelled).toHaveBeenCalledWith('reg1', 'organizzazione');
    });

    it('[medio] l\'organizzatore può ANNULLARE un\'iscrizione online non pagata scaduti i termini (posti liberati)', async () => {
        const { svc, r } = setup({ paymentMethod: 'bank', submittedAt: new Date(Date.now() - 10 * 86_400_000) });
        await svc.setPayment(organizer, 'reg1', PaymentStatus.REJECTED);
        expect(r.paymentStatus).toBe(PaymentStatus.REJECTED);
    });

    it('[medio] ...ma non mentre il bonifico può essere ancora in arrivo', async () => {
        const { svc, r } = setup({ paymentMethod: 'bank', submittedAt: new Date(Date.now() - 2 * 86_400_000) });
        await expect(svc.setPayment(organizer, 'reg1', PaymentStatus.REJECTED)).rejects.toThrow(/ancora nei termini/);
        expect(r.paymentStatus).toBe(PaymentStatus.PENDING);
    });

    it('[medio] ...ma non un bonifico già confermato', async () => {
        const { svc } = setup({ paymentMethod: 'bank', paymentStatus: PaymentStatus.CONFIRMED });
        await expect(svc.setPayment(organizer, 'reg1', PaymentStatus.REJECTED)).rejects.toThrow(/solo la segreteria/);
    });

    it('[basso] iscrizione cambiata nel frattempo (es. pagata con PayPal) → niente sovrascrittura', async () => {
        const { svc, r, tx } = setup({ paymentMethod: 'onsite' });
        const orig = tx.registration.updateMany;
        tx.registration.updateMany = async (a: any) => { r.paymentMethod = 'paypal'; r.paymentStatus = PaymentStatus.CONFIRMED; return orig(a); };
        await expect(svc.setPayment(organizer, 'reg1', PaymentStatus.REJECTED)).rejects.toThrow(/cambiata nel frattempo/);
        expect(r.paymentStatus).toBe(PaymentStatus.CONFIRMED);
    });

    it('[basso] riattivazione con codice sconto esaurito → rifiutata', async () => {
        const { svc } = setup({ paymentMethod: 'onsite', paymentStatus: PaymentStatus.REJECTED, discountCode: 'SCONTO10' }, undefined,
            { code: 'SCONTO10', isActive: true, expiresAt: null, maxUses: 5, usedCount: 5 });
        await expect(svc.setPayment(admin, 'reg1', PaymentStatus.PENDING)).rejects.toThrow(/esaurito o scaduto/);
    });

    it('[alto] data di nascita con ora/fuso orario (es. per aggirare l\'età minima) → rifiutata', async () => {
        const { IsBirthDate } = await import('../common/validators');
        const { validate } = await import('class-validator');
        class D { @IsBirthDate() dataNascita!: string; }
        for (const v of ['2009-01-01T00:00:00+14:00', '2009-01-01 ', '2009-01-01Z']) {
            const d = Object.assign(new D(), { dataNascita: v });
            expect((await validate(d)).length).toBe(1);
        }
        expect((await validate(Object.assign(new D(), { dataNascita: '2009-01-01' }))).length).toBe(0);
    });

    it('[medio] riattivare un\'iscrizione annullata su gara piena → rifiutato', async () => {
        const { svc, tx } = setup({
            paymentMethod: 'onsite', paymentStatus: PaymentStatus.REJECTED,
            race: { name: '10 km', maxParticipants: 1, day: { event: { createdById: 'o1' } } },
        });
        tx.registration.count = async () => 1;
        await expect(svc.setPayment(admin, 'reg1', PaymentStatus.PENDING)).rejects.toThrow(/al completo/);
    });

    it('[basso] annullare restituisce l\'uso del codice sconto', async () => {
        const { svc, tx } = setup({ paymentMethod: 'onsite', discountCode: 'SCONTO10' });
        await svc.setPayment(admin, 'reg1', PaymentStatus.REJECTED);
        expect(tx.discountCode.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({ data: { usedCount: { decrement: 1 } } }),
        );
    });

    it('[medio] la verifica pubblica non restituisce il codice di pagamento', async () => {
        const { svc } = setup();
        const out = await svc.verify('demo', { cognome: 'Verdi', dataNascita: '1990-01-01' } as any);
        expect(JSON.stringify(out)).not.toContain('RT-SEGRETO1');
    });

    it('[medio] gara già disputata: niente iscrizioni pubbliche', async () => {
        const { svc } = setup({}, new Date('2020-05-10'));
        await expect(svc.create(undefined, { raceId: 'r1' } as any)).rejects.toThrow(/già svolta/);
    });
});
