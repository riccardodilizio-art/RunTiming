// Conversione di una lista Race Result (CSV della Simple API locale) nel
// formato `Result` del sito. Le colonne si riconoscono dal nome dell'intestazione,
// così funziona con le liste che già usi (Pos., Pett., Cognome, Cat., Team,
// 10K, 20k, Time, Diff…) senza configurazioni.

export interface LapSplit {
    lap: number;
    split: string;
    cum: string;
}

export interface Result {
    position: number;
    bib: string;
    athleteName: string;
    category: string;
    team?: string;
    time: string;
    gap?: string;
    status: 'finisher' | 'dnf' | 'dns' | 'dsq';
    lapSplits?: LapSplit[];
}

/** Parser CSV con virgolette; separatore rilevato tra ; , e tab. */
export function parseCsv(text: string): string[][] {
    const clean = text.replace(/^﻿/, '');
    const first = clean.split(/\r?\n/, 1)[0] ?? '';
    const sep = [';', '\t', ','].reduce((best, c) => (first.split(c).length > first.split(best).length ? c : best), ',');
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < clean.length; i++) {
        const ch = clean[i];
        if (quoted) {
            if (ch === '"' && clean[i + 1] === '"') { cell += '"'; i++; }
            else if (ch === '"') quoted = false;
            else cell += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === sep) { row.push(cell); cell = ''; }
        else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && clean[i + 1] === '\n') i++;
            row.push(cell); rows.push(row); row = []; cell = '';
        } else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(r => r.some(c => c.trim() !== ''));
}

const norm = (h: string) => h.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

type Field = 'position' | 'bib' | 'name' | 'cognome' | 'nome' | 'category' | 'team' | 'time' | 'gap';
const PATTERNS: [Field, RegExp][] = [
    ['position', /^(pos|posizione|pgen|posass|place|rank|clas|classifica)$/],
    ['bib', /^(pett|pettorale|bib|num|numero|n)$/],
    ['name', /^(atleta|nominativo|name|cognomenome|nomecognome|concorrente)$/],
    ['cognome', /^(cognome|surname|lastname)$/],
    ['nome', /^(nome|firstname)$/],
    ['category', /^(cat|categoria|category|agegroup|ag)$/],
    ['team', /^(team|societa|club|squadra|society)$/],
    ['time', /^(time|tempo|tempoufficiale|racetime|tempogara|real|tempofinale|finish|arrivo)$/],
    ['gap', /^(diff|gap|distacco|ritardo)$/],
];
/** Intestazioni degli intermedi: "10K", "20 km", "Km 5", "Int. 1"… */
const SPLIT = /^(\d+([.,]\d+)?k(m)?|km\d+([.,]\d+)?|int\d+|split\d+|lap\d+|giro\d+)$/;

export function mapColumns(headers: string[]) {
    const idx: Partial<Record<Field, number>> = {};
    const splits: { i: number; label: string }[] = [];
    headers.forEach((h, i) => {
        const n = norm(h);
        if (!n) return;
        for (const [f, re] of PATTERNS) {
            if (idx[f] === undefined && re.test(n)) { idx[f] = i; return; }
        }
        if (SPLIT.test(n)) splits.push({ i, label: h.trim() });
    });
    // Se "Cognome" contiene "COGNOME, NOME" ed esiste solo lui, usalo come nome completo
    if (idx.name === undefined && idx.cognome !== undefined && idx.nome === undefined) {
        idx.name = idx.cognome;
        delete idx.cognome;
    }
    return { idx, splits };
}

const STATUS: Record<string, Result['status']> = { dnf: 'dnf', rit: 'dnf', ritirato: 'dnf', dns: 'dns', np: 'dns', dsq: 'dsq', sq: 'dsq', dq: 'dsq' };

/** Righe CSV → risultati. Le righe con una sola cella piena sono intestazioni di sezione. */
export function csvToResults(text: string): { results: Result[]; columns: string[]; recognized: string[] } {
    const rows = parseCsv(text);
    if (!rows.length) return { results: [], columns: [], recognized: [] };
    const headers = rows[0];
    const { idx, splits } = mapColumns(headers);
    if (idx.name === undefined && idx.cognome === undefined) {
        throw new Error('Colonna del nome non trovata (attese: Cognome, Nome, Atleta…)');
    }
    const get = (r: string[], f: Field) => (idx[f] !== undefined ? (r[idx[f]!] ?? '').trim() : '');
    const results: Result[] = [];
    let section = '';
    let counter = 0;
    for (const r of rows.slice(1)) {
        const filled = r.filter(c => c.trim() !== '');
        if (filled.length === 1 && r.length > 1) { section = filled[0].trim(); continue; }
        const name = get(r, 'name') || `${get(r, 'cognome')} ${get(r, 'nome')}`.trim();
        if (!name) continue;
        const posText = get(r, 'position');
        const time = get(r, 'time');
        const lapSplits = splits
            .map((s, k) => ({ lap: k + 1, split: s.label, cum: (r[s.i] ?? '').trim() }))
            .filter(s => s.cum);
        // Senza tempo: ritirato se ha almeno un intermedio, altrimenti non partito
        const status = STATUS[norm(posText)] ?? STATUS[norm(time)]
            ?? (time ? 'finisher' : lapSplits.length ? 'dnf' : 'dns');
        if (status === 'finisher') counter++;
        const pos = parseInt(posText.replace(/[^\d]/g, ''), 10);
        results.push({
            position: status === 'finisher' ? (Number.isFinite(pos) ? pos : counter) : 0,
            bib: get(r, 'bib'),
            athleteName: name,
            category: get(r, 'category') || section,
            team: get(r, 'team') || undefined,
            time: status === 'finisher' ? time : '',
            gap: get(r, 'gap') || undefined,
            status,
            ...(lapSplits.length ? { lapSplits } : {}),
        });
    }
    const recognized = [
        ...Object.keys(idx).map(f => `${f}=${headers[idx[f as Field]!]}`),
        ...splits.map(s => `intermedio=${s.label}`),
    ];
    return { results, columns: headers, recognized };
}
