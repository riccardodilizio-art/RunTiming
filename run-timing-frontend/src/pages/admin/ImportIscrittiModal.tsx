import { useState } from 'react';
import { FileSpreadsheet, X } from 'lucide-react';
import { api } from '../../lib/api';
import { leggiFile, scaricaModello, type RigaImport } from '../../lib/importIscritti';
import type { Race } from '../../types';

// Import iscritti da Excel (segreteria / organizzatore), nel tracciato Race Result.
// Prima l'anteprima (il server controlla ogni riga senza scrivere), poi l'import.

type Pagamento = 'pagato' | 'sul_posto' | 'gratuito';
interface Esito { riga: number; esito: 'ok' | 'errore'; messaggio?: string; atleta?: string }
interface Risposta { prova: boolean; importati: number; validi: number; saltati: number; righe: Esito[] }

const PAGAMENTI: { value: Pagamento; label: string }[] = [
    { value: 'pagato', label: 'Già pagati (incassati fuori dal sito)' },
    { value: 'sul_posto', label: 'Da pagare sul posto' },
    { value: 'gratuito', label: 'Gratuiti' },
];

export default function ImportIscrittiModal({ race, onClose, onDone }: { race: Race; onClose: () => void; onDone: () => void }) {
    const [righe, setRighe] = useState<RigaImport[] | null>(null);
    const [nomeFile, setNomeFile] = useState('');
    const [pagamento, setPagamento] = useState<Pagamento>('pagato');
    const [esito, setEsito] = useState<Risposta | null>(null);
    const [errore, setErrore] = useState('');
    const [busy, setBusy] = useState(false);

    const valide = righe?.filter(r => r.atleta) ?? [];
    const scartate = righe?.filter(r => r.errore) ?? [];

    async function scegli(file: File | undefined) {
        if (!file) return;
        setErrore(''); setEsito(null); setNomeFile(file.name);
        try {
            const r = await leggiFile(file);
            if (r.length > 2000) throw new Error('Massimo 2000 righe per import: dividi il file');
            setRighe(r);
        } catch (e) {
            setRighe(null);
            setErrore(e instanceof Error ? e.message : 'File non leggibile');
        }
    }

    async function invia(prova: boolean) {
        if (!valide.length) return;
        if (!prova && !confirm(`Importo ${esito?.validi ?? valide.length} iscritti in «${race.name}»?`)) return;
        setBusy(true); setErrore('');
        try {
            const r = await api.post<Risposta>(`/races/${race.id}/import`, {
                pagamento, prova, righe: valide.map(v => ({ riga: v.riga, atleta: v.atleta })),
            });
            setEsito(r);
            if (!prova) onDone();
        } catch (e) {
            setErrore(e instanceof Error ? e.message : 'Import non riuscito');
        } finally {
            setBusy(false);
        }
    }

    const errori: Esito[] = [
        ...scartate.map(s => ({ riga: s.riga, esito: 'errore' as const, messaggio: s.errore })),
        ...(esito?.righe.filter(r => r.esito === 'errore') ?? []),
    ].sort((a, b) => a.riga - b.riga);

    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <h3 className="font-semibold text-slate-800 flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-emerald-600" /> Importa iscritti da Excel · {race.name}</h3>
                    <button type="button" onClick={onClose} className="p-1 rounded hover:bg-slate-100" aria-label="Chiudi"><X className="h-5 w-5 text-slate-500" /></button>
                </div>
                <div className="p-5 space-y-4 overflow-y-auto text-sm">
                    <p className="text-slate-600">
                        Stesse colonne dell'Excel per il cronometraggio: <strong>Cognome, Nome, DataDiNascita</strong> (o AnnoDiNascita), <strong>Genere</strong>,
                        e se ci sono Società, CodiceSocietà, Licenza, Email, Nazione.{' '}
                        <button type="button" onClick={scaricaModello} className="text-brand-700 font-semibold hover:underline">Scarica il modello</button>
                    </p>
                    <label className="flex items-center gap-3 rounded-xl border-2 border-dashed border-slate-300 p-4 cursor-pointer hover:border-brand-400">
                        <FileSpreadsheet className="h-6 w-6 text-slate-400" />
                        <span className="flex-1">{nomeFile || 'Scegli il file Excel (.xlsx) o CSV'}</span>
                        <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => scegli(e.target.files?.[0])} />
                    </label>
                    {righe && (
                        <>
                            <p className="text-slate-700"><strong>{valide.length}</strong> righe da importare{scartate.length ? <>, <strong>{scartate.length}</strong> da correggere nel file</> : ''}.</p>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Pagamento degli importati</label>
                                <select value={pagamento} onChange={e => { setPagamento(e.target.value as Pagamento); setEsito(null); }}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                                    {PAGAMENTI.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                </select>
                            </div>
                        </>
                    )}
                    {esito && (
                        <div className={`rounded-xl border p-3 ${esito.prova ? 'border-slate-200 bg-slate-50' : 'border-green-200 bg-green-50 text-green-900'}`}>
                            {esito.prova
                                ? <p>Controllo fatto: <strong>{esito.validi}</strong> iscritti pronti, <strong>{esito.saltati}</strong> verrebbero saltati. Nessuna email agli atleti.</p>
                                : <p><strong>{esito.importati}</strong> iscritti importati{esito.saltati ? `, ${esito.saltati} saltati` : ''}.</p>}
                        </div>
                    )}
                    {errori.length > 0 && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 max-h-56 overflow-y-auto">
                            <p className="font-semibold text-amber-900 mb-1">Righe saltate</p>
                            <ul className="space-y-0.5 text-amber-900">
                                {errori.map(e => <li key={`${e.riga}-${e.messaggio}`}>Riga {e.riga}{e.atleta ? ` (${e.atleta})` : ''}: {e.messaggio}</li>)}
                            </ul>
                        </div>
                    )}
                    {errore && <p className="text-red-600">{errore}</p>}
                </div>
                <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
                    <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 text-sm">{esito && !esito.prova ? 'Chiudi' : 'Annulla'}</button>
                    {!(esito && !esito.prova) && (
                        <>
                            <button type="button" disabled={!valide.length || busy} onClick={() => invia(true)}
                                className="px-4 py-2 rounded-lg border border-brand-300 text-brand-700 text-sm font-semibold disabled:opacity-50">Controlla</button>
                            <button type="button" disabled={!esito?.prova || !esito.validi || busy} onClick={() => invia(false)}
                                className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50">
                                {busy ? 'Attendi…' : `Importa ${esito?.validi ?? ''} ${esito?.validi === 1 ? 'iscritto' : 'iscritti'}`}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
