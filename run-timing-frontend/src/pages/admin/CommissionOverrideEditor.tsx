import { calcCommissionAmount } from '../../utils/commission';
import { formatPrice, inputCls } from './adminShared';
import type { CommissionConfig } from '../../types';

/**
 * Componente riutilizzabile per impostare una commissione opzionale a qualsiasi livello
 * (evento, gara, step di quota). Se non abilitata, eredita dal livello superiore.
 */
export default function CommissionOverrideEditor({
    commission,
    onChange,
    inheritLabel,
    examplePrice = 10,
}: {
    commission: CommissionConfig | undefined;
    onChange: (c: CommissionConfig | undefined) => void;
    inheritLabel: string;     // es. "Eredita dalla gara" / "Eredita dall'evento"
    examplePrice?: number;
}) {
    const enabled = commission !== undefined;

    function enable() {
        onChange({ fixedFee: 0, percentFee: 0, appliedTo: 'buyer' });
    }
    function disable() { onChange(undefined); }
    function set<K extends keyof CommissionConfig>(key: K, value: CommissionConfig[K]) {
        if (!commission) return;
        onChange({ ...commission, [key]: value });
    }

    const preview = enabled && commission
        ? calcCommissionAmount(commission, examplePrice)
        : null;

    return (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={enabled}
                        onChange={e => e.target.checked ? enable() : disable()}
                        className="accent-brand-600 h-4 w-4"
                    />
                    <span className="text-sm font-medium text-slate-700">Commissione personalizzata</span>
                </label>
                {!enabled && (
                    <span className="text-xs text-slate-400 italic">{inheritLabel}</span>
                )}
            </div>
            {enabled && commission && (
                <div className="mt-3 grid grid-cols-3 gap-3">
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Quota fissa (€)</label>
                        <input
                            type="number" min={0} step={0.1}
                            value={commission.fixedFee}
                            onChange={e => set('fixedFee', parseFloat(e.target.value) || 0)}
                            className={inputCls}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Percentuale (%)</label>
                        <input
                            type="number" min={0} step={0.1} max={100}
                            value={commission.percentFee}
                            onChange={e => set('percentFee', parseFloat(e.target.value) || 0)}
                            className={inputCls}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">A carico di</label>
                        <select
                            value={commission.appliedTo}
                            onChange={e => set('appliedTo', e.target.value as CommissionConfig['appliedTo'])}
                            className={inputCls}
                        >
                            <option value="buyer">Atleta</option>
                            <option value="organizer">Organizzatore</option>
                        </select>
                    </div>
                    {preview !== null && (
                        <p className="col-span-3 text-xs text-slate-400">
                            Es. quota {formatPrice(examplePrice)} → commissione {formatPrice(preview)}
                            {commission.appliedTo === 'buyer' ? ' (a carico atleta)' : ' (dedotta all\'organizzatore)'}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
