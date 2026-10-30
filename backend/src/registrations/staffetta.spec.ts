import { categoriaStaffetta, frazioniGara, pettoraleFrazione, staffettaProblem } from './staffetta';

describe('staffette', () => {
    it('frazioni: da 2 a 10, altrimenti gara individuale', () => {
        expect(frazioniGara(3)).toBe(3);
        expect(frazioniGara('4')).toBe(4);
        expect(frazioniGara(1)).toBeNull();
        expect(frazioniGara(11)).toBeNull();
        expect(frazioniGara(null)).toBeNull();
    });
    it('categoria della squadra', () => {
        expect(categoriaStaffetta(['M', 'M', 'M'])).toBe('Maschile');
        expect(categoriaStaffetta(['F', 'F'])).toBe('Femminile');
        expect(categoriaStaffetta(['M', 'F', 'M'])).toBe('Mista');
    });
    it('pettorale squadra + frazione', () => {
        expect(pettoraleFrazione(101, 2)).toBe('101-2');
        expect(pettoraleFrazione(null, 2)).toBe('');
        expect(pettoraleFrazione(5, null)).toBe('5');
    });
    const a = (cognome: string) => ({ nome: 'Anna', cognome, dataNascita: '1990-01-01' });
    it('composizione', () => {
        expect(staffettaProblem(3, 'Lepri', [a('A'), a('B'), a('C')])).toBeNull();
        expect(staffettaProblem(3, ' ', [a('A'), a('B'), a('C')])).toMatch(/nome della squadra/);
        expect(staffettaProblem(3, 'Lepri', [a('A'), a('B')])).toMatch(/3 frazioni/);
        expect(staffettaProblem(2, 'Lepri', [a('A'), a('a')])).toMatch(/due frazioni/);
    });
});
