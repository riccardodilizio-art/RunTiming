import { Plus, Trash2 } from 'lucide-react';
import { newId, inputCls } from './adminShared';
import CommissionOverrideEditor from './CommissionOverrideEditor';
import type { PriceStep } from '../../types';

export default function PriceStepEditor({ steps, onChange }: { steps: PriceStep[]; onChange: (s: PriceStep[]) => void }) {
    function add() {
        onChange([...steps, { id: newId(), label: 'Nuova quota', price: 0, deadline: '' }]);
    }
    function remove(id: string) { onChange(steps.filter(s => s.id !== id)); }
    function update<K extends keyof PriceStep>(id: string, key: K, value: PriceStep[K]) {
        onChange(steps.map(s => s.id === id ? { ...s, [key]: value } : s));
    }

    return (
        <div className="space-y-3">
            {steps.map(step => (
                <div key={step.id} className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
                    {/* Riga principale */}
                    <div className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-4">
                            <label className="block text-xs text-slate-500 mb-1">Etichetta</label>
                            <input
                                type="text"
                                value={step.label}
                                onChange={e => update(step.id, 'label', e.target.value)}
                                className={inputCls}
                                placeholder="es. Early Bird"
                            />
                        </div>
                        <div className="col-span-3">
                            <label className="block text-xs text-slate-500 mb-1">Prezzo (€)</label>
                            <input
                                type="number" min={0} step={0.5}
                                value={step.price}
                                onChange={e => update(step.id, 'price', parseFloat(e.target.value) || 0)}
                                className={inputCls}
                            />
                        </div>
                        <div className="col-span-4">
                            <label className="block text-xs text-slate-500 mb-1">Scadenza</label>
                            <input
                                type="date"
                                value={step.deadline}
                                onChange={e => update(step.id, 'deadline', e.target.value)}
                                className={inputCls}
                            />
                        </div>
                        <div className="col-span-1 flex justify-end pt-4">
                            <button type="button" onClick={() => remove(step.id)} className="p-1.5 rounded hover:bg-red-50">
                                <Trash2 className="h-4 w-4 text-red-400" />
                            </button>
                        </div>
                    </div>
                    {/* Commissione per questo step */}
                    <CommissionOverrideEditor
                        commission={step.commission}
                        onChange={c => update(step.id, 'commission', c)}
                        inheritLabel="Eredita dalla gara o dall'evento"
                        examplePrice={step.price || 10}
                    />
                </div>
            ))}
            <button
                type="button"
                onClick={add}
                className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-800 transition-colors"
            >
                <Plus className="h-4 w-4" /> Aggiungi quota
            </button>
        </div>
    );
}
