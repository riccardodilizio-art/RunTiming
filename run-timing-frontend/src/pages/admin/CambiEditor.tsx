import { ArrowRightLeft } from 'lucide-react';
import { inputCls } from './adminShared';
import type { Event } from '../../types';

type Quote = NonNullable<Event['quoteCambi']>;
const DEFAULT: Quote = { cambioGara: true, cessione: null, trasferimento: null };

/**
 * Cambi dopo l'iscrizione, fatti dall'atleta fino alla chiusura delle iscrizioni:
 * cambio gara (nessun rimborso, si paga la differenza), cessione del pettorale e
 * trasferimento all'anno dopo con quota di segreteria.
 */
export default function CambiEditor({ value, onChange }: { value?: Event['quoteCambi']; onChange: (v: Quote) => void }) {
    const q = value ?? DEFAULT;
    const quota = (key: 'cessione' | 'trasferimento', label: string, help: string) => (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" className="accent-brand-600 h-4 w-4" checked={q[key] != null}
                    onChange={e => onChange({ ...q, [key]: e.target.checked ? 5 : null })} />
                {label}
            </label>
            {q[key] != null && (
                <div className="flex items-center gap-2 text-sm text-slate-700">
                    Quota di segreteria
                    <input type="number" min={0} step={0.5} value={q[key] ?? 0} className={`${inputCls} !w-24`}
                        onChange={e => onChange({ ...q, [key]: Math.max(0, parseFloat(e.target.value) || 0) })} /> €
                </div>
            )}
            <p className="text-xs text-slate-400">{help}</p>
        </div>
    );
    return (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-brand-600" /> Cambi dopo l'iscrizione
            </h3>
            <p className="text-xs text-slate-400">
                L'atleta li fa da solo (area atleta, area società o link nell'email di conferma) fino alla chiusura delle iscrizioni;
                dopo, solo l'admin. Le quote si pagano online come l'iscrizione (o sul posto se la gara si paga solo lì).
            </p>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" className="accent-brand-600 h-4 w-4" checked={q.cambioGara}
                        onChange={e => onChange({ ...q, cambioGara: e.target.checked })} />
                    Cambio gara / distanza
                </label>
                <p className="text-xs text-slate-400 mt-1">Nessun rimborso; se la nuova gara costa di più si paga la differenza.</p>
            </div>
            {quota('cessione', 'Cessione del pettorale (cambio nominativo)', 'Il pettorale passa a un\'altra persona, con gli stessi requisiti dell\'iscrizione.')}
            {quota('trasferimento', "Trasferimento all'anno prossimo", "L'iscrizione si annulla e la quota pagata diventa un codice di credito per la prossima edizione.")}
        </div>
    );
}
