import { codiceCredito, differenzaGara, quotaPagata, quoteCambi } from './change.rules';

describe('cambi dopo l\'iscrizione', () => {
    it('impostazioni dell\'evento', () => {
        expect(quoteCambi(null)).toEqual({ cambioGara: true, cessione: null, trasferimento: null });
        expect(quoteCambi({ cambioGara: false, cessione: '5', trasferimento: 10 })).toEqual({ cambioGara: false, cessione: 5, trasferimento: 10 });
        expect(quoteCambi({ cessione: -1, trasferimento: 'x' })).toEqual({ cambioGara: true, cessione: null, trasferimento: null });
        expect(quoteCambi({ cessione: 0 }).cessione).toBe(0);
    });

    it('cambio gara: differenza, mai rimborso', () => {
        const pagato = quotaPagata({ basePrice: 15, discountAmount: 0 });
        expect(differenzaGara(25, pagato)).toBe(10); // dalla 10 km alla 21 km
        expect(differenzaGara(10, pagato)).toBe(0); // dalla 21 alla 10: nessun rimborso
        expect(quotaPagata({ basePrice: 20, discountAmount: 20 })).toBe(0); // omaggio
    });

    it('codice credito', () => {
        expect(codiceCredito('RT-7KQ4M9XP')).toBe('TR-7KQ4M9XP');
    });
});
