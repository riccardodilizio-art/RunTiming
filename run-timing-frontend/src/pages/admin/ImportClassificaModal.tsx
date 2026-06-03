import { useState } from 'react';
import * as XLSX from 'xlsx';
import { X, Check, Upload, FileSpreadsheet } from 'lucide-react';
import type { Result } from '../../types';

type TargetKey = 'position' | 'bib' | 'athleteName' | 'cognome' | 'nome' | 'category' | 'team' | 'time' | 'gap';

const TARGETS: { key: TargetKey; label: string; hint?: string }[] = [
    { key: 'position',    label: 'Posizione' },
    { key: 'bib',         label: 'Pettorale' },
    { key: 'athleteName', label: 'Atleta (nome completo)', hint: 'usa questo OPPURE Cognome + Nome' },
    { key: 'cognome',     label: 'Cognome' },
    { key: 'nome',        label: 'Nome' },
    { key: 'category',    label: 'Categoria' },
    { key: 'team',        label: 'Squadra / Società' },
    { key: 'time',        label: 'Tempo' },
    { key: 'gap',         label: 'Distacco' },
];

function guess(headers: string[], key: TargetKey): number {
    const h = headers.map(x => (x ?? '').toString().trim().toLowerCase());
    const find = (pred: (s: string) => boolean) => h.findIndex(pred);
    switch (key) {
        case 'position':    return find(s => s.startsWith('pos') && !s.includes('sex') && !s.includes('cat'));
        case 'bib':         return find(s => s.startsWith('pett') || s === 'bib' || s === 'n. gara' || s.includes('pettorale'));
        case 'cognome':     return find(s => s.includes('cogn'));
        case 'nome':        return find(s => s === 'nome' || (s.includes('nome') && !s.includes('cogn')));
        case 'athleteName': return find(s => s === 'atleta' || s === 'nominativo');
        case 'category':    return find(s => s === 'cat.' || s === 'cat' || s.includes('categ'));
        case 'team':        return find(s => s.includes('team') || s.includes('squad') || s.includes('societ'));
        case 'time':        return find(s => s === 'time' || s.includes('tempo'));
        case 'gap':         return find(s => s.includes('diff') || s.includes('gap') || s.includes('distac'));
        default:            return -1;
    }
}

/** Una riga è una "sezione" (es. "10K") se ha un solo valore non vuoto. */
function isSectionRow(row: unknown[]): boolean {
    const filled = row.filter(c => String(c ?? '').trim() !== '');
    return filled.length === 1;
}

function cell(row: unknown[], idx: number): string {
    if (idx < 0) return '';
    return String(row[idx] ?? '').trim();
}

export default function ImportClassificaModal({
    onImport,
    onClose,
}: {
    onImport: (results: Result[]) => void;
    onClose: () => void;
}) {
    const [headers, setHeaders] = useState<string[]>([]);
    const [rows, setRows] = useState<unknown[][]>([]);
    const [map, setMap] = useState<Record<TargetKey, number>>({} as Record<TargetKey, number>);
    const [fileName, setFileName] = useState('');
    const [error, setError] = useState('');

    function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setError('');
        const reader = new FileReader();
        reader.onload = ev => {
            try {
                const wb = XLSX.read(ev.target?.result, { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
                if (aoa.length < 2) throw new Error('Il file non contiene dati sufficienti.');
                const hdr = (aoa[0] as unknown[]).map(c => String(c ?? ''));
                setHeaders(hdr);
                setRows(aoa.slice(1));
                setFileName(file.name);
                const initial = {} as Record<TargetKey, number>;
                TARGETS.forEach(t => { initial[t.key] = guess(hdr, t.key); });
                setMap(initial);
            } catch (err) {
                setError((err as Error).message);
            }
        };
        reader.readAsArrayBuffer(file);
    }

    function buildResults(): Result[] {
        const out: Result[] = [];
        let section = '';
        let pos = 0;
        for (const row of rows) {
            if (isSectionRow(row)) {
                section = String(row.find(c => String(c ?? '').trim() !== '') ?? '').trim();
                pos = 0;
                continue;
            }
            const full = cell(row, map.athleteName);
            const name = full || `${cell(row, map.cognome)} ${cell(row, map.nome)}`.trim();
            if (!name) continue;
            pos += 1;
            const posCell = cell(row, map.position).replace(/[^\d]/g, '');
            out.push({
                position: posCell ? parseInt(posCell) : pos,
                bib: cell(row, map.bib),
                athleteName: name,
                category: cell(row, map.category) || section,
                team: cell(row, map.team) || undefined,
                time: cell(row, map.time),
                gap: cell(row, map.gap) || undefined,
                status: 'finisher',
            });
        }
        return out;
    }

    const preview = headers.length > 0 ? buildResults() : [];

    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5 text-emerald-600" /> Importa classifica (Excel)
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                </div>

                <div className="overflow-y-auto px-6 py-4 flex-1 space-y-4">
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-xs">{error}</div>
                    )}

                    {headers.length === 0 ? (
                        <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-xl py-10 cursor-pointer hover:border-brand-400 hover:bg-brand-50/40 transition-colors">
                            <Upload className="h-8 w-8 text-slate-300" />
                            <span className="text-sm text-slate-500">Seleziona il file Excel della classifica (.xlsx)</span>
                            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
                        </label>
                    ) : (
                        <>
                            <p className="text-xs text-slate-500">
                                File: <strong>{fileName}</strong> — associa le colonne del file ai campi della classifica.
                                Le righe-sezione (es. <em>10K</em>) sono rilevate automaticamente e usate come categoria.
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {TARGETS.map(t => (
                                    <div key={t.key}>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">
                                            {t.label}{t.hint && <span className="text-slate-400 font-normal"> — {t.hint}</span>}
                                        </label>
                                        <select
                                            value={map[t.key] ?? -1}
                                            onChange={e => setMap(m => ({ ...m, [t.key]: parseInt(e.target.value) }))}
                                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                        >
                                            <option value={-1}>— nessuna —</option>
                                            {headers.map((h, i) => (
                                                <option key={i} value={i}>{h || `Colonna ${i + 1}`}</option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                            </div>

                            {/* Anteprima */}
                            <div>
                                <p className="text-xs font-semibold text-slate-500 mb-1">Anteprima ({preview.length} righe)</p>
                                <div className="border border-slate-200 rounded-lg overflow-x-auto max-h-48 overflow-y-auto">
                                    <table className="w-full text-xs">
                                        <thead className="bg-slate-50 text-slate-500">
                                            <tr><th className="px-2 py-1 text-left">Pos</th><th className="px-2 py-1 text-left">Pett.</th><th className="px-2 py-1 text-left">Atleta</th><th className="px-2 py-1 text-left">Cat.</th><th className="px-2 py-1 text-left">Tempo</th></tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {preview.slice(0, 12).map((r, i) => (
                                                <tr key={i}>
                                                    <td className="px-2 py-1">{r.position}</td>
                                                    <td className="px-2 py-1">{r.bib}</td>
                                                    <td className="px-2 py-1">{r.athleteName}</td>
                                                    <td className="px-2 py-1">{r.category}</td>
                                                    <td className="px-2 py-1">{r.time}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 text-sm hover:bg-slate-50">Annulla</button>
                    <button
                        disabled={preview.length === 0}
                        onClick={() => onImport(preview)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors disabled:opacity-50"
                    >
                        <Check className="h-4 w-4" /> Importa {preview.length > 0 ? `(${preview.length})` : ''}
                    </button>
                </div>
            </div>
        </div>
    );
}
