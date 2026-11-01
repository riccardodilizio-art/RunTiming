import * as XLSX from 'xlsx';

// Import iscritti da Excel nel tracciato Race Result (lo stesso dell'export):
// Cognome, Nome, DataDiNascita (o AnnoDiNascita), Genere, Società, CodiceSocietà,
// Licenza, Email, Nazione. Le intestazioni si riconoscono anche con spazi/accenti.

export interface AtletaImport {
    nome: string;
    cognome: string;
    dataNascita: string;      // YYYY-MM-DD
    sesso: 'M' | 'F';
    societa?: string;
    codiceSocieta?: string;
    tessera?: string;
    email?: string;
    nazionalita?: string;
}

export interface RigaImport {
    /** Numero della riga nel file (1 = intestazione). */
    riga: number;
    atleta?: AtletaImport;
    errore?: string;
}

export const COLONNE_MODELLO = ['Cognome', 'Nome', 'DataDiNascita', 'Genere', 'Società', 'CodiceSocietà', 'Licenza', 'Email', 'Nazione'];

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');

const ALIAS: Record<keyof AtletaImport | 'anno', string[]> = {
    cognome: ['cognome', 'surname', 'lastname'],
    nome: ['nome', 'name', 'firstname'],
    dataNascita: ['datadinascita', 'datanascita', 'nascita', 'birthdate', 'datadinascitaggmmaaaa'],
    anno: ['annodinascita', 'annonascita', 'anno'],
    sesso: ['genere', 'sesso', 'sex', 'gender'],
    societa: ['societa', 'club', 'team', 'squadra'],
    codiceSocieta: ['codicesocieta', 'codsocieta', 'codsoc'],
    tessera: ['licenza', 'tessera', 'tesserafidal', 'numerotessera', 'numtessera'],
    email: ['email', 'mail', 'posta'],
    nazionalita: ['nazione', 'nazionalita', 'nation', 'nat'],
};

const pad = (n: number) => String(n).padStart(2, '0');

/** Data di nascita da cella Excel: data, numero seriale, "gg/mm/aaaa" o "aaaa-mm-gg". */
export function dataDaCella(v: unknown): string | null {
    if (v instanceof Date && !isNaN(v.getTime())) {
        // Mezzanotte locale: si usano i campi locali per non spostare il giorno
        return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
    }
    if (typeof v === 'number' && v > 1000 && v < 80000) {
        const d = new Date(Math.round((v - 25569) * 86400 * 1000));
        return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    }
    const s = String(v ?? '').trim();
    let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (m) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
    m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
    return null;
}

/** Righe del file → atleti (con l'errore per le righe da correggere). */
export function righeDaTabella(tabella: unknown[][]): RigaImport[] {
    if (!tabella.length) return [];
    const head = tabella[0].map(c => norm(String(c ?? '')));
    const col = (k: keyof typeof ALIAS) => head.findIndex(h => ALIAS[k].includes(h));
    const idx = Object.fromEntries((Object.keys(ALIAS) as (keyof typeof ALIAS)[]).map(k => [k, col(k)])) as Record<keyof typeof ALIAS, number>;
    if (idx.cognome < 0 || idx.nome < 0) throw new Error('Il file deve avere le colonne Cognome e Nome nella prima riga (scarica il modello)');
    const out: RigaImport[] = [];
    tabella.slice(1).forEach((r, i) => {
        const get = (k: keyof typeof ALIAS) => (idx[k] >= 0 ? r[idx[k]] : undefined);
        const txt = (k: keyof typeof ALIAS) => String(get(k) ?? '').trim();
        if (!r.some(c => String(c ?? '').trim())) return; // riga vuota
        const riga = i + 2;
        const anno = txt('anno');
        const dataNascita = dataDaCella(get('dataNascita')) ?? (/^\d{4}$/.test(anno) ? `${anno}-01-01` : null);
        const g = txt('sesso').toUpperCase();
        const sesso = /^(M|U|MASCHIO|UOMO|MALE)$/.test(g) ? 'M' : /^(F|D|FEMMINA|DONNA|FEMALE)$/.test(g) ? 'F' : null;
        const mancano = [!txt('cognome') && 'cognome', !txt('nome') && 'nome', !dataNascita && 'data di nascita', !sesso && 'genere (M/F)'].filter(Boolean);
        if (mancano.length) { out.push({ riga, errore: `Manca: ${mancano.join(', ')}` }); return; }
        const opt = (k: keyof typeof ALIAS) => txt(k) || undefined;
        const naz = opt('nazionalita')?.toUpperCase();
        out.push({
            riga,
            atleta: {
                cognome: txt('cognome'), nome: txt('nome'), dataNascita: dataNascita!, sesso: sesso!,
                societa: opt('societa'), codiceSocieta: opt('codiceSocieta'), tessera: opt('tessera')?.toUpperCase(),
                email: opt('email'), nazionalita: naz && /^[A-Z]{3}$/.test(naz) ? naz : undefined,
            },
        });
    });
    return out;
}

/** Legge il primo foglio di un file Excel o CSV. */
export async function leggiFile(file: File): Promise<RigaImport[]> {
    const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) throw new Error('Il file non contiene fogli');
    return righeDaTabella(XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: '' }));
}

/** Scarica il modello vuoto con le colonne giuste. */
export function scaricaModello() {
    const ws = XLSX.utils.aoa_to_sheet([COLONNE_MODELLO, ['ROSSI', 'MARIO', '15/03/1980', 'M', 'ASD ESEMPIO', 'XX123', 'AB123456', 'mario@esempio.it', 'ITA']]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tabelle1');
    XLSX.writeFile(wb, 'modello-iscritti.xlsx');
}
