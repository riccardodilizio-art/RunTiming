import { ammessiGara, checkTesseramento, richiedeFidalVerificato, tesseramentoDaEnte } from './rules';
import { guessTesseramento } from './registrations.service';

// Tesseramenti ammessi per gara: solo FIDAL, FIDAL + Runcard, tutti.

describe('tesseramenti ammessi', () => {
    it('lista vuota = tutti; vecchie gare "ente FIDAL" = FIDAL o Runcard', () => {
        expect(ammessiGara({ ammessi: [], ente: 'uisp' })).toEqual([]);
        expect(ammessiGara({ ammessi: [], ente: 'fidal' })).toEqual(['fidal', 'runcard']);
        expect(ammessiGara({ ammessi: ['fidal'], ente: 'fidal' })).toEqual(['fidal']);
        expect(ammessiGara({ ammessi: ['boh', 'runcard'] })).toEqual(['runcard']);
    });

    it('solo FIDAL: Runcard, EPS e non tesserati respinti', () => {
        expect(checkTesseramento('fidal', ['fidal'])).toBeNull();
        expect(checkTesseramento('runcard', ['fidal'])).toBe('Questa gara è riservata ai tesserati FIDAL');
        expect(checkTesseramento('libero', ['fidal', 'runcard'])).toBe('Questa gara è riservata ai tesserati FIDAL e Runcard');
        expect(checkTesseramento('eps', [])).toBeNull();
        expect(richiedeFidalVerificato(['fidal'])).toBe(true);
        expect(richiedeFidalVerificato(['fidal', 'runcard'])).toBe(false);
    });

    it('tesseramento dal profilo', () => {
        expect(tesseramentoDaEnte('fidal')).toBe('fidal');
        expect(tesseramentoDaEnte('runcard')).toBe('runcard');
        expect(tesseramentoDaEnte('altro', 'RunCard')).toBe('runcard');
        expect(tesseramentoDaEnte('uisp')).toBe('eps');
        expect(tesseramentoDaEnte(undefined)).toBe('libero');
    });

    it('tesseramento di ospiti e società', () => {
        const schema = [{ id: 'f1', catalogKey: 'tessera_fidal' }, { id: 'f2', catalogKey: 'tessera_runcard' }, { id: 'f3', catalogKey: 'tessera_csi' }];
        expect(guessTesseramento(undefined, true, {}, schema, true)).toBe('fidal');
        expect(guessTesseramento(undefined, false, { f2: 'RC1' }, schema, true)).toBe('runcard');
        expect(guessTesseramento(undefined, false, { f3: '123' }, schema, false)).toBe('eps');
        expect(guessTesseramento(undefined, false, {}, schema, false)).toBe('libero');
        expect(guessTesseramento(undefined, false, {}, schema, false, 'FIDAL')).toBe('fidal');
        expect(guessTesseramento('runcard', true, {}, schema, true)).toBe('runcard');
    });
});
