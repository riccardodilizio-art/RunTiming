import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { X, Upload, FileSpreadsheet, FileJson, AlertCircle, CheckCircle2, ChevronDown } from 'lucide-react';
import type { LapSplit } from '../../types';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ParsedLapRow {
    bib: string;
    lap: number;
    split: string;
    cum: string;
}

interface Props {
    onImport: (data: Record<string, LapSplit[]>) => void;
    onClose: () => void;
}

// ─── Parsing helpers ────────────────────────────────────────────────────────

// Normalise header: lowercase, remove spaces/underscores, strip accents
function norm(s: string): string {
    return s.toLowerCase().replace(/[\s_\-àáâäèéêëìíîïòóôöùúûü]/g, '');
}

const BIB_KEYS  = ['bib', 'pettorale', 'pet', 'numero', 'num', 'id'];
const LAP_KEYS  = ['lap', 'giro', 'lp', 'turn'];
const SPLIT_KEYS = ['split', 'tempogiro', 'laptime', 'time', 'tempo'];
const CUM_KEYS  = ['cum', 'cumulativo', 'cumulative', 'totale', 'total', 'tempocumulativo'];

function detectCol(headers: string[], candidates: string[]): number {
    for (const c of candidates) {
        const idx = headers.findIndex(h => norm(h) === c);
        if (idx >= 0) return idx;
    }
    return -1;
}

function parseRows(rows: string[][]): ParsedLapRow[] {
    if (!rows.length) return [];

    const firstRow = rows[0];
    const hasHeader = isNaN(Number(firstRow[0]));

    let bibIdx = 0, lapIdx = 1, splitIdx = 2, cumIdx = 3;

    if (hasHeader) {
        bibIdx   = detectCol(firstRow, BIB_KEYS);
        lapIdx   = detectCol(firstRow, LAP_KEYS);
        splitIdx = detectCol(firstRow, SPLIT_KEYS);
        cumIdx   = detectCol(firstRow, CUM_KEYS);
        // fallback to positional if not found
        if (bibIdx < 0)   bibIdx   = 0;
        if (lapIdx < 0)   lapIdx   = 1;
        if (splitIdx < 0) splitIdx = 2;
        if (cumIdx < 0)   cumIdx   = 3;
    }

    const dataRows = hasHeader ? rows.slice(1) : rows;

    return dataRows
        .filter(r => r.length >= 3 && r[bibIdx]?.trim())
        .map(r => ({
            bib:   String(r[bibIdx]).trim(),
            lap:   parseInt(r[lapIdx] ?? '0', 10) || 0,
            split: (r[splitIdx] ?? '').trim(),
            cum:   (r[cumIdx] ?? r[splitIdx] ?? '').trim(),
        }))
        .filter(r => r.bib && r.split);
}

function csvToRows(text: string): string[][] {
    // auto-detect separator
    const sep = text.includes(';') && !text.includes('\t') ? ';' : text.includes('\t') ? '\t' : ',';
    return text
        .split(/\r?\n/)
        .filter(l => l.trim())
        .map(l => l.split(sep).map(c => c.replace(/^["']|["']$/g, '').trim()));
}

function groupByBib(rows: ParsedLapRow[]): Record<string, LapSplit[]> {
    const result: Record<string, LapSplit[]> = {};
    for (const r of rows) {
        if (!result[r.bib]) result[r.bib] = [];
        result[r.bib].push({ lap: r.lap, split: r.split, cum: r.cum });
    }
    // sort by lap number
    for (const bib of Object.keys(result)) {
        result[bib].sort((a, b) => a.lap - b.lap);
    }
    return result;
}

// ─── Component ──────────────────────────────────────────────────────────────

type Step = 'upload' | 'preview' | 'done';

export default function ImportLapsModal({ onImport, onClose }: Props) {
    const [step, setStep]       = useState<Step>('upload');
    const [error, setError]     = useState<string | null>(null);
    const [rows, setRows]       = useState<ParsedLapRow[]>([]);
    const [grouped, setGrouped] = useState<Record<string, LapSplit[]>>({});
    const [fileName, setFileName] = useState('');
    const [dragging, setDragging] = useState(false);
    const [expanded, setExpanded] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const processFile = useCallback((file: File) => {
        setError(null);
        setFileName(file.name);
        const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

        const handleRows = (r: string[][]) => {
            try {
                const parsed = parseRows(r);
                if (!parsed.length) throw new Error('Nessuna riga valida trovata nel file.');
                setRows(parsed);
                setGrouped(groupByBib(parsed));
                setStep('preview');
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Errore nel parsing del file.');
            }
        };

        if (ext === 'json') {
            file.text().then(text => {
                try {
                    const json = JSON.parse(text);
                    // Accept array of objects or array of arrays
                    if (Array.isArray(json) && json.length) {
                        if (Array.isArray(json[0])) {
                            handleRows(json as string[][]);
                        } else {
                            // Array of objects — convert to rows
                            const keys = Object.keys(json[0]);
                            handleRows([keys, ...json.map((o: Record<string, unknown>) => keys.map(k => String(o[k] ?? '')))]);
                        }
                    } else {
                        throw new Error('Il JSON deve essere un array di oggetti o un array di array.');
                    }
                } catch (e) {
                    setError(e instanceof Error ? e.message : 'JSON non valido.');
                }
            });
        } else if (['xlsx', 'xls', 'ods'].includes(ext)) {
            file.arrayBuffer().then(buf => {
                try {
                    const wb = XLSX.read(buf, { type: 'array' });
                    const ws = wb.Sheets[wb.SheetNames[0]];
                    const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false }) as string[][];
                    handleRows(data);
                } catch {
                    setError('Impossibile leggere il file Excel.');
                }
            });
        } else {
            // CSV / TSV / TXT
            file.text().then(text => handleRows(csvToRows(text)));
        }
    }, []);

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f) processFile(f);
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files[0];
        if (f) processFile(f);
    };

    const bibs = Object.keys(grouped);

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
                 onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
                    <div>
                        <h2 className="font-semibold text-slate-800">Importa tempi giro</h2>
                        <p className="text-slate-400 text-xs mt-0.5">Formati supportati: CSV, TSV, XLSX, XLS, JSON</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto">

                    {/* ── Step 1: Upload ── */}
                    {step === 'upload' && (
                        <div className="p-6">
                            <div
                                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${dragging ? 'border-ocean-400 bg-ocean-50' : 'border-slate-300 hover:border-ocean-400 hover:bg-slate-50'}`}
                                onClick={() => fileRef.current?.click()}
                                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                                onDragLeave={() => setDragging(false)}
                                onDrop={onDrop}
                            >
                                <Upload className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                                <p className="text-slate-600 font-medium mb-1">Trascina il file qui</p>
                                <p className="text-slate-400 text-sm mb-4">oppure clicca per selezionarlo</p>
                                <div className="flex flex-wrap justify-center gap-2">
                                    {['CSV', 'TSV', 'XLSX', 'XLS', 'JSON'].map(f => (
                                        <span key={f} className="text-xs bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded">
                                            .{f.toLowerCase()}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <input ref={fileRef} type="file" className="hidden"
                                accept=".csv,.tsv,.txt,.xlsx,.xls,.ods,.json"
                                onChange={onFileChange} />

                            {error && (
                                <div className="mt-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                    {error}
                                </div>
                            )}

                            {/* Format guide */}
                            <div className="mt-6 bg-slate-50 border border-slate-200 rounded-xl p-4">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Formato atteso</p>
                                <div className="space-y-3">
                                    <div>
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <FileSpreadsheet className="w-3.5 h-3.5 text-teal-500" />
                                            <span className="text-xs font-medium text-slate-600">CSV / XLSX — una riga per giro</span>
                                        </div>
                                        <pre className="bg-white border border-slate-200 rounded-lg p-2 text-xs font-mono text-slate-600 overflow-x-auto">{`pettorale,giro,tempo_giro,cumulativo
11,1,3:42,3:42
11,2,3:45,7:27
11,3,3:44,11:11
07,1,3:42,3:42`}</pre>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <FileJson className="w-3.5 h-3.5 text-sky-500" />
                                            <span className="text-xs font-medium text-slate-600">JSON — array di oggetti</span>
                                        </div>
                                        <pre className="bg-white border border-slate-200 rounded-lg p-2 text-xs font-mono text-slate-600 overflow-x-auto">{`[{"bib":"11","lap":1,"split":"3:42","cum":"3:42"},
 {"bib":"11","lap":2,"split":"3:45","cum":"7:27"}]`}</pre>
                                    </div>
                                </div>
                                <p className="text-xs text-slate-400 mt-3">
                                    Le intestazioni possono essere in italiano o inglese. Il separatore CSV viene rilevato automaticamente (virgola, punto e virgola, tab).
                                </p>
                            </div>
                        </div>
                    )}

                    {/* ── Step 2: Preview ── */}
                    {step === 'preview' && (
                        <div className="p-5">
                            <div className="flex items-center gap-2 mb-4 p-3 bg-teal-50 border border-teal-200 rounded-lg">
                                <CheckCircle2 className="w-4 h-4 text-teal-500 flex-shrink-0" />
                                <span className="text-teal-700 text-sm">
                                    <strong>{rows.length}</strong> righe importate da <strong>{fileName}</strong> —
                                    {' '}<strong>{bibs.length}</strong> atleti rilevati
                                </span>
                            </div>

                            {/* Per-athlete accordion preview */}
                            <div className="space-y-2 mb-2">
                                {bibs.slice(0, 10).map(bib => (
                                    <div key={bib} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                                        <button
                                            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                                            onClick={() => setExpanded(expanded === bib ? null : bib)}
                                        >
                                            <span className="font-medium text-slate-700 text-sm">
                                                Pettorale <span className="font-mono text-ocean-700">{bib}</span>
                                                <span className="ml-2 text-slate-400 text-xs">{grouped[bib].length} giri</span>
                                            </span>
                                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expanded === bib ? 'rotate-180' : ''}`} />
                                        </button>
                                        {expanded === bib && (
                                            <div className="border-t border-slate-100">
                                                <table className="w-full text-xs">
                                                    <thead className="bg-slate-50">
                                                        <tr>
                                                            {['Giro', 'Tempo giro', 'Cumulativo'].map(h => (
                                                                <th key={h} className="py-1.5 px-3 text-left text-slate-400 font-semibold">{h}</th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-50">
                                                        {grouped[bib].map(l => (
                                                            <tr key={l.lap}>
                                                                <td className="py-1.5 px-3 text-slate-600">{l.lap}</td>
                                                                <td className="py-1.5 px-3 font-mono text-slate-700">{l.split}</td>
                                                                <td className="py-1.5 px-3 font-mono text-slate-500">{l.cum}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {bibs.length > 10 && (
                                    <p className="text-xs text-slate-400 text-center py-2">
                                        + altri {bibs.length - 10} atleti
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-5 py-4 border-t border-slate-200 flex-shrink-0">
                    {step === 'upload' ? (
                        <button onClick={onClose} className="text-slate-500 hover:text-slate-700 text-sm font-medium">
                            Annulla
                        </button>
                    ) : (
                        <button onClick={() => { setStep('upload'); setRows([]); setGrouped({}); setError(null); }}
                            className="text-slate-500 hover:text-slate-700 text-sm font-medium">
                            ← Ricarica file
                        </button>
                    )}

                    {step === 'preview' && (
                        <button
                            onClick={() => { onImport(grouped); onClose(); }}
                            className="flex items-center gap-2 bg-ocean-600 hover:bg-ocean-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm"
                        >
                            <CheckCircle2 className="w-4 h-4" />
                            Importa {bibs.length} atleti
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
