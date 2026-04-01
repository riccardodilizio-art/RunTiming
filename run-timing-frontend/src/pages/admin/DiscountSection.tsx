import { useState } from 'react';
import { Plus, Edit2, Trash2, X, Check, Tag, Percent, Euro, Settings2 } from 'lucide-react';
import { useAdminStore } from '../../hooks/useAdminStore';
import type { DiscountCode, CommissionConfig } from '../../types';

const inputCls =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ocean-500 focus:border-ocean-500';

function newId() { return `disc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`; }

function formatPrice(n: number) {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
}

// ─── DiscountModal ────────────────────────────────────────────────────────────

function DiscountModal({
    code,
    onSave,
    onClose,
}: {
    code: DiscountCode | null;
    onSave: (c: DiscountCode) => void;
    onClose: () => void;
}) {
    const [draft, setDraft] = useState<DiscountCode>(
        code ?? {
            id: newId(), code: '', description: '',
            type: 'fixed', value: 0,
            maxUses: undefined, usedCount: 0,
            expiresAt: '', isActive: true,
        }
    );

    function set<K extends keyof DiscountCode>(key: K, value: DiscountCode[K]) {
        setDraft(d => ({ ...d, [key]: value }));
    }

    const isValid = draft.code.trim().length >= 3 && draft.value > 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <h2 className="font-semibold text-slate-800 text-lg">
                        {code ? 'Modifica codice' : 'Nuovo codice sconto'}
                    </h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
                        <X className="h-4 w-4 text-slate-500" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Codice *</label>
                        <input
                            type="text"
                            value={draft.code}
                            onChange={e => set('code', e.target.value.toUpperCase())}
                            className={`${inputCls} font-mono tracking-widest`}
                            placeholder="es. ESTATE10"
                        />
                        <p className="text-xs text-slate-400 mt-1">Minimo 3 caratteri.</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Descrizione</label>
                        <input type="text" value={draft.description ?? ''} onChange={e => set('description', e.target.value)} className={inputCls} placeholder="Descrizione interna" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo sconto</label>
                            <select value={draft.type} onChange={e => set('type', e.target.value as DiscountCode['type'])} className={inputCls}>
                                <option value="fixed">Fisso (€)</option>
                                <option value="percent">Percentuale (%)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Valore {draft.type === 'fixed' ? '(€)' : '(%)'}
                            </label>
                            <input
                                type="number"
                                min={0.01}
                                max={draft.type === 'percent' ? 100 : undefined}
                                step={draft.type === 'fixed' ? 0.5 : 1}
                                value={draft.value}
                                onChange={e => set('value', parseFloat(e.target.value) || 0)}
                                className={inputCls}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Max utilizzi</label>
                            <input
                                type="number"
                                min={1}
                                value={draft.maxUses ?? ''}
                                onChange={e => set('maxUses', e.target.value ? parseInt(e.target.value) : undefined)}
                                className={inputCls}
                                placeholder="Illimitato"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Scadenza</label>
                            <input
                                type="date"
                                value={draft.expiresAt ?? ''}
                                onChange={e => set('expiresAt', e.target.value || undefined)}
                                className={inputCls}
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            id="isActive"
                            type="checkbox"
                            checked={draft.isActive}
                            onChange={e => set('isActive', e.target.checked)}
                            className="accent-ocean-600 h-4 w-4"
                        />
                        <label htmlFor="isActive" className="text-sm text-slate-700">Codice attivo</label>
                    </div>
                </div>

                <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 text-sm hover:bg-slate-50 transition-colors">
                        Annulla
                    </button>
                    <button
                        onClick={() => isValid && onSave(draft)}
                        disabled={!isValid}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-ocean-600 text-white text-sm font-medium hover:bg-ocean-700 disabled:opacity-40 transition-colors"
                    >
                        <Check className="h-4 w-4" /> Salva
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── CommissionCard ───────────────────────────────────────────────────────────

function CommissionCard() {
    const { commission, saveCommission } = useAdminStore();
    const [draft, setDraft] = useState<CommissionConfig>(commission);
    const [saved, setSaved] = useState(false);

    function handleSave() {
        saveCommission(draft);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    }

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-1 flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-ocean-600" /> Commissioni di servizio
            </h3>
            <p className="text-sm text-slate-500 mb-4">
                Le commissioni vengono aggiunte automaticamente al prezzo base durante l'iscrizione.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Quota fissa (€)</label>
                    <input
                        type="number" min={0} step={0.1}
                        value={draft.fixedFee}
                        onChange={e => setDraft(d => ({ ...d, fixedFee: parseFloat(e.target.value) || 0 }))}
                        className={inputCls}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Percentuale (%)</label>
                    <input
                        type="number" min={0} max={100} step={0.1}
                        value={draft.percentFee}
                        onChange={e => setDraft(d => ({ ...d, percentFee: parseFloat(e.target.value) || 0 }))}
                        className={inputCls}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">A carico di</label>
                    <select
                        value={draft.appliedTo}
                        onChange={e => setDraft(d => ({ ...d, appliedTo: e.target.value as CommissionConfig['appliedTo'] }))}
                        className={inputCls}
                    >
                        <option value="buyer">Acquirente (atleta)</option>
                        <option value="organizer">Organizzatore</option>
                    </select>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <button
                    onClick={handleSave}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-ocean-600 text-white text-sm font-medium hover:bg-ocean-700 transition-colors"
                >
                    <Check className="h-4 w-4" /> Salva commissioni
                </button>
                {saved && <span className="text-sm text-green-600 font-medium">Salvato!</span>}
                <span className="text-xs text-slate-400 ml-auto">
                    Es. quota €10: commissione = {formatPrice(draft.fixedFee + 10 * draft.percentFee / 100)}
                    {draft.appliedTo === 'buyer' ? ' (a carico atleta)' : ' (a carico org.)'}
                </span>
            </div>
        </div>
    );
}

// ─── DiscountSection ──────────────────────────────────────────────────────────

export default function DiscountSection() {
    const { discountCodes, saveDiscountCode, deleteDiscountCode } = useAdminStore();
    const [modal, setModal] = useState<DiscountCode | null | 'new'>(null);
    const today = new Date().toISOString().slice(0, 10);

    function statusBadge(c: DiscountCode) {
        if (!c.isActive) return { label: 'Disattivo', cls: 'bg-slate-100 text-slate-500' };
        if (c.expiresAt && c.expiresAt < today) return { label: 'Scaduto', cls: 'bg-red-100 text-red-600' };
        if (c.maxUses !== undefined && c.usedCount >= c.maxUses) return { label: 'Esaurito', cls: 'bg-amber-100 text-amber-600' };
        return { label: 'Attivo', cls: 'bg-green-100 text-green-700' };
    }

    return (
        <div className="space-y-6">
            <CommissionCard />

            {/* Discount codes */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                            <Tag className="h-4 w-4 text-ocean-600" /> Codici sconto
                        </h3>
                        <p className="text-sm text-slate-500 mt-0.5">{discountCodes.length} codici configurati</p>
                    </div>
                    <button
                        onClick={() => setModal('new')}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ocean-600 text-white text-sm font-medium hover:bg-ocean-700 transition-colors"
                    >
                        <Plus className="h-4 w-4" /> Nuovo codice
                    </button>
                </div>

                {discountCodes.length === 0 ? (
                    <div className="bg-white rounded-xl border border-slate-200 py-12 text-center text-slate-400">
                        <Tag className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">Nessun codice sconto configurato.</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                    <th className="px-4 py-3">Codice</th>
                                    <th className="px-4 py-3">Sconto</th>
                                    <th className="px-4 py-3 hidden sm:table-cell">Utilizzi</th>
                                    <th className="px-4 py-3 hidden md:table-cell">Scadenza</th>
                                    <th className="px-4 py-3">Stato</th>
                                    <th className="px-4 py-3 text-right">Azioni</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {discountCodes.map(c => {
                                    const { label, cls } = statusBadge(c);
                                    return (
                                        <tr key={c.id} className="hover:bg-slate-50/50">
                                            <td className="px-4 py-3">
                                                <div>
                                                    <span className="font-mono font-semibold text-slate-800 tracking-wider">{c.code}</span>
                                                    {c.description && <p className="text-xs text-slate-400 mt-0.5">{c.description}</p>}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="flex items-center gap-1 text-slate-700 font-medium">
                                                    {c.type === 'fixed'
                                                        ? <><Euro className="h-3.5 w-3.5 text-ocean-500" />{formatPrice(c.value)}</>
                                                        : <><Percent className="h-3.5 w-3.5 text-ocean-500" />{c.value}%</>
                                                    }
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">
                                                {c.usedCount} / {c.maxUses ?? '∞'}
                                            </td>
                                            <td className="px-4 py-3 text-slate-500 hidden md:table-cell">
                                                {c.expiresAt || '—'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{label}</span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button onClick={() => setModal(c)} className="p-1.5 rounded hover:bg-slate-100" title="Modifica">
                                                        <Edit2 className="h-4 w-4 text-slate-500" />
                                                    </button>
                                                    <button
                                                        onClick={() => { if (confirm(`Eliminare il codice "${c.code}"?`)) deleteDiscountCode(c.id); }}
                                                        className="p-1.5 rounded hover:bg-red-50"
                                                        title="Elimina"
                                                    >
                                                        <Trash2 className="h-4 w-4 text-red-400" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {modal !== null && (
                <DiscountModal
                    code={modal === 'new' ? null : modal}
                    onSave={c => { saveDiscountCode(c); setModal(null); }}
                    onClose={() => setModal(null)}
                />
            )}
        </div>
    );
}
