// Parser del dump tesseramenti FIDAL (.xlsx) lato backend → righe FidalAthlete.
// Stesso tracciato a colonne fisse del parser frontend (nessuna intestazione):
//   col 4 categoria (sesso), 7 codice società, 8 scadenza certificato (YYYYMMDD),
//   9 tessera, 10 cognome, 11 nome, 12 comune, 15 anno di nascita.
// Il dump è l'unica fonte della SCADENZA CERTIFICATO (WISE non la restituisce).

import * as XLSX from 'xlsx';

export interface FidalDumpRow {
    tessera: string;
    tipo: string;
    nome: string;
    cognome: string;
    dataNascita: Date | null;
    sesso: string;
    societa: string;
    codiceSocieta: string;
    certScadenza: Date | null;
}

type Cell = string | number | null | undefined;

const COL = { categoria: 4, codiceSocieta: 7, certScadenza: 8, tessera: 9, cognome: 10, nome: 11, comune: 12, annoNascita: 15 };

const str = (v: Cell) => (v == null ? '' : String(v).trim());

/** "20251226" → Date(2025-12-26), altrimenti null. */
function ymdToDate(v: Cell): Date | null {
    const s = str(v);
    if (!/^\d{8}$/.test(s)) return null;
    const d = new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T00:00:00Z`);
    return isNaN(d.getTime()) ? null : d;
}

function sexFromCategory(cat: string): string {
    const m = cat.toUpperCase().match(/^[A-Z]*?([MF])/);
    return m && m[1] === 'F' ? 'F' : 'M';
}

function rowToRecord(row: Cell[]): FidalDumpRow | null {
    const tessera = str(row[COL.tessera]).toUpperCase();
    if (!tessera) return null;
    const anno = str(row[COL.annoNascita]);
    return {
        tessera,
        tipo: 'fidal',
        nome: str(row[COL.nome]),
        cognome: str(row[COL.cognome]),
        dataNascita: /^\d{4}$/.test(anno) ? new Date(`${anno}-01-01T00:00:00Z`) : null,
        sesso: sexFromCategory(str(row[COL.categoria])),
        societa: str(row[COL.comune]),
        codiceSocieta: str(row[COL.codiceSocieta]),
        certScadenza: ymdToDate(row[COL.certScadenza]),
    };
}

/** Legge un buffer .xlsx e restituisce le righe FidalAthlete (deduplicate per tessera). */
export function parseFidalDump(buffer: Buffer): FidalDumpRow[] {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, defval: '' });
    const byTessera = new Map<string, FidalDumpRow>();
    for (const row of rows) {
        const rec = rowToRecord(row);
        if (rec) byTessera.set(rec.tessera, rec);
    }
    return [...byTessera.values()];
}
