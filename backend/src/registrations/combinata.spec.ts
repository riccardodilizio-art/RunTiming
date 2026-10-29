import { combinateEvento, prezzoAggiunta, rimappaCombinate } from './combinata';

describe('combinate', () => {
    it('solo combinate valide, con gare note', () => {
        const races = new Set(['a', 'b', 'c']);
        expect(combinateEvento([
            { id: 'k1', nome: ' A + B ', raceIds: ['a', 'b', 'b'], prezzo: '18' },
            { id: 'k2', nome: 'una gara', raceIds: ['a'], prezzo: 5 },
            { id: 'k3', nome: 'sconosciuta', raceIds: ['a', 'zz'], prezzo: 5 },
            { id: 'k4', nome: 'negativa', raceIds: ['a', 'c'], prezzo: -1 },
            'boh',
        ], races)).toEqual([{ id: 'k1', nome: 'A + B', raceIds: ['a', 'b'], prezzo: 18 }]);
        expect(combinateEvento(null)).toEqual([]);
    });

    it('aggiunta dopo: si paga la differenza', () => {
        expect(prezzoAggiunta(18, 10)).toBe(8);
        expect(prezzoAggiunta(18, 20)).toBe(0);
    });

    it('id delle gare rimappati (gare nuove, evento copiato)', () => {
        expect(rimappaCombinate([{ id: 'k', nome: 'x', raceIds: ['tmp1', 'b'], prezzo: 1 }], new Map([['tmp1', 'srv1']])))
            .toEqual([{ id: 'k', nome: 'x', raceIds: ['srv1', 'b'], prezzo: 1 }]);
    });
});
