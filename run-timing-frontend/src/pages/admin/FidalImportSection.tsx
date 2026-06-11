import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Database, Upload, Trash2, Check, AlertTriangle, Loader2, Search } from 'lucide-react';
import { parseFidalRows } from '../../data/fidalImport';
import { parseSocietyDbf } from '../../data/dbfImport';
import {
    replaceFidalDataset, clearFidalDataset, getFidalMeta, datasetActive,
    replaceSocietyDataset, clearSocietyDataset, getSocietyMeta,
    dsLookupByTessera, dsLookupByName, type FidalMeta,
} from '../../data/fidalDataset';
import type { FidalAthlete } from '../../data/mockFidal';

type Phase = 'idle' | 'reading' | 'parsing' | 'writing' | 'done' | 'error';

export default function FidalImportSection() {
    const fileRef = useRef<HTMLInputElement>(null);
    const [meta, setMeta] = useState<FidalMeta | null>(() => getFidalMeta());
    const [phase, setPhase] = useState<Phase>('idle');
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState('');
    const [fileName, setFileName] = useState('');
    const [testQuery, setTestQuery] = useState('');

    const socRef = useRef<HTMLInputElement>(null);
    const [socMeta, setSocMeta] = useState<FidalMeta | null>(() => getSocietyMeta());
    const [socBusy, setSocBusy] = useState(false);
    const [socError, setSocError] = useState('');

    async function handleFile(file: File) {
        setError('');
        setFileName(file.name);
        setProgress(0);
        try {
            setPhase('reading');
            const buf = await file.arrayBuffer();

            setPhase('parsing');
            // Lasciamo respirare la UI prima del parse pesante.
            await new Promise(r => setTimeout(r, 30));
            const wb = XLSX.read(buf, { type: 'array' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, defval: '' });
            const records = parseFidalRows(rows as (string | number)[][]);
            if (records.length === 0) {
                setPhase('error');
                setError('Nessun atleta valido trovato nel file. Controlla che sia un export FIDAL.');
                return;
            }

            setPhase('writing');
            const newMeta = await replaceFidalDataset(records, file.name, (w, t) =>
                setProgress(Math.round((w / t) * 100)),
            );
            setMeta(newMeta);
            setPhase('done');
        } catch (e) {
            setPhase('error');
            setError(e instanceof Error ? e.message : 'Errore durante l\'importazione.');
        }
    }

    async function handleClear() {
        if (!confirm('Rimuovere il database FIDAL importato? Si torneranno a usare i dati demo.')) return;
        await clearFidalDataset();
        setMeta(null);
        setPhase('idle');
        setProgress(0);
    }

    async function handleSocietyFile(file: File) {
        setSocError('');
        setSocBusy(true);
        try {
            const buf = await file.arrayBuffer();
            const societies = parseSocietyDbf(buf);
            if (societies.length === 0) {
                setSocError('Nessuna società trovata nel file .dbf.');
                return;
            }
            const m = await replaceSocietyDataset(societies, file.name);
            setSocMeta(m);
        } catch (e) {
            setSocError(e instanceof Error ? e.message : 'Errore durante l\'importazione società.');
        } finally {
            setSocBusy(false);
        }
    }

    async function handleSocietyClear() {
        if (!confirm('Rimuovere l\'anagrafica società importata?')) return;
        await clearSocietyDataset();
        setSocMeta(null);
    }

    const busy = phase === 'reading' || phase === 'parsing' || phase === 'writing';

    // Demo di ricerca sul dataset attivo
    const testResults: FidalAthlete[] = !datasetActive() || testQuery.trim().length < 2
        ? []
        : (() => {
            const byT = dsLookupByTessera(testQuery);
            return byT ? [byT] : dsLookupByName(testQuery, undefined).slice(0, 8);
        })();

    return (
        <div className="space-y-6">
            <div>
                <h2 className="font-display font-700 text-lg text-slate-800 flex items-center gap-2">
                    <Database className="h-5 w-5 text-brand-600" /> Database FIDAL
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                    Importa l'export tesseramenti FIDAL (.xlsx). Le ricerche per tessera, nome e
                    codice società (iscrizioni, iscrizione rapida, roster) useranno questo dataset.
                </p>
            </div>

            {/* Stato corrente */}
            <div className={`rounded-xl border px-4 py-3 ${meta ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                {meta ? (
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                            <p className="text-sm font-semibold text-emerald-800 flex items-center gap-1.5">
                                <Check className="h-4 w-4" /> Dataset attivo
                            </p>
                            <p className="text-xs text-emerald-700 mt-0.5">
                                {meta.count.toLocaleString('it-IT')} atleti · {meta.fileName} · importato il{' '}
                                {new Date(meta.importedAt).toLocaleString('it-IT')}
                            </p>
                        </div>
                        <button
                            onClick={handleClear}
                            disabled={busy}
                            className="flex items-center gap-1.5 text-xs font-medium text-red-700 border border-red-200 bg-white hover:bg-red-50 rounded-lg px-3 py-2 transition-colors disabled:opacity-50"
                        >
                            <Trash2 className="h-3.5 w-3.5" /> Rimuovi database
                        </button>
                    </div>
                ) : (
                    <p className="text-sm text-slate-500">
                        Nessun database importato — in uso i dati demo (10 atleti di esempio).
                    </p>
                )}
            </div>

            {/* Import */}
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
                <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
                />
                {busy ? (
                    <div className="space-y-3">
                        <Loader2 className="h-6 w-6 text-brand-600 animate-spin mx-auto" />
                        <p className="text-sm text-slate-600">
                            {phase === 'reading' && 'Lettura file…'}
                            {phase === 'parsing' && 'Analisi righe (può richiedere qualche secondo)…'}
                            {phase === 'writing' && `Salvataggio… ${progress}%`}
                        </p>
                        {phase === 'writing' && (
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-xs mx-auto">
                                <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                            </div>
                        )}
                        <p className="text-xs text-slate-400">{fileName}</p>
                    </div>
                ) : (
                    <>
                        <Upload className="h-7 w-7 text-slate-400 mx-auto mb-2" />
                        <button
                            onClick={() => fileRef.current?.click()}
                            className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
                        >
                            {meta ? 'Sostituisci database (.xlsx)' : 'Carica database FIDAL (.xlsx)'}
                        </button>
                        <p className="text-xs text-slate-400 mt-2">
                            Un nuovo import sostituisce completamente il dataset precedente.
                        </p>
                    </>
                )}
            </div>

            {/* Anagrafica società (.dbf) */}
            <div className="border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                        <p className="text-sm font-semibold text-slate-700">Anagrafica società (.dbf)</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                            {socMeta
                                ? `${socMeta.count.toLocaleString('it-IT')} società · ${socMeta.fileName}`
                                : 'Opzionale: collega il codice società alla denominazione reale (altrimenti si usa il comune).'}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            ref={socRef}
                            type="file"
                            accept=".dbf"
                            className="hidden"
                            onChange={e => { const f = e.target.files?.[0]; if (f) handleSocietyFile(f); e.target.value = ''; }}
                        />
                        {socMeta && (
                            <button
                                onClick={handleSocietyClear}
                                disabled={socBusy}
                                className="flex items-center gap-1.5 text-xs font-medium text-red-700 border border-red-200 hover:bg-red-50 rounded-lg px-3 py-2 transition-colors disabled:opacity-50"
                            >
                                <Trash2 className="h-3.5 w-3.5" /> Rimuovi
                            </button>
                        )}
                        <button
                            onClick={() => socRef.current?.click()}
                            disabled={socBusy}
                            className="flex items-center gap-1.5 text-xs font-medium text-brand-700 border border-brand-200 hover:bg-brand-50 rounded-lg px-3 py-2 transition-colors disabled:opacity-50"
                        >
                            {socBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                            {socMeta ? 'Sostituisci' : 'Carica .dbf'}
                        </button>
                    </div>
                </div>
                {socError && (
                    <p className="text-xs text-red-600 mt-2 flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5" /> {socError}
                    </p>
                )}
            </div>

            {phase === 'done' && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-3 text-sm">
                    <Check className="h-4 w-4 shrink-0" /> Import completato con successo.
                </div>
            )}
            {phase === 'error' && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                    <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
                </div>
            )}

            {/* Prova di ricerca */}
            {datasetActive() && (
                <div className="border border-slate-200 rounded-xl p-4">
                    <p className="text-sm font-medium text-slate-700 mb-2">Prova una ricerca</p>
                    <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            value={testQuery}
                            onChange={e => setTestQuery(e.target.value)}
                            placeholder="Cognome o numero tessera…"
                            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                    </div>
                    {testQuery.trim().length >= 2 && (
                        testResults.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">Nessun risultato.</p>
                        ) : (
                            <ul className="divide-y divide-slate-100">
                                {testResults.map(r => (
                                    <li key={r.tessera} className="py-1.5 text-sm text-slate-700 flex items-center justify-between gap-2">
                                        <span>{r.cognome} {r.nome}</span>
                                        <span className="text-xs text-slate-400">
                                            {r.tessera} · {r.codiceSocieta || '—'}{r.dataNascita ? ` · ${r.dataNascita.slice(0, 4)}` : ''}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )
                    )}
                </div>
            )}

            <p className="text-xs text-slate-400">
                Nota: provvisorio. I dati sono in IndexedDB nel browser; con il backend l'import
                passerà su Postgres. Caricando anche l'anagrafica società (.dbf) gli atleti
                mostrano la denominazione reale; altrimenti si usa il comune. La data di nascita
                nel tracciato atleti contiene solo l'anno.
            </p>
        </div>
    );
}
