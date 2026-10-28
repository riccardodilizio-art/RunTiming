import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound, Mail, Timer } from 'lucide-react';
import { USE_API, api } from '../lib/api';
import { takeCaptchaToken } from '../lib/captcha';
import { Captcha } from '../components/Captcha';

// "Password dimenticata" e "Reimposta password": valgono per tutti gli account
// (atleti, società, organizzatori, admin). Il link arriva per email ed è valido 1 ora.

const inputCls =
    'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500';
const btnCls =
    'w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors flex items-center justify-center gap-2';

function Shell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
    return (
        <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <Link to="/" className="inline-flex items-center gap-2 mb-5">
                        <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center">
                            <Timer className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-display font-700 text-xl text-slate-800">
                            Run<span className="text-brand-600">Timing</span>
                        </span>
                    </Link>
                    <h1 className="font-display font-700 text-2xl text-slate-800">{title}</h1>
                    <p className="text-slate-500 text-sm mt-1">{subtitle}</p>
                </div>
                {children}
            </div>
        </main>
    );
}

function LoginLinks() {
    return (
        <p className="text-center text-sm text-slate-500 mt-4">
            Vai all'accesso:{' '}
            <Link to="/accedi" className="text-brand-600 hover:underline">atleti</Link>{' · '}
            <Link to="/societa/accedi" className="text-brand-600 hover:underline">società</Link>{' · '}
            <Link to="/login" className="text-brand-600 hover:underline">organizzatori</Link>
        </p>
    );
}

const Err = ({ msg }: { msg: string }) => (
    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-sm">
        <AlertCircle className="w-4 h-4 shrink-0" /> {msg}
    </div>
);

/** Link "Password dimenticata?" da mettere sotto i form di accesso (solo con il backend). */
export function ForgotPasswordLink() {
    if (!USE_API) return null;
    return (
        <p className="text-right -mt-2">
            <Link to="/password-dimenticata" className="text-xs text-brand-600 hover:underline">Password dimenticata?</Link>
        </p>
    );
}

export function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await api.post('/auth/password/forgot', { email: email.trim(), captchaToken: takeCaptchaToken() });
            setSent(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Richiesta non riuscita, riprova.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <Shell title="Password dimenticata" subtitle="Ti mandiamo un link per sceglierne una nuova">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
                {!USE_API ? (
                    <p className="text-sm text-slate-600">Il recupero password è disponibile solo sul sito online.</p>
                ) : sent ? (
                    <div className="flex gap-3 text-sm text-slate-700">
                        <Mail className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
                        <p>
                            Se <strong>{email.trim()}</strong> corrisponde a un account, tra pochi minuti riceverai un'email
                            con il link per scegliere una nuova password. Il link vale 1 ora.
                            <span className="block text-slate-500 mt-2">Non la trovi? Controlla anche nella cartella spam.</span>
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && <Err msg={error} />}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Email dell'account</label>
                            <input type="email" autoComplete="email" required value={email}
                                onChange={e => setEmail(e.target.value)} className={inputCls} placeholder="mario@esempio.it" />
                        </div>
                        <Captcha className="flex justify-center" />
                        <button type="submit" disabled={loading || !email.trim()} className={btnCls}>
                            <Mail className="w-4 h-4" /> {loading ? 'Invio…' : 'Inviami il link'}
                        </button>
                    </form>
                )}
            </div>
            <LoginLinks />
        </Shell>
    );
}

export function ResetPasswordPage() {
    const [params] = useSearchParams();
    const token = params.get('token') ?? '';
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError('');
        if (password.length < 8) { setError('La password deve avere almeno 8 caratteri.'); return; }
        if (password !== confirm) { setError('Le due password non coincidono.'); return; }
        setLoading(true);
        try {
            await api.post('/auth/password/reset', { token, password });
            setDone(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Non è stato possibile cambiare la password.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <Shell title="Nuova password" subtitle="Scegli la nuova password del tuo account">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
                {!token ? (
                    <>
                        <Err msg="Link incompleto. Apri il link dall'email oppure richiedine uno nuovo." />
                        <Link to="/password-dimenticata" className="text-sm text-brand-600 hover:underline">Richiedi un nuovo link</Link>
                    </>
                ) : done ? (
                    <div className="flex gap-3 text-sm text-slate-700">
                        <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                        <p>Password cambiata. Per sicurezza abbiamo chiuso gli accessi aperti sugli altri dispositivi: accedi con la nuova password.</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && <Err msg={error} />}
                        {error.includes('scaduto') && (
                            <Link to="/password-dimenticata" className="block text-sm text-brand-600 hover:underline">Richiedi un nuovo link</Link>
                        )}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Nuova password</label>
                            <div className="relative">
                                <input type={showPw ? 'text' : 'password'} autoComplete="new-password" required minLength={8}
                                    value={password} onChange={e => setPassword(e.target.value)}
                                    className={`${inputCls} pr-10`} placeholder="Almeno 8 caratteri" />
                                <button type="button" onClick={() => setShowPw(v => !v)} tabIndex={-1} aria-label="Mostra password"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Ripeti la password</label>
                            <input type={showPw ? 'text' : 'password'} autoComplete="new-password" required
                                value={confirm} onChange={e => setConfirm(e.target.value)} className={inputCls} />
                        </div>
                        <button type="submit" disabled={loading} className={btnCls}>
                            <KeyRound className="w-4 h-4" /> {loading ? 'Salvataggio…' : 'Salva la nuova password'}
                        </button>
                    </form>
                )}
            </div>
            <LoginLinks />
        </Shell>
    );
}
