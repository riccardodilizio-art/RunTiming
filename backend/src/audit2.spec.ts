import { BadRequestException } from '@nestjs/common';
import { discountProblem } from './discounts/discounts.module';
import { sanitizeResults } from './results/results.module';
import { trustProxy } from './setup';

// Regressioni della seconda prova di attacco (ottobre 2026).

const code = (over: Record<string, unknown> = {}) =>
    ({ id: 'd1', code: 'ESTATE2026', description: null, type: 'percent', value: 10, maxUses: null, usedCount: 0, expiresAt: null, isActive: true, eventId: null, ...over }) as any;

describe('codici sconto per evento', () => {
    it('codice senza evento: vale ovunque', () => {
        expect(discountProblem(code(), new Date(), 'e1')).toBeNull();
    });
    it('codice di un altro evento: "non valido" (non si rivela che esiste)', () => {
        expect(discountProblem(code({ eventId: 'e2' }), new Date(), 'e1')).toBe('Codice sconto non valido');
        expect(discountProblem(code({ eventId: 'e1' }), new Date(), 'e1')).toBeNull();
    });
});

describe('classifiche caricate', () => {
    it('elemento vuoto → errore chiaro (non un crash)', () => {
        expect(() => sanitizeResults([null])).toThrow(BadRequestException);
    });
    it('solo i campi previsti, lunghezze limitate', () => {
        const [r] = sanitizeResults([{ position: 1, athleteName: 'x'.repeat(5000), time: '0:35:10', bib: 12, extra: '<script>', status: 'boh' }]);
        expect(r).not.toHaveProperty('extra');
        expect(r.athleteName.length).toBe(120);
        expect(r.bib).toBe('12');
        expect(r.status).toBe('finisher');
    });
});

describe('configurazione', () => {
    it('TRUST_PROXY "true" non si fida di qualunque proxy', () => {
        expect(trustProxy('true')).toBe(1);
    });
});
