import type { FidalAthlete } from './mockFidal';

// Parser del tracciato FIDAL ufficiale (export tesseramenti).
// Il file NON ha riga di intestazione: ogni riga è già un atleta e le colonne
// sono a posizione fissa. Mapping ricavato dall'export reale:
//
//   col 4  → categoria (es. "SF45", "SM60") → il sesso si deduce dalla lettera
//   col 7  → codice società (es. "CN007")
//   col 8  → scadenza certificato (YYYYMMDD)
//   col 9  → numero tessera (es. "AA000025")
//   col 10 → cognome
//   col 11 → nome
//   col 12 → comune della società (usato come nome società finché il tracciato
//            non include la colonna "denominazione società")
//   col 15 → anno di nascita
//
// Nota: l'export reale fornisce solo l'ANNO di nascita (non la data completa);
// `dataNascita` viene quindi normalizzata a `${anno}-01-01` (l'anno è ciò che
// conta per categorie/età). Quando il file includerà la denominazione società,
// basterà mappare quella colonna su `societaNome`.

const COL = {
    categoria: 4,
    codiceSocieta: 7,
    certScadenza: 8,
    tessera: 9,
    cognome: 10,
    nome: 11,
    comune: 12,
    annoNascita: 15,
    /** Colonna denominazione società: assente nell'export attuale (-1 = non presente). */
    societaNome: -1,
} as const;

type Cell = string | number | boolean | null | undefined;

function str(v: Cell): string {
    return v === null || v === undefined ? '' : String(v).trim();
}

/** "20251226" → "2025-12-26"; vuoto/non valido → undefined. */
function ymd(v: Cell): string | undefined {
    const s = str(v);
    if (!/^\d{8}$/.test(s)) return undefined;
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

/** Sesso dalla categoria FIDAL: "SF45"→F, "SM60"→M, "CF"→F… */
function sexFromCategory(cat: string): 'M' | 'F' {
    const m = cat.toUpperCase().match(/^[A-Z]*?([MF])/);
    return m && m[1] === 'F' ? 'F' : 'M';
}

/** Converte una riga del tracciato in FidalAthlete, o null se priva di tessera. */
export function parseFidalRow(row: Cell[]): FidalAthlete | null {
    const tessera = str(row[COL.tessera]).toUpperCase();
    if (!tessera) return null;
    const anno = str(row[COL.annoNascita]);
    const comune = str(row[COL.comune]);
    const societaNome = COL.societaNome >= 0 ? str(row[COL.societaNome]) : '';
    return {
        tessera,
        tipo: 'fidal',
        nome: str(row[COL.nome]),
        cognome: str(row[COL.cognome]),
        dataNascita: /^\d{4}$/.test(anno) ? `${anno}-01-01` : '',
        sesso: sexFromCategory(str(row[COL.categoria])),
        societa: societaNome || comune,
        codiceSocieta: str(row[COL.codiceSocieta]),
        certScadenza: ymd(row[COL.certScadenza]),
    };
}

/**
 * Converte l'intero foglio (array di righe) in FidalAthlete[], scartando le
 * righe senza tessera e deduplicando per numero tessera (l'ultima vince).
 */
export function parseFidalRows(rows: Cell[][]): FidalAthlete[] {
    const byTessera = new Map<string, FidalAthlete>();
    for (const row of rows) {
        const rec = parseFidalRow(row);
        if (rec) byTessera.set(rec.tessera, rec);
    }
    return [...byTessera.values()];
}
