import { assegnaPettorali, ordinePettorali, type BibReg } from './bib.rules';

const r = (id: string, societa: string | null, cognome: string, nome = 'A', pettorale: number | null = null): BibReg =>
    ({ id, societa, cognome, nome, pettorale });

describe('pettorali', () => {
    const regs = [
        r('1', 'ATLETICA ZETA', 'BIANCHI'), r('2', null, 'ANDREOLI'), r('3', 'Atletica Alfa', 'VERDI'),
        r('4', 'ATLETICA ALFA', 'ROSSI', 'MARIO'), r('5', 'atlética alfa', 'ROSSI', 'ANNA'),
    ];

    it('per società, poi cognome e nome; senza società in fondo', () => {
        expect([...regs].sort(ordinePettorali).map(x => x.id)).toEqual(['5', '4', '3', '1', '2']);
    });

    it('riassegna tutto da 1, saltando i pettorali di altre gare', () => {
        const m = assegnaPettorali(regs, { da: 1, modo: 'tutti', occupati: new Set([3]) });
        expect(Object.fromEntries(m)).toEqual({ 5: 1, 4: 2, 3: 4, 1: 5, 2: 6 });
    });

    it('solo i nuovi: dopo l\'ultimo già dato', () => {
        const m = assegnaPettorali([r('a', 'X', 'A', 'A', 1001), r('b', 'X', 'B', 'A', 1002), r('c', 'Y', 'C'), r('d', null, 'D')],
            { da: 1001, modo: 'nuovi', occupati: new Set() });
        expect(Object.fromEntries(m)).toEqual({ c: 1003, d: 1004 });
    });
});
