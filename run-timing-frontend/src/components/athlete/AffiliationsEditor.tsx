import { useState } from 'react';
import { Plus, Trash2, IdCard, Search } from 'lucide-react';
import { newAffiliationId } from './affiliations';
import type { Affiliation, RaceEnte } from '../../types';

const ENTI: { value: RaceEnte; label: string }[] = [
    { value: 'fidal',    label: 'FIDAL' },
    { value: 'uisp',     label: 'UISP' },
    { value: 'csi',      label: 'CSI' },
    { value: 'acsi',     label: 'ACSI' },
    { value: 'aics',     label: 'AICS' },
    { value: 'libertas', label: 'Libertas' },
    { value: 'altro',    label: 'Altro ente' },
];

const inputCls =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500';

/**
 * Editor dei tesseramenti multipli di un atleta (ente + società + tessera + scadenza cert).
 * Riutilizzabile in profilo atleta, registrazione e roster società.
 */
/** Dati FIDAL della tessera dell'atleta (società, scadenza certificato), oppure null se non trovata. */
export type FidalFill = (tessera: string) => Promise<{ societaNome?: string | null; codiceSocieta?: string | null; certScadenza?: string | null } | null>;

export default function AffiliationsEditor({
    value,
    onChange,
    onFidalFill,
}: {
    value: Affiliation[];
    onChange: (next: Affiliation[]) => void;
    /** Se presente (atleta con login), mostra "Compila da FIDAL" per i tesseramenti FIDAL. */
    onFidalFill?: FidalFill;
}) {
    const [busy, setBusy] = useState<string | null>(null);
    const [msg, setMsg] = useState<Record<string, string>>({});

    async function fillFromFidal(aff: Affiliation) {
        if (!onFidalFill || !aff.numeroTessera?.trim()) return;
        setBusy(aff.id);
        try {
            const r = await onFidalFill(aff.numeroTessera.trim().toUpperCase());
            if (!r) {
                setMsg(m => ({ ...m, [aff.id]: 'Tessera non trovata con il tuo cognome e la tua data di nascita: controlla il numero o compila a mano.' }));
                return;
            }
            update(aff.id, {
                numeroTessera: aff.numeroTessera.trim().toUpperCase(),
                societaNome: r.societaNome || aff.societaNome,
                codiceSocieta: r.codiceSocieta || aff.codiceSocieta,
                certScadenza: r.certScadenza || aff.certScadenza,
            });
            setMsg(m => ({ ...m, [aff.id]: r.certScadenza
                ? 'Dati compilati da FIDAL. Salva il profilo per confermarli.'
                : 'Società compilata da FIDAL; la scadenza del certificato non è disponibile: inseriscila tu. Salva il profilo per confermare.' }));
        } catch (e) {
            setMsg(m => ({ ...m, [aff.id]: e instanceof Error ? e.message : 'Verifica non riuscita, riprova più tardi.' }));
        } finally {
            setBusy(null);
        }
    }
    function add() {
        onChange([...value, { id: newAffiliationId(), ente: 'fidal', societaNome: '', numeroTessera: '', source: 'manual' }]);
    }
    function update(id: string, patch: Partial<Affiliation>) {
        onChange(value.map(a => a.id === id ? { ...a, ...patch } : a));
    }
    function remove(id: string) {
        onChange(value.filter(a => a.id !== id));
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                    <IdCard className="h-4 w-4 text-brand-500" /> Tesseramenti
                </p>
                <button type="button" onClick={add}
                    className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 transition-colors">
                    <Plus className="h-3.5 w-3.5" /> Aggiungi tesseramento
                </button>
            </div>

            {value.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Nessun tesseramento. Aggiungine uno se sei tesserato.</p>
            ) : (
                <div className="space-y-2">
                    {value.map(aff => (
                        <div key={aff.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                                <div className="sm:col-span-3">
                                    <label className="block text-xs text-slate-500 mb-1">Ente</label>
                                    <select value={aff.ente} onChange={e => update(aff.id, { ente: e.target.value as RaceEnte })} className={inputCls}>
                                        {ENTI.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>
                                </div>
                                <div className="sm:col-span-4">
                                    <label className="block text-xs text-slate-500 mb-1">Società</label>
                                    <input type="text" value={aff.societaNome} placeholder="es. ASD Runners"
                                        onChange={e => update(aff.id, { societaNome: e.target.value })} className={inputCls} />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="block text-xs text-slate-500 mb-1">N° tessera</label>
                                    <input type="text" value={aff.numeroTessera ?? ''}
                                        onChange={e => update(aff.id, { numeroTessera: e.target.value })} className={inputCls} />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="block text-xs text-slate-500 mb-1">Scad. cert.</label>
                                    <input type="date" value={aff.certScadenza ?? ''}
                                        onChange={e => update(aff.id, { certScadenza: e.target.value || undefined })} className={inputCls} />
                                </div>
                                <div className="sm:col-span-1 flex justify-end">
                                    <button type="button" onClick={() => remove(aff.id)} className="p-2 rounded hover:bg-red-50" title="Rimuovi">
                                        <Trash2 className="h-4 w-4 text-red-400" />
                                    </button>
                                </div>
                            </div>
                            {onFidalFill && aff.ente === 'fidal' && (
                                <button type="button" onClick={() => fillFromFidal(aff)} disabled={!aff.numeroTessera?.trim() || busy === aff.id}
                                    className="mt-2 flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-800 disabled:opacity-40">
                                    <Search className="h-3.5 w-3.5" /> {busy === aff.id ? 'Cerco…' : 'Compila società e certificato da FIDAL'}
                                </button>
                            )}
                            {msg[aff.id] && <p className="text-[11px] text-slate-600 mt-1.5">{msg[aff.id]}</p>}
                            {aff.source === 'fidal_db' && (
                                <p className="text-[11px] text-brand-500 mt-1.5">✓ Verificato su FIDAL</p>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
