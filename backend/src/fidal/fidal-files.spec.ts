import * as XLSX from 'xlsx';
import { deflateRawSync } from 'zlib';
import { parseAthletesCsv, parseSocietiesCsv, ymdToDate } from './fidal.csv';
import { parseFidalDump } from './fidal.dump';
import { csvFiles, unzip } from './zip';

// Lettura dei file del portale tesseramento FIDAL caricati dall'admin.
// Tracciato reale (senza intestazione, 26 colonne nell'export con certificato);
// dati inventati.

const row = (over: Partial<Record<number, string>> = {}, cols = 26) => {
    const r = Array.from({ length: cols }, () => '');
    Object.assign(r, {
        0: '2026', 1: 'ABR', 2: 'CH', 3: 'AG', 4: 'SF35', 5: 'R', 6: 'CH999', 7: '20260115', 8: 'zz123456',
        9: 'PROVA', 10: 'GIULIA', 11: 'PESCARA', 12: '19880403', 13: 'N', 15: '20251201', 25: '20271231',
    }, over);
    return r.slice(0, cols).map(v => `"${v}"`).join(',');
};

/** Zip minimale (deflate) per i test. */
function makeZip(files: { name: string; data: Buffer }[]): Buffer {
    const locals: Buffer[] = []; const centrals: Buffer[] = []; let off = 0;
    for (const f of files) {
        const comp = deflateRawSync(f.data); const name = Buffer.from(f.name);
        const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(8, 8);
        lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(f.data.length, 22); lh.writeUInt16LE(name.length, 26);
        const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(8, 10);
        ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(f.data.length, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(off, 42);
        locals.push(lh, name, comp); centrals.push(ch, name); off += 30 + name.length + comp.length;
    }
    const cd = Buffer.concat(centrals);
    const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
    end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
    return Buffer.concat([...locals, cd, end]);
}

describe('file atleti del portale tesseramento', () => {
    it('export con certificato (26 colonne): scadenza dall\'ultima colonna, NON dalla data movimento', () => {
        const { rows, withCert } = parseAthletesCsv(Buffer.from(row() + '\r\n', 'latin1'));
        expect(withCert).toBe(true);
        const [a] = rows;
        expect(a).toMatchObject({ tessera: 'ZZ123456', cognome: 'PROVA', nome: 'GIULIA', sesso: 'F', codiceSocieta: 'CH999' });
        expect(a.certScadenza?.toISOString().slice(0, 10)).toBe('2027-12-31');
        expect(a.dataNascita?.toISOString().slice(0, 10)).toBe('1988-04-03');
    });

    it('la società NON è il luogo di nascita (il nome arriva dall\'anagrafica società)', () => {
        const [a] = parseAthletesCsv(Buffer.from(row(), 'latin1')).rows;
        expect(a.societa).not.toBe('PESCARA');
        expect(a.societa).toBe('');
    });

    it('export "Atleti" senza certificato (25 colonne) riconosciuto', () => {
        const r = parseAthletesCsv(Buffer.from(row({}, 25), 'latin1'));
        expect(r.withCert).toBe(false);
        expect(r.rows[0].certScadenza).toBeNull();
    });

    it('date "00000000" e impossibili (es. 20270200, 20270229) → nessuna data inventata', () => {
        for (const v of ['00000000', '20270200', '20270029', '20270229', '2027123']) expect(ymdToDate(v)).toBeNull();
        expect(ymdToDate('20280229')?.toISOString().slice(0, 10)).toBe('2028-02-29');
    });

    it('accenti in latin-1 e virgolette nei valori', () => {
        const [a] = parseAthletesCsv(Buffer.from(row({ 9: "D'ANGELÒ", 10: 'NICOLÒ "NICO"'.replace(/"/g, '""') }), 'latin1')).rows;
        expect(a.cognome).toBe("D'ANGELÒ");
        expect(a.nome).toBe('NICOLÒ "NICO"');
    });

    it('zip scaricato dal portale aperto direttamente (anche con più parti)', () => {
        const zip = makeZip([
            { name: 'ATLETI_DBASE.CSV', data: Buffer.from(row() + '\r\n' + row({ 8: 'ZZ000002', 9: 'ESEMPIO' }), 'latin1') },
            { name: 'leggimi.txt', data: Buffer.from('x') },
        ]);
        expect(unzip(zip).map(e => e.name)).toEqual(['ATLETI_DBASE.CSV', 'leggimi.txt']);
        const files = csvFiles(zip, 'ATLETI_DBASE.CSV_12.zip');
        expect(files).toHaveLength(1);
        expect(parseAthletesCsv(files[0].data).rows).toHaveLength(2);
    });

    it('file che non è uno zip valido → errore chiaro', () => {
        expect(() => unzip(Buffer.from('PK\x03\x04 rotto'))).toThrow(/zip non valido/);
    });
});

describe('file società', () => {
    it('csv con intestazione (come dal portale)', () => {
        const csv = "﻿ANNO,REGIONE,COD.SOC,SGR_PROV,SETTORI,DENOMINAZIONE,ENTE,SEDE/LOCALITA',SEDE/PROVINCIA\n2026,ABR,ch999,CH,AG,ATLETICA PROVA,FIDAL,Pescara,PE\n";
        expect(parseSocietiesCsv(Buffer.from(csv))).toEqual([
            { codice: 'CH999', denominazione: 'ATLETICA PROVA', citta: 'Pescara', provincia: 'PE', regione: 'ABR', ente: 'FIDAL' },
        ]);
    });
});

describe('vecchio dump .xlsx', () => {
    it('ancora leggibile', () => {
        const r = ['', '', '', '', 'SF35', '', '', 'CH999', '20271231', 'zz123456', 'PROVA', 'GIULIA', 'Pescara', '', '', '1988'];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([r]), 'Atleti');
        const [a] = parseFidalDump(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer);
        expect(a).toMatchObject({ tessera: 'ZZ123456', codiceSocieta: 'CH999' });
    });
});
