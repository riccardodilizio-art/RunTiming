import { daysBetween, nextEditionDate, nextEditionTitle, shiftPriceSteps, shiftYmd } from './copy';

describe('copia evento', () => {
    const iso = (d: Date) => d.toISOString();

    it('stessa domenica dell\'anno dopo, ora invariata', () => {
        expect(iso(nextEditionDate(new Date('2026-10-25T09:00:00Z')))).toBe('2027-10-24T09:00:00.000Z');
        // attraversa un 29 febbraio
        expect(iso(nextEditionDate(new Date('2027-03-07T08:30:00Z')))).toBe('2028-03-05T08:30:00.000Z');
        // ultima domenica di ottobre resta l'ultima, se più vicina
        expect(iso(nextEditionDate(new Date('2027-10-31T09:00:00Z')))).toBe('2028-10-29T09:00:00.000Z');
        // sabato resta sabato
        const sab = nextEditionDate(new Date('2026-11-28T15:00:00Z'));
        expect(sab.getUTCDay()).toBe(6);
        expect(Math.abs(daysBetween(new Date('2027-11-28T00:00:00Z'), sab))).toBeLessThanOrEqual(3);
    });

    it('nessuna deriva negli anni: resta vicino alla stessa data', () => {
        let d = new Date('2026-10-25T09:00:00Z');
        for (let i = 0; i < 12; i++) d = nextEditionDate(d);
        expect(d.getUTCDay()).toBe(0);
        expect(Math.abs(daysBetween(new Date('2038-10-25T00:00:00Z'), d))).toBeLessThanOrEqual(6);
    });

    it('scaglioni e titoli', () => {
        expect(shiftYmd('2026-09-30', 364)).toBe('2027-09-29');
        expect(shiftPriceSteps([{ id: 'a', price: 15, deadline: '2026-09-30' }], 364)).toEqual([{ id: 'a', price: 15, deadline: '2027-09-29' }]);
        expect(shiftPriceSteps(null, 364)).toBeNull();
        expect(nextEditionTitle('Corri tra i Trabocchi 2026', 2026, 2027)).toBe('Corri tra i Trabocchi 2027');
        expect(nextEditionTitle('Trofeo d\'autunno', 2026, 2027)).toBe('Trofeo d\'autunno 2027');
        expect(nextEditionTitle('Mezza 2026 – edizione 2026', 2026, 2027)).toBe('Mezza 2027 – edizione 2027');
    });
});
