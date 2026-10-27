import {
    activePrice,
    assignCategory,
    checkAge,
    commissionAmount,
    discountAmount,
    normName,
    quote,
    resolveCommission,
    sportAge,
    todayRome,
} from './rules';

const steps = [
    { id: 'a', label: 'Early bird', price: 20, deadline: '2026-09-30' },
    { id: 'b', label: 'Standard', price: 25, deadline: '2026-10-20' },
];

describe('activePrice', () => {
    it('sceglie lo step attivo più economico', () => {
        expect(activePrice(30, steps, '2026-09-15')).toMatchObject({ price: 20, label: 'Early bird' });
    });
    it('il giorno di scadenza è ancora valido', () => {
        expect(activePrice(30, steps, '2026-09-30').price).toBe(20);
        expect(activePrice(30, steps, '2026-10-01').price).toBe(25);
    });
    it('senza step attivi usa il prezzo base', () => {
        expect(activePrice(30, steps, '2026-11-01')).toMatchObject({ price: 30, label: 'Prezzo base' });
        expect(activePrice(30, null, '2026-11-01').price).toBe(30);
    });
});

describe('sconti e commissioni', () => {
    it('sconto fisso non supera il prezzo', () => {
        expect(discountAmount(10, { type: 'fixed', value: 15 })).toBe(10);
    });
    it('sconto percentuale arrotondato al centesimo', () => {
        expect(discountAmount(19.99, { type: 'percent', value: 15 })).toBe(3);
    });
    it('cascata step > gara > evento > globale', () => {
        const g = { fixedFee: 1, percentFee: 0, appliedTo: 'buyer' as const };
        const r = { fixedFee: 2, percentFee: 0, appliedTo: 'buyer' as const };
        expect(resolveCommission(g, null, r)).toBe(r);
        expect(resolveCommission(g)).toBe(g);
    });
    it('nessuna commissione sulle iscrizioni gratuite', () => {
        expect(commissionAmount({ fixedFee: 1, percentFee: 3, appliedTo: 'buyer' }, 0)).toBe(0);
    });
    it('quote: commissione a carico atleta si somma, a carico organizzatore no', () => {
        const base = { basePrice: 20, today: '2026-01-01', discount: { type: 'percent', value: 10 } };
        const buyer = quote({ ...base, commissions: { global: { fixedFee: 0.5, percentFee: 2, appliedTo: 'buyer' } } });
        expect(buyer).toMatchObject({ price: 20, discount: 2, afterDiscount: 18, commission: 0.86, total: 18.86 });
        const org = quote({ ...base, commissions: { global: { fixedFee: 0.5, percentFee: 2, appliedTo: 'organizer' } } });
        expect(org.total).toBe(18);
    });
});

describe('età e categorie', () => {
    const cats = [
        { name: 'Senior M', gender: 'M' as const, minAge: 23, maxAge: 34 },
        { name: 'Master 35 M', gender: 'M' as const, minAge: 35, maxAge: 39 },
        { name: 'Senior F', gender: 'F' as const, minAge: 23, maxAge: 34 },
    ];
    it('età sportiva = anno gara − anno nascita', () => {
        expect(sportAge(new Date('1991-12-31'), new Date('2026-01-10'))).toBe(35);
    });
    it('assegna la categoria per sesso ed età', () => {
        expect(assignCategory(cats, 35, 'M')?.name).toBe('Master 35 M');
        expect(assignCategory(cats, 30, 'F')?.name).toBe('Senior F');
        expect(assignCategory(cats, 50, 'M')).toBeNull();
    });
    it('limiti di età della gara', () => {
        expect(checkAge(15, 16, null)).toMatch(/minima/);
        expect(checkAge(40, 16, null)).toBeNull();
    });
});

it('normName e todayRome', () => {
    expect(normName('  de  rossi ')).toBe('DE ROSSI');
    expect(todayRome(new Date('2026-10-26T23:30:00Z'))).toBe('2026-10-27');
});
