import { PaymentStatus, Role } from '@prisma/client';
import { RegistrationsService } from './registrations.service';

// Regressioni sui buchi trovati nella prova di attacco (nomi inventati).

const organizer = { id: 'o1', email: 'o@x.it', role: Role.ORGANIZER } as any;
const admin = { id: 'a1', email: 'a@x.it', role: Role.ADMIN } as any;

function setup(reg: Record<string, unknown> = {}, raceDate = new Date('2026-12-13')) {
    const r: any = {
        id: 'reg1', eventId: 'e1', raceId: 'r1', cognome: 'VERDI', nome: 'LUCA', societa: null,
        assignedCategory: 'SM', paymentStatus: PaymentStatus.PENDING, certStatus: 'IN_ATTESA',
        paymentMethod: 'bank', paymentRef: 'RT-SEGRETO1', discountCode: null, paidAt: null, submittedAt: new Date(),
        race: { name: '10 km', maxParticipants: 0, day: { event: { createdById: 'o1' } } },
        ...reg,
    };
    const tx: any = {
        $queryRaw: async () => [],
        registration: { count: async () => 0, update: async ({ data }: any) => Object.assign(r, data) },
        discountCode: { updateMany: jest.fn(async () => ({ count: 1 })) },
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
    const svc = new RegistrationsService(prisma, {} as any, access, {} as any, mailer);
    return { svc, r, tx, mailer };
}

describe('sicurezza iscrizioni', () => {
    it('[grave] l\'organizzatore NON può confermare un bonifico (i soldi arrivano a TimingRun)', async () => {
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
