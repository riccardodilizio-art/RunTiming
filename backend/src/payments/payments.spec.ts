import { PaymentStatus } from '@prisma/client';
import { PaymentsService } from './payments.module';
import { DEFAULT_PAYMENTS } from '../settings/settings.module';

// Iscrizione da 20 € pagata con bonifico (+1 €) su gara con pagamento facoltativo
function setup(overrides: Record<string, unknown> = {}) {
    const reg: any = {
        id: 'reg1', paymentRef: 'RT-ABCDEFGH', nome: 'MARIO', cognome: 'ROSSI', paymentStatus: PaymentStatus.PENDING,
        paymentMethod: 'bank', paymentFee: 1, pricePaid: 21, commissionAmount: 0, paidAt: null, paypalOrderId: null,
        race: { name: '10 km', paymentMode: 'both', day: { date: new Date('2026-12-13'), event: { title: 'Demo' } } },
        ...overrides,
    };
    const prisma: any = {
        registration: {
            findUnique: async () => reg,
            update: async ({ data }: any) => Object.assign(reg, data),
            // Aggiornamento condizionato: si applica solo se lo stato combacia
            updateMany: async ({ where, data }: any) => {
                if (where.paymentStatus && reg.paymentStatus !== where.paymentStatus) return { count: 0 };
                Object.assign(reg, data);
                return { count: 1 };
            },
        },
    };
    const settings: any = { payments: async () => ({ ...DEFAULT_PAYMENTS, iban: 'IT60X0542811101000000123456' }) };
    const paypal: any = {
        configured: true,
        createOrder: jest.fn(async () => 'ORDER1'),
        capture: jest.fn(),
    };
    const svc = new PaymentsService(prisma, settings, paypal, {} as any);
    return { svc, reg, paypal };
}

describe('pagamenti', () => {
    it('bonifico: mostra IBAN, causale e importi per metodo', async () => {
        const { svc } = setup();
        const i = await svc.info('rt-abcdefgh');
        expect(i.amount).toBe(21);
        expect(i.bank).toMatchObject({ causale: 'RT-ABCDEFGH ROSSI', iban: 'IT60X0542811101000000123456', giorni: 5 });
        expect(i.options).toEqual([
            { method: 'paypal', fee: 1.03, total: 21.03 },
            { method: 'bank', fee: 1, total: 21 },
        ]);
        expect(i.atleta).toBe('MARIO R.');
    });

    it('passando da bonifico a PayPal la maggiorazione viene ricalcolata', async () => {
        const { svc, reg, paypal } = setup();
        const o = await svc.paypalOrder('RT-ABCDEFGH');
        expect(o).toEqual({ orderId: 'ORDER1', amount: 21.03 });
        expect(reg).toMatchObject({ paymentMethod: 'paypal', paymentFee: 1.03, pricePaid: 21.03, paypalOrderId: 'ORDER1' });
        expect(paypal.createOrder).toHaveBeenCalledWith(expect.objectContaining({ amount: 21.03, registrationId: 'reg1' }));
    });

    it('PayPal incassa un importo diverso → iscrizione NON confermata', async () => {
        const { svc, reg, paypal } = setup({ paymentMethod: 'paypal', paypalOrderId: 'ORDER1', pricePaid: 21.03, paymentFee: 1.03 });
        paypal.capture.mockResolvedValue({ status: 'COMPLETED', customId: 'reg1', amount: 1, currency: 'EUR' });
        await expect(svc.paypalCapture('RT-ABCDEFGH', 'ORDER1')).rejects.toThrow(/non completato/);
        expect(reg.paymentStatus).toBe(PaymentStatus.PENDING);
    });

    it('ordine di un\'altra iscrizione → rifiutato', async () => {
        const { svc } = setup({ paymentMethod: 'paypal', paypalOrderId: 'ORDER1' });
        await expect(svc.paypalCapture('RT-ABCDEFGH', 'ALTRO')).rejects.toThrow(/non corrispondente/);
    });

    it('PayPal ok → confermata con data di pagamento', async () => {
        const { svc, reg, paypal } = setup({ paymentMethod: 'paypal', paypalOrderId: 'ORDER1', pricePaid: 21.03, paymentFee: 1.03 });
        paypal.capture.mockResolvedValue({ status: 'COMPLETED', customId: 'reg1', amount: 21.03, currency: 'EUR' });
        const i = await svc.paypalCapture('RT-ABCDEFGH', 'ORDER1');
        expect(i.status).toBe(PaymentStatus.CONFIRMED);
        expect(reg.paidAt).toBeInstanceOf(Date);
    });

    it('[medio] PayPal su iscrizione già RIFIUTATA → non la riattiva', async () => {
        const { svc, reg, paypal } = setup({
            paymentStatus: PaymentStatus.REJECTED, paymentMethod: 'paypal', paypalOrderId: 'ORDER1', pricePaid: 21.03, paymentFee: 1.03,
        });
        paypal.capture.mockResolvedValue({ status: 'COMPLETED', customId: 'reg1', amount: 21.03, currency: 'EUR' });
        await expect(svc.paypalCapture('RT-ABCDEFGH', 'ORDER1')).rejects.toThrow();
        expect(reg.paymentStatus).toBe(PaymentStatus.REJECTED);
        expect(paypal.capture).not.toHaveBeenCalled();
    });

    it('gara a pagamento anticipato: il pagamento sul posto non è offerto', async () => {
        const { svc } = setup({ race: { name: '21 km', paymentMode: 'online', day: { date: new Date(), event: { title: 'Demo' } } } });
        const i = await svc.info('RT-ABCDEFGH');
        expect(i.obbligatorio).toBe(true);
        expect(i.options.map(o => o.method)).toEqual(['paypal', 'bank']);
    });
});
