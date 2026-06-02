import { useState } from 'react';
import { XCircle, Check } from 'lucide-react';
import { saveRegistration } from '../../hooks/useAdminStore';
import { inputCls } from './adminShared';
import type { Race, RegistrationSubmission } from '../../types';

export default function ManualRegModal({
    race,
    eventId,
    onClose,
    onSaved,
}: {
    race: Race;
    eventId: string;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [formData, setFormData] = useState<Record<string, string | boolean>>({});
    const [price, setPrice] = useState(race.price);
    const [paymentMethod, setPaymentMethod] = useState<'manual' | 'free'>('manual');

    const fields = (race.formSchema ?? []).filter(f => !f.readOnly && f.type !== 'file');

    function setField(id: string, val: string | boolean) {
        setFormData(d => ({ ...d, [id]: val }));
    }

    function handleSave() {
        const sub: RegistrationSubmission = {
            id: `reg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            eventId,
            raceId: race.id,
            submittedAt: new Date().toISOString(),
            formData,
            pricePaid: price,
            paymentMethod,
            paymentStatus: 'confirmed',
            addedByOrganizer: true,
        };
        saveRegistration(sub);
        onSaved();
        onClose();
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                    <h3 className="font-semibold text-slate-800">Iscrizione manuale — {race.name}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <XCircle className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-5 space-y-3">
                    {fields.length === 0 && (
                        <p className="text-sm text-slate-400 italic">Nessun campo nel modulo. Compila i dati base.</p>
                    )}
                    {fields.map(f => (
                        <div key={f.id}>
                            <label className="block text-xs font-medium text-slate-600 mb-1">
                                {f.label}{f.required && ' *'}
                            </label>
                            {f.type === 'select' ? (
                                <select
                                    value={(formData[f.id] as string) ?? ''}
                                    onChange={e => setField(f.id, e.target.value)}
                                    className={inputCls}
                                >
                                    <option value="">— seleziona —</option>
                                    {f.options?.map(o => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                            ) : f.type === 'checkbox' ? (
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={(formData[f.id] as boolean) ?? false}
                                        onChange={e => setField(f.id, e.target.checked)}
                                        className="accent-brand-600"
                                    />
                                    <span className="text-sm text-slate-700">{f.helperText ?? f.label}</span>
                                </label>
                            ) : f.type === 'textarea' ? (
                                <textarea
                                    rows={3}
                                    value={(formData[f.id] as string) ?? ''}
                                    onChange={e => setField(f.id, e.target.value)}
                                    className={inputCls}
                                    placeholder={f.placeholder}
                                />
                            ) : (
                                <input
                                    type={f.type}
                                    value={(formData[f.id] as string) ?? ''}
                                    onChange={e => setField(f.id, e.target.value)}
                                    className={inputCls}
                                    placeholder={f.placeholder}
                                />
                            )}
                        </div>
                    ))}

                    <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Quota pagata (€)</label>
                            <input
                                type="number" min={0} step={0.5}
                                value={price}
                                onChange={e => setPrice(parseFloat(e.target.value) || 0)}
                                className={inputCls}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Metodo pagamento</label>
                            <select
                                value={paymentMethod}
                                onChange={e => setPaymentMethod(e.target.value as 'manual' | 'free')}
                                className={inputCls}
                            >
                                <option value="manual">Manuale (contanti/bonifico)</option>
                                <option value="free">Gratuito / esenzione</option>
                            </select>
                        </div>
                    </div>
                    <p className="text-xs text-slate-400">
                        L'iscrizione sarà marcata come <strong>confermata</strong> automaticamente.
                    </p>
                </div>
                <div className="flex justify-end gap-2 px-5 pb-5">
                    <button onClick={onClose}
                        className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50">
                        Annulla
                    </button>
                    <button onClick={handleSave}
                        className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 flex items-center gap-1.5">
                        <Check className="w-4 h-4" /> Salva iscrizione
                    </button>
                </div>
            </div>
        </div>
    );
}
