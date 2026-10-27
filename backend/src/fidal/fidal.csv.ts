import * as XLSX from 'xlsx';
import type { FidalDumpRow } from './fidal.dump';

// Parser dei dump FIDAL in formato CSV (l'export corrente).
//
// ATLETI (nessuna intestazione, separatore virgola). Layout diverso dall'xlsx
// — manca la colonna "cognome,nome,anno" — e con DATA DI NASCITA COMPLETA:
//   4 categoria (sesso), 6 codice società, 7 scadenza cert (YYYYMMDD),
//   8 tessera, 9 cognome, 10 nome, 11 comune, 12 data nascita (YYYYMMDD).
// SOCIETÀ (con intestazione): COD.SOC → DENOMINAZIONE (+ città/prov/regione/ente).

type Cell = string | number | null | undefined;

const A = { categoria: 4, codiceSocieta: 6, certScadenza: 7, tessera: 8, cognome: 9, nome: 10, comune: 11, dataNascita: 12 };

const str = (v: Cell) => (v == null ? '' : String(v).trim());

/** "20251231" → Date(2025-12-31), altrimenti null. */
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

/** Atleti CSV → righe FidalAthlete (deduplicate per tessera). */
export function parseAthletesCsv(buffer: Buffer): FidalDumpRow[] {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, defval: '', raw: false });
    const byTessera = new Map<string, FidalDumpRow>();
    for (const row of rows) {
        const tessera = str(row[A.tessera]).toUpperCase();
        if (!tessera) continue;
        byTessera.set(tessera, {
            tessera,
            tipo: 'fidal',
            nome: str(row[A.nome]),
            cognome: str(row[A.cognome]),
            dataNascita: ymdToDate(row[A.dataNascita]),
            sesso: sexFromCategory(str(row[A.categoria])),
            societa: str(row[A.comune]),
            codiceSocieta: str(row[A.codiceSocieta]),
            certScadenza: ymdToDate(row[A.certScadenza]),
        });
    }
    return [...byTessera.values()];
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
