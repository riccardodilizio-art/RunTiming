import { omaggiNelGruppo, regolaOmaggi, riepilogoGruppo } from './group.rules';

describe('iscrizioni di gruppo', () => {
    const r = { ogni: 10, gratis: 1 };

    it('esempio della segreteria: 21 atleti a 20 € + 1 € bonifico = 399 €', () => {
        const om = omaggiNelGruppo(0, 21, r);
        expect(om.filter(Boolean)).toHaveLength(2);
        expect(om[9]).toBe(true);
        expect(om[19]).toBe(true);
        expect(riepilogoGruppo(om, 20, 1)).toEqual({ iscritti: 21, omaggi: 2, paganti: 19, quota: 20, maggiorazione: 1, totale: 399 });
    });

    it('22 iscritti, 2 omaggi: bonifico per 20 quote', () => {
        expect(riepilogoGruppo(omaggiNelGruppo(0, 22, r), 20, 0).totale).toBe(400);
    });

    it('si conta anche su quanto la società aveva già iscritto', () => {
        // 8 già iscritti, ora 5: il 10° è il 2° del nuovo gruppo
        expect(omaggiNelGruppo(8, 5, r)).toEqual([false, true, false, false, false]);
        expect(omaggiNelGruppo(0, 9, r).some(Boolean)).toBe(false);
    });

    it('altre regole e regola spenta', () => {
        expect(omaggiNelGruppo(0, 12, { ogni: 6, gratis: 2 }).filter(Boolean)).toHaveLength(4);
        expect(omaggiNelGruppo(0, 30, null).some(Boolean)).toBe(false);
        expect(regolaOmaggi({ ogni: 10, gratis: 1 })).toEqual(r);
        for (const bad of [null, {}, { ogni: 1, gratis: 1 }, { ogni: 10, gratis: 10 }, { ogni: '10', gratis: 1 }, { ogni: 10.5, gratis: 1 }]) {
            expect(regolaOmaggi(bad)).toBeNull();
        }
    });
});
