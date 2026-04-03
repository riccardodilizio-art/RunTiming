import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { UserPlus, Eye, EyeOff, AlertCircle, Timer, ShieldCheck, ArrowLeft } from 'lucide-react';
import { useAthleteAuth } from '../context/AthleteAuthContext';

const inputCls =
    'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ocean-500 focus:border-ocean-500';
const selectCls = inputCls + ' bg-white';

export default function AthleteRegisterPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { register } = useAthleteAuth();

    // Redirect params (venendo da RegisterPage caso non-FIDAL)
    const redirectTo  = searchParams.get('redirect') ?? '/profilo';
    const fromReg     = searchParams.get('from') === 'iscrizione';

    const [form, setForm] = useState({
        email:          '',
        password:       '',
        confirmPassword:'',
        name:           '',
        surname:        '',
        birthDate:      '',
        gender:         '' as 'M' | 'F' | '',
        phone:          '',
        club:           '',
        codFiscale:     '',
        fidalTessera:   '',
        runcardTessera: '',
        certType:       '' as 'agonistico' | 'non_agonistico' | 'esenzione' | '',
        certExpiry:     '',
        certNumber:     '',
        certFileName:   '',
    });
    const [showPw,  setShowPw]  = useState(false);
    const [error,   setError]   = useState('');
    const [loading, setLoading] = useState(false);

    function set(field: keyof typeof form) {
        return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
            setForm(f => ({ ...f, [field]: e.target.value }));
    }

    const today = new Date().toISOString().slice(0, 10);
    const certExpired = form.certExpiry && form.certExpiry < today;
    const birthYear   = form.birthDate ? new Date(form.birthDate).getFullYear() : null;

    function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError('');

        if (form.password !== form.confirmPassword) {
            setError('Le password non coincidono.');
            return;
        }
        if (form.password.length < 6) {
            setError('La password deve essere di almeno 6 caratteri.');
            return;
        }
        if (!form.gender) { setError('Seleziona il sesso.'); return; }
        if (!form.birthDate) { setError('Inserisci la data di nascita.'); return; }

        setLoading(true);
        setTimeout(() => {
            const result = register({
                email:          form.email.trim(),
                password:       form.password,
                name:           form.name.trim(),
                surname:        form.surname.trim(),
                birthDate:      form.birthDate,
                gender:         form.gender as 'M' | 'F',
                phone:          form.phone.trim()          || undefined,
                club:           form.club.trim()           || undefined,
                codFiscale:     form.codFiscale.trim().toUpperCase() || undefined,
                fidalTessera:   form.fidalTessera.trim()  || undefined,
                runcardTessera: form.runcardTessera.trim()|| undefined,
                certType:       (form.certType as 'agonistico' | 'non_agonistico' | 'esenzione') || undefined,
                certExpiry:     form.certExpiry            || undefined,
                certNumber:     form.certNumber.trim()     || undefined,
                certFileName:   form.certFileName          || undefined,
                certStatus:     form.certType && form.certExpiry && !certExpired ? 'in_attesa' : undefined,
            });
            setLoading(false);
            if ('error' in result) { setError(result.error); return; }
            navigate(redirectTo, { replace: true });
        }, 300);
    }

    return (
        <main className="min-h-screen bg-slate-50 px-4 py-10">
            <div className="w-full max-w-lg mx-auto">

                {/* Header */}
                <div className="text-center mb-8">
                    <Link to="/" className="inline-flex items-center gap-2 mb-5">
                        <div className="w-10 h-10 bg-ocean-600 rounded-xl flex items-center justify-center">
                            <Timer className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-display font-700 text-xl text-slate-800">
                            Run<span className="text-ocean-600">Timing</span>
                        </span>
                    </Link>
                    <h1 className="font-display font-700 text-2xl text-slate-800">Crea il tuo account</h1>
                    {fromReg ? (
                        <p className="text-slate-500 text-sm mt-1">
                            Registrati per completare l'iscrizione alla gara. I tuoi dati verranno
                            caricati automaticamente nel modulo.
                        </p>
                    ) : (
                        <p className="text-slate-500 text-sm mt-1">
                            Accedi alla tua area personale e tieni traccia delle tue gare
                        </p>
                    )}
                </div>

                {/* Back to registration notice */}
                {fromReg && (
                    <div className="flex items-center gap-2 bg-ocean-50 border border-ocean-200 rounded-xl px-4 py-3 mb-5 text-sm text-ocean-800">
                        <ArrowLeft className="w-4 h-4 shrink-0" />
                        Dopo la registrazione verrai reindirizzato all'iscrizione con i dati pre-compilati.
                    </div>
                )}

                <form onSubmit={handleSubmit}
                    className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">

                    {error && (
                        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-sm">
                            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                        </div>
                    )}

                    {/* ── Accesso ───────────────────────────────────── */}
                    <section>
                        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Accesso</h2>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                                <input type="email" autoComplete="email" value={form.email} onChange={set('email')}
                                    className={inputCls} placeholder="mario@esempio.it" required />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Password *</label>
                                    <div className="relative">
                                        <input type={showPw ? 'text' : 'password'} autoComplete="new-password"
                                            value={form.password} onChange={set('password')}
                                            className={`${inputCls} pr-10`} placeholder="••••••••" required />
                                        <button type="button" onClick={() => setShowPw(v => !v)} tabIndex={-1}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Conferma password *</label>
                                    <input type={showPw ? 'text' : 'password'} autoComplete="new-password"
                                        value={form.confirmPassword} onChange={set('confirmPassword')}
                                        className={inputCls} placeholder="••••••••" required />
                                </div>
                            </div>
                        </div>
                    </section>

                    <hr className="border-slate-100" />

                    {/* ── Dati anagrafici ───────────────────────────── */}
                    <section>
                        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Dati anagrafici</h2>
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
                                    <input type="text" autoComplete="given-name" value={form.name} onChange={set('name')}
                                        className={inputCls} placeholder="Mario" required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Cognome *</label>
                                    <input type="text" autoComplete="family-name" value={form.surname} onChange={set('surname')}
                                        className={inputCls} placeholder="Rossi" required />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Data di nascita *</label>
                                    <input type="date" value={form.birthDate} onChange={set('birthDate')}
                                        max={new Date(new Date().setFullYear(new Date().getFullYear() - 5)).toISOString().slice(0, 10)}
                                        className={inputCls} required />
                                    {birthYear && (
                                        <p className="text-xs text-slate-400 mt-1">
                                            Anno: {birthYear} · Età: {new Date().getFullYear() - birthYear} anni
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Sesso *</label>
                                    <select value={form.gender} onChange={set('gender')} className={selectCls} required>
                                        <option value="">Seleziona</option>
                                        <option value="M">Maschile</option>
                                        <option value="F">Femminile</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Codice fiscale</label>
                                <input type="text" value={form.codFiscale} onChange={set('codFiscale')}
                                    className={inputCls} placeholder="RSSMRA85M01H501Z"
                                    maxLength={16} style={{ textTransform: 'uppercase' }} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Telefono</label>
                                    <input type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')}
                                        className={inputCls} placeholder="+39 333 000 0000" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Società / Club</label>
                                    <input type="text" value={form.club} onChange={set('club')}
                                        className={inputCls} placeholder="ASD Esempio" />
                                </div>
                            </div>
                        </div>
                    </section>

                    <hr className="border-slate-100" />

                    {/* ── Tessere ───────────────────────────────────── */}
                    <section>
                        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Tessere sportive</h2>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Tessera FIDAL</label>
                                <input type="text" value={form.fidalTessera} onChange={set('fidalTessera')}
                                    className={inputCls} placeholder="FI12345678" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Tessera Runcard</label>
                                <input type="text" value={form.runcardTessera} onChange={set('runcardTessera')}
                                    className={inputCls} placeholder="RC123456" />
                            </div>
                        </div>
                    </section>

                    <hr className="border-slate-100" />

                    {/* ── Certificato medico ────────────────────────── */}
                    <section>
                        <div className="flex items-center gap-2 mb-1">
                            <ShieldCheck className="w-4 h-4 text-ocean-500" />
                            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Certificato medico</h2>
                        </div>
                        <p className="text-xs text-slate-500 mb-3">
                            Inserisci il certificato <strong>una sola volta</strong>. Sarà verificato dall'amministratore
                            e rimarrà valido per tutte le gare future fino alla scadenza.
                        </p>
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Tipo certificato</label>
                                    <select value={form.certType} onChange={set('certType')} className={selectCls}>
                                        <option value="">Nessuno / Non richiesto</option>
                                        <option value="agonistico">Agonistico</option>
                                        <option value="non_agonistico">Non agonistico</option>
                                        <option value="esenzione">Esenzione</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Scadenza</label>
                                    <input type="date" value={form.certExpiry} onChange={set('certExpiry')}
                                        className={inputCls} />
                                    {certExpired && (
                                        <p className="text-xs text-red-500 mt-1">⚠ Certificato scaduto</p>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Numero certificato (opzionale)</label>
                                <input type="text" value={form.certNumber} onChange={set('certNumber')}
                                    className={inputCls} placeholder="Es. CERT-2024-001234" />
                            </div>
                            {form.certType && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Copia del certificato (PDF o immagine)
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer w-fit px-3 py-2 rounded-lg border border-dashed border-slate-300 hover:border-ocean-400 hover:bg-ocean-50 text-sm text-slate-500 transition-colors">
                                        <ShieldCheck className="h-4 w-4 text-slate-400" />
                                        {form.certFileName ? (
                                            <span className="text-ocean-700 font-medium">{form.certFileName}</span>
                                        ) : (
                                            <span>Seleziona file…</span>
                                        )}
                                        <input type="file" accept="application/pdf,image/*" className="hidden"
                                            onChange={e => setForm(f => ({ ...f, certFileName: e.target.files?.[0]?.name ?? '' }))} />
                                    </label>
                                    <p className="text-xs text-slate-400 mt-1">
                                        Il documento sarà inviato al server (funzionalità attiva con backend).
                                    </p>
                                </div>
                            )}
                        </div>
                    </section>

                    <button type="submit" disabled={loading}
                        className="w-full bg-ocean-600 hover:bg-ocean-700 disabled:opacity-60 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors flex items-center justify-center gap-2 mt-2">
                        {loading
                            ? <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                            : <UserPlus className="w-4 h-4" />}
                        {loading ? 'Registrazione…' : 'Crea account'}
                    </button>
                </form>

                <p className="text-center text-sm text-slate-500 mt-4">
                    Hai già un account?{' '}
                    <Link to={`/accedi${redirectTo !== '/profilo' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`}
                        className="text-ocean-600 font-medium hover:underline">
                        Accedi
                    </Link>
                </p>
                <p className="text-center text-xs text-slate-400 mt-2">
                    Sei un organizzatore?{' '}
                    <Link to="/login" className="hover:underline">Accedi al pannello</Link>
                </p>
            </div>
        </main>
    );
}
