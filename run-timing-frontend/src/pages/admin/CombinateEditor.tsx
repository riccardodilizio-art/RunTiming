import { Layers, Plus, Trash2 } from 'lucide-react';
import { inputCls, newId } from './adminShared';
import type { Combinata, Race } from '../../types';

/**
 * Combinate dell'evento: l'atleta si iscrive una volta a più gare e paga la
 * quota della combinata (es. 10 km + 21 km a 18 € invece di 20 €). Chi è già
 * iscritto a una delle gare può aggiungere la combinata pagando la differenza.
 */
export default function CombinateEditor({ races, value, onChange }: {
    races: Race[];
    value: Combinata[];
    onChange: (next: Combinata[]) => void;
}) {
    const update = (id: string, patch: Partial<Combinata>) => onChange(value.map(c => (c.id === id ? { ...c, ...patch } : c)));
    const somma = (c: Combinata) => races.filter(r => c.raceIds.includes(r.id)).reduce((t, r) => t + (r.price || 0), 0);
    return (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                    <Layers className="h-4 w-4 text-brand-600" /> Combinate
                </h3>
                <button type="button" disabled={races.length < 2}
                    onClick={() => onChange([...value, { id: `comb_${newId()}`.slice(0, 40), nome: 'Combinata', raceIds: races.slice(0, 2).map(r => r.id), prezzo: 0 }])}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand-200 text-brand-700 text-sm hover:bg-brand-50 transition-colors disabled:opacity-40">
                    <Plus className="h-4 w-4" /> Aggiungi combinata
                </button>
            </div>
            <p className="text-xs text-slate-400 mb-3">
                Un'iscrizione e un pagamento per più gare, con una quota sua. Chi è già iscritto a una delle gare può aggiungere
                la combinata fino alla chiusura delle iscrizioni, pagando la differenza. Servono almeno 2 gare.
            </p>
            {value.length === 0 ? (
                <p className="text-sm text-slate-400 italic">Nessuna combinata.</p>
            ) : (
                <div className="space-y-3">
                    {value.map(c => (
                        <div key={c.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-[1fr,140px,auto] gap-2 items-end">
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1">Nome</label>
                                    <input type="text" value={c.nome} maxLength={80} onChange={e => update(c.id, { nome: e.target.value })} className={inputCls} />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1">Quota combinata (€)</label>
                                    <input type="number" min={0} step={0.5} value={c.prezzo} onChange={e => update(c.id, { prezzo: parseFloat(e.target.value) || 0 })} className={inputCls} />
                                </div>
                                <button type="button" onClick={() => onChange(value.filter(x => x.id !== c.id))} className="p-2 rounded hover:bg-red-50" title="Elimina">
                                    <Trash2 className="h-4 w-4 text-red-400" />
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1">
                                {races.map(r => (
                                    <label key={r.id} className="flex items-center gap-1.5 text-sm text-slate-700">
                                        <input type="checkbox" className="accent-brand-600" checked={c.raceIds.includes(r.id)}
                                            onChange={e => update(c.id, { raceIds: e.target.checked ? [...c.raceIds, r.id] : c.raceIds.filter(x => x !== r.id) })} />
                                        {r.name}
                                    </label>
                                ))}
                            </div>
                            <p className={`text-xs ${c.raceIds.length < 2 ? 'text-red-600' : 'text-slate-500'}`}>
                                {c.raceIds.length < 2
                                    ? 'Scegli almeno 2 gare (altrimenti la combinata non viene salvata).'
                                    : `Gare separate: ${somma(c).toFixed(2)} € (prezzo base) · combinata: ${c.prezzo.toFixed(2)} €. La prima gara scelta decide modulo e modalità di pagamento.`}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
