import * as XLSX from 'xlsx';
import { parseAthletesCsv, parseSocietiesCsv } from './fidal.csv';
import { parseFidalDump } from './fidal.dump';

// Lettura dei file FIDAL caricati dall'admin con la libreria xlsx (SheetJS):
// verifica che un aggiornamento della libreria non rompa gli import.
// Dati inventati.

describe('import file FIDAL (xlsx/csv)', () => {
    it('dump .xlsx: tessera, nomi, anno di nascita, scadenza certificato', () => {
        // colonne: 4 categoria, 7 cod. società, 8 scad. cert, 9 tessera, 10 cognome, 11 nome, 12 comune, 15 anno
        const row = ['', '', '', '', 'SF35', '', '', 'CH999', '20271231', 'zz123456', 'PROVA', 'GIULIA', 'Pescara', '', '', '1988'];
        const ws = XLSX.utils.aoa_to_sheet([row]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Atleti');
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
        const [a] = parseFidalDump(buf);
        expect(a).toMatchObject({ tessera: 'ZZ123456', cognome: 'PROVA', nome: 'GIULIA', sesso: 'F', codiceSocieta: 'CH999' });
        expect(a.dataNascita?.toISOString().slice(0, 10)).toBe('1988-01-01');
        expect(a.certScadenza?.toISOString().slice(0, 10)).toBe('2027-12-31');
    });

    it('csv atleti (senza intestazione): data di nascita completa', () => {
        const csv = ',,,,SM40,,CH999,20270630,ZZ654321,ESEMPIO,MARCO,Chieti,19830215\n';
        const [a] = parseAthletesCsv(Buffer.from(csv));
        expect(a).toMatchObject({ tessera: 'ZZ654321', cognome: 'ESEMPIO', nome: 'MARCO', sesso: 'M' });
        expect(a.dataNascita?.toISOString().slice(0, 10)).toBe('1983-02-15');
    });

    it('csv società (con intestazione)', () => {
        const csv = "COD.SOC,DENOMINAZIONE,SEDE/LOCALITA',SEDE/PROVINCIA,REGIONE,ENTE\nch999,ATLETICA PROVA,Pescara,PE,ABRUZZO,FIDAL\n";
        expect(parseSocietiesCsv(Buffer.from(csv))).toEqual([
            { codice: 'CH999', denominazione: 'ATLETICA PROVA', citta: 'Pescara', provincia: 'PE', regione: 'ABRUZZO', ente: 'FIDAL' },
        ]);
    });
});
