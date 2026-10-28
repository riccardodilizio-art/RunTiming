import * as XLSX from 'xlsx';
import type { FidalDumpRow } from './fidal.dump';

// Parser dei file scaricati dal portale del tesseramento FIDAL (sezione Download).
//
// ATLETI (nessuna intestazione, valori tra virgolette, date AAAAMMGG, latin-1):
//   4 CATEG, 6 COD_SOC, 7 DAT_MOV (data movimento, NON il certificato), 8 NUM_TES,
//   9 COGN, 10 NOME, 11 LOC_NAS (luogo di nascita), 12 DAT_NAS, … 
// - export "Atleti con data scadenza certificato Medico": 26 colonne, la 26ª è DAT_CER;
// - export "Atleti": 25 colonne, SENZA scadenza del certificato.
// SOCIETÀ (con intestazione): COD.SOC → DENOMINAZIONE (+ città/prov/regione/ente).

type Cell = string | number | null | undefined;

const A = { categoria: 4, codiceSocieta: 6, tessera: 8, cognome: 9, nome: 10, dataNascita: 12, certScadenza: 25 };

const str = (v: Cell) => (v == null ? '' : String(v).trim());

/** "20251231" → Date(2025-12-31); "00000000" o date impossibili (es. 20270200) → null. */
export function ymdToDate(v: Cell): Date | null {
    const s = str(v);
    if (!/^\d{8}$/.test(s)) return null;
    const iso = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
    const d = new Date(`${iso}T00:00:00Z`);
    return isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso ? null : d;
}

function sexFromCategory(cat: string): string {
    const m = cat.toUpperCase().match(/^[A-Z]*?([MF])/);
    return m && m[1] === 'F' ? 'F' : 'M';
}

/** CSV semplice: virgola, valori tra virgolette con "" per le virgolette interne. */
export function parseCsvRows(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let q = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (q) {
            if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
            else if (ch === '"') q = false;
            else cell += ch;
        } else if (ch === '"') q = true;
        else if (ch === ',') { row.push(cell); cell = ''; }
        else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && text[i + 1] === '\n') i++;
            row.push(cell); cell = '';
            if (row.length > 1 || row[0] !== '') rows.push(row);
            row = [];
        } else cell += ch;
    }
    row.push(cell);
    if (row.length > 1 || row[0] !== '') rows.push(row);
    return rows;
}

export interface AthletesFile {
    rows: FidalDumpRow[];
    /** Il file contiene la scadenza del certificato (export "con data scadenza certificato"). */
    withCert: boolean;
}

/** Atleti CSV → righe FidalAthlete (deduplicate per tessera). */
export function parseAthletesCsv(buffer: Buffer): AthletesFile {
    const text = buffer.toString('latin1');
    const all = parseCsvRows(text);
    const withCert = all.length > 0 && all.every(r => r.length >= 26);
    const byTessera = new Map<string, FidalDumpRow>();
    for (const row of all) {
        if (row.length < 13) continue;
        const tessera = str(row[A.tessera]).toUpperCase();
        if (!tessera) continue;
        byTessera.set(tessera, {
            tessera,
            tipo: 'fidal',
            nome: str(row[A.nome]),
            cognome: str(row[A.cognome]),
            dataNascita: ymdToDate(row[A.dataNascita]),
            sesso: sexFromCategory(str(row[A.categoria])),
            // Il nome della società arriva dall'anagrafica società (per codice): qui solo il codice
            societa: '',
            codiceSocieta: str(row[A.codiceSocieta]).toUpperCase(),
            certScadenza: withCert ? ymdToDate(row[A.certScadenza]) : null,
        });
    }
    return { rows: [...byTessera.values()], withCert };
}

export interface SocietyRow {
    codice: string;
    denominazione: string;
    citta?: string;
    provincia?: string;
    regione?: string;
    ente?: string;
}

/** Società CSV (con header) → anagrafica società (deduplicate per codice). */
export function parseSocietiesCsv(buffer: Buffer): SocietyRow[] {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, Cell>>(ws, { defval: '', raw: false });
    const byCode = new Map<string, SocietyRow>();
    for (const r of rows) {
        const codice = str(r['COD.SOC']).toUpperCase();
        if (!codice) continue;
        byCode.set(codice, {
            codice,
            denominazione: str(r['DENOMINAZIONE']),
            citta: str(r["SEDE/LOCALITA'"]) || undefined,
            provincia: str(r['SEDE/PROVINCIA']) || undefined,
            regione: str(r['REGIONE']) || undefined,
            ente: str(r['ENTE']) || undefined,
        });
    }
    return [...byCode.values()];
}
