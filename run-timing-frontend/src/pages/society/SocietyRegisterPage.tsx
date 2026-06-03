import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Building2, Check, AlertCircle, Users } from 'lucide-react';
import { useSocietyAuth } from '../../context/useSocietyAuth';
import { lookupBySociety } from '../../data/mockFidal';
import { fidalToRoster } from './rosterUtils';
import type { RaceEnte, RosterAthlete } from '../../types';

const inputCls =
    'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500';

const ENTI: { value: RaceEnte; label: string }[] = [
    { value: 'fidal', label: 'FIDAL' }, { value: 'uisp', label: 'UISP' }, { value: 'csi', label: 'CSI' },
    { value: 'acsi', label: 'ACSI' }, { value: 'aics', label: 'AICS' }, { value: 'libertas', label: 'Libertas' },
    { value: 'altro', label: 'Altro ente' },
];

export default function SocietyRegisterPage() {
    const navigate = useNavigate();
    const { register } = useSocietyAuth();
    const [form, setForm] = useState({
        presidentName: '', presidentSurname: '', email: '', password: '',
        phone: '', societaNome: '', ente: 'fidal' as RaceEnte, codiceFidal: '',
    });
    const [preview, setPreview] = useState<RosterAthlete[] | null>(null);
    const [error, setError] = useState('');

    function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
        setForm(f => ({ ...f, [k]: v }));
    }

    function loadRoster() {
        const found = lookupBySociety(form.codiceFidal);
        setPreview(found.map(fidalToRoster));
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        if (!form.presidentName.trim() || !form.presidentSurname.trim() || !form.email.trim() || !form.password || !form.societaNome.trim()) {
            setError('Compila tutti i campi obbligatori.');
            return;
        }
        const roster = preview ?? (form.ente === 'fidal' && form.codiceFidal ? lookupBySociety(form.codiceFidal).map(fidalToRoster) : []);
        const res = register({
            presidentName: form.presidentName.trim(),
            presidentSurname: form.presidentSurname.trim(),
            email: form.email.trim(),
            password: form.password,
            phone: form.phone.trim() || undefined,
            societaNome: form.societaNome.trim(),
            ente: form.ente,
            codiceFidal: form.codiceFidal.trim() || undefined,
            roster,
        });
        if ('error' in res) { setError(res.error); return; }
        navigate('/societa');
    }

    return (
        <main className="min-h-screen bg-slate-50 py-10 px-4">
            <div className="max-w-lg mx-auto">
                <div className="text-center mb-6">
                    <div className="w-12 h-12 rounded-xl bg-brand-600 flex items-center justify-center mx-auto mb-3">
                        <Building2 className="w-6 h-6 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800">Registra la tua società</h1>
                    <p className="text-slate-500 text-sm mt-1">Crea l'account del presidente e gestisci i tuoi atleti.</p>
                </div>

                <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                    {error && (
                        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-sm">
                            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Nome presidente *</label>
                            <input className={inputCls} value={form.presidentName} onChange={e => set('presidentName', e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Cognome presidente *</label>
                            <input className={inputCls} value={form.presidentSurname} onChange={e => set('presidentSurname', e.target.value)} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                            <input type="email" className={inputCls} value={form.email} onChange={e => set('email', e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Password *</label>
                            <input type="password" className={inputCls} value={form.password} onChange={e => set('password', e.target.value)} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Telefono</label>
                        <input type="tel" className={inputCls} value={form.phone} onChange={e => set('phone', e.target.value)} />
                    </div>

                    <hr className="border-slate-100" />

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nome società *</label>
                        <input className={inputCls} value={form.societaNome} onChange={e => set('societaNome', e.target.value)} placeholder="es. ASD Runners Roma" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Ente</label>
                            <select className={inputCls} value={form.ente} onChange={e => set('ente', e.target.value as RaceEnte)}>
                                {ENTI.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Codice società FIDAL</label>
                            <input className={inputCls} value={form.codiceFidal} onChange={e => { set('codiceFidal', e.target.value.toUpperCase()); setPreview(null); }} placeholder="es. RM001" />
                        </div>
                    </div>

                    {form.ente === 'fidal' && form.codiceFidal && (
                        <div className="rounded-xl border border-brand-200 bg-brand-50 p-3">
                            <button type="button" onClick={loadRoster}
                                className="flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-900">
                                <Users className="w-4 h-4" /> Carica atleti dal DB FIDAL
                            </button>
                            {preview && (
                                <p className="text-xs text-slate-600 mt-2">
                                    {preview.length === 0
                                        ? 'Nessun atleta trovato per questo codice società.'
                                        : `${preview.length} atleti trovati e pronti per essere importati nel roster.`}
                                </p>
                            )}
                        </div>
                    )}

                    <button type="submit"
                        className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors">
                        <Check className="w-4 h-4" /> Crea account società
                    </button>

                    <p className="text-center text-sm text-slate-500">
                        Hai già un account? <Link to="/societa/accedi" className="text-brand-600 hover:underline">Accedi</Link>
                    </p>
                </form>
            </div>
        </main>
    );
}
