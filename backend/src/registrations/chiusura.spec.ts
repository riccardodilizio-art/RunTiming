import { chiusuraProblem, limiteSocietaProblem } from './rules';

describe('chiusura iscrizioni e limite per società', () => {
    // giovedì 22/10/2026 23:59 ora italiana = 21:59 UTC
    const chiusura = new Date('2026-10-22T21:59:00Z');

    it('aperte fino all\'orario, poi chiuse con data leggibile', () => {
        expect(chiusuraProblem(null)).toBeNull();
        expect(chiusuraProblem(chiusura, new Date('2026-10-22T21:58:59Z'))).toBeNull();
        expect(chiusuraProblem(chiusura, new Date('2026-10-22T21:59:00Z'))).toMatch(/Iscrizioni chiuse \(giovedì 22 ottobre.*23:59\)/);
    });

    it('massimo di atleti per società', () => {
        expect(limiteSocietaProblem(0, 100, 50)).toBeNull();
        expect(limiteSocietaProblem(30, 25, 5)).toBeNull();
        expect(limiteSocietaProblem(30, 25, 6)).toBe('Limite di 30 atleti per società su questa gara: potete iscriverne ancora 5');
        expect(limiteSocietaProblem(30, 30, 1)).toMatch(/già raggiunto/);
    });
});
