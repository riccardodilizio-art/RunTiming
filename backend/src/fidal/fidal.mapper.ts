// Mapping dei dati atleta restituiti da WISE verso il nostro modello.
//
// Forma nota (endpoint OnGetAtleta), JSON derivato da XML:
//   { "?xml": {...}, "tesserato": { "Atleta": { NTessera, Cognome, Nome,
//     DataNas, Sesso, Categoria, SocGar: "649318/MC001", ... } } }
// La ricerca per parametri (OngGetAtletaFidalByParametri) restituisce più
// atleti: l'estrattore qui sotto tollera oggetto singolo, lista o wrapper.

export interface FidalAthleteDto {
    tessera: string;
    tipo: string;          // sempre 'fidal' da questa fonte
    nome: string;
    cognome: string;
    dataNascita: string | null;   // ISO YYYY-MM-DD
    sesso: string;
    categoria: string;
    codiceSocieta: string;
    societa: string;       // qui abbiamo solo codici: arricchito altrove con la denominazione
}

interface RawAtleta {
    NTessera?: string;
    Cognome?: string;
    Nome?: string;
    DataNas?: string;
    Sesso?: string;
    Categoria?: string;
    SocGar?: string;
    SocApp?: string;
    CodiceSocieta?: string;
    [k: string]: unknown;
}

/** Ricava il codice società FIDAL da "SocGar" tipo "649318/MC001" → "MC001". */
function codiceSocieta(raw: RawAtleta): string {
    const socGar = String(raw.SocGar ?? '').trim();
    if (socGar.includes('/')) return socGar.split('/')[1].trim();
    return String(raw.CodiceSocieta ?? '').trim();
}

export function mapAtleta(raw: RawAtleta): FidalAthleteDto {
    const dataNas = String(raw.DataNas ?? '').trim();
    return {
        tessera: String(raw.NTessera ?? '').trim().toUpperCase(),
        tipo: 'fidal',
        nome: String(raw.Nome ?? '').trim(),
        cognome: String(raw.Cognome ?? '').trim(),
        dataNascita: /^\d{4}-\d{2}-\d{2}/.test(dataNas) ? dataNas.slice(0, 10) : null,
        sesso: String(raw.Sesso ?? '').trim(),
        categoria: String(raw.Categoria ?? '').trim(),
        codiceSocieta: codiceSocieta(raw),
        societa: codiceSocieta(raw),
    };
}

/**
 * Estrae la lista di atleti grezzi da una risposta WISE, tollerando le varie
 * forme possibili (singolo, array, wrapper `tesserato.Atleta`, `data`, ecc.).
 */
export function extractAtleti(json: unknown): RawAtleta[] {
    if (json == null) return [];
    if (Array.isArray(json)) return json as RawAtleta[];

    const obj = json as Record<string, unknown>;

    // wrapper tesserato.Atleta (può essere oggetto o array)
    const tesserato = obj.tesserato as Record<string, unknown> | undefined;
    if (tesserato?.Atleta) {
        const a = tesserato.Atleta;
        return Array.isArray(a) ? (a as RawAtleta[]) : [a as RawAtleta];
    }

    // wrapper .data / .Data / .atleti / .Atleti
    for (const key of ['data', 'Data', 'atleti', 'Atleti', 'Atleta', 'results']) {
        const v = obj[key];
        if (Array.isArray(v)) return v as RawAtleta[];
        if (v && typeof v === 'object') return [v as RawAtleta];
    }

    // sembra già un singolo atleta
    if (obj.NTessera || obj.Cognome) return [obj as RawAtleta];

    return [];
}
