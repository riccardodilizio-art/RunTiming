import { readFileSync } from 'fs';
import { join } from 'path';
import { csvToResults, parseCsv } from './rr-csv';

const csv = readFileSync(join(__dirname, '__fixtures__', 'rr-lista.csv'), 'utf8');

describe('lista Race Result (CSV Simple API)', () => {
    it('parser: separatore ; e virgolette', () => {
        const rows = parseCsv(csv);
        expect(rows[3][2]).toBe('BIANCHI; PAOLO');
        expect(rows[3][6]).toBe('CLUB "TEST" SSD');
    });

    it('riconosce le colonne della lista Trabocchi', () => {
        const { recognized } = csvToResults(csv);
        expect(recognized).toEqual(expect.arrayContaining([
            'position=Pos.', 'bib=Pett.', 'name=Cognome', 'category=Cat.', 'team=Team',
            'time=Time', 'gap=Diff', 'intermedio=10K', 'intermedio=20k',
        ]));
    });

    it('arrivati, intermedi, ritirati e non partiti', () => {
        const { results } = csvToResults(csv);
        expect(results).toHaveLength(6);
        expect(results[0]).toMatchObject({
            position: 1, bib: '1', athleteName: 'ROSSI, MARIO', category: 'SM', team: 'ASD ESEMPIO',
            time: '1h07:09', gap: '--', status: 'finisher',
            lapSplits: [{ lap: 1, split: '10K', cum: '0h31:23' }, { lap: 2, split: '20k', cum: '1h03:36' }],
        });
        expect(results[4]).toMatchObject({ status: 'dnf', position: 0, time: '' });
        expect(results[5]).toMatchObject({ status: 'dns' });
    });

    it('senza colonna nome → errore chiaro', () => {
        expect(() => csvToResults('Pos;Tempo\n1;1:00:00')).toThrow(/nome/);
    });

    it('righe di sezione (es. categoria) come categoria di ripiego', () => {
        const { results } = csvToResults('Pos;Atleta;Tempo\nMASTER 40;;\n1;ROSSI MARIO;40:00');
        expect(results[0]).toMatchObject({ athleteName: 'ROSSI MARIO', category: 'MASTER 40' });
    });
});
