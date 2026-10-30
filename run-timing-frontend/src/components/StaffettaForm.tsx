import { Users } from 'lucide-react';

// Staffetta: il capitano (frazione 1) iscrive tutta la squadra con un solo modulo.

import type { Frazionista, Squadra } from '../lib/staffetta';

const inputCls = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

export default function StaffettaForm({ value, onChange, errori }: { value: Squadra; onChange: (s: Squadra) => void; errori: string[] }) {
    const setF = (i: number, patch: Partial<Frazionista>) =>
        onChange({ ...value, frazionisti: value.frazionisti.map((f, k) => (k === i ? { ...f, ...patch } : f)) });
    return (
        <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-xl bg-brand-50 border border-brand-200 p-3 text-sm text-brand-800">
                <Users className="h-5 w-5 shrink-0" />
                <p>Staffetta da {value.frazionisti.length} frazioni: il capitano (frazione 1) iscrive tutta la squadra e paga una quota unica.
                    I frazionisti si possono cambiare fino alla chiusura delle iscrizioni dal link nell'email.</p>
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome della squadra *</label>
                <input className={inputCls} maxLength={60} value={value.squadra} onChange={e => onChange({ ...value, squadra: e.target.value })} placeholder="es. Le Lepri di Ortona" />
            </div>
            {value.frazionisti.map((f, i) => (
                <fieldset key={i} className="rounded-xl border border-slate-200 p-3">
                    <legend className="px-1 text-sm font-semibold text-slate-700">Frazione {i + 1}{i === 0 ? ' · capitano' : ''}</legend>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input className={inputCls} placeholder="Nome *" value={f.nome} onChange={e => setF(i, { nome: e.target.value })} />
                        <input className={inputCls} placeholder="Cognome *" value={f.cognome} onChange={e => setF(i, { cognome: e.target.value })} />
                        <input className={inputCls} type="date" aria-label={`Data di nascita frazione ${i + 1}`} value={f.dataNascita} onChange={e => setF(i, { dataNascita: e.target.value })} />
                        <select className={inputCls} aria-label={`Sesso frazione ${i + 1}`} value={f.sesso} onChange={e => setF(i, { sesso: e.target.value as Frazionista['sesso'] })}>
                            <option value="">Sesso *</option><option value="M">Uomo</option><option value="F">Donna</option>
                        </select>
                        <input className={inputCls} placeholder="Tessera FIDAL / Runcard (se tesserato)" value={f.tessera} onChange={e => setF(i, { tessera: e.target.value })} />
                        <input className={inputCls} type="email" placeholder={i === 0 ? 'Email del capitano *' : 'Email (facoltativa)'} value={f.email} onChange={e => setF(i, { email: e.target.value })} />
                    </div>
                </fieldset>
            ))}
            {errori.length > 0 && (
                <ul className="text-xs text-red-600 list-disc pl-5">{errori.map(e => <li key={e}>{e}</li>)}</ul>
            )}
        </div>
    );
}
