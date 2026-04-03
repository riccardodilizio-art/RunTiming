import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { LogIn, Eye, EyeOff, AlertCircle, Timer } from 'lucide-react';
import { useAthleteAuth } from '../context/AthleteAuthContext';

const inputCls =
    'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ocean-500 focus:border-ocean-500';

export default function AthleteLoginPage() {
    const navigate  = useNavigate();
    const [searchParams] = useSearchParams();
    const { login } = useAthleteAuth();
    const redirectTo = searchParams.get('redirect') ?? '/profilo';

    const [email,   setEmail]   = useState('');
    const [password, setPassword] = useState('');
    const [showPw,  setShowPw]  = useState(false);
    const [error,   setError]   = useState('');
    const [loading, setLoading] = useState(false);

    function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError('');
        setLoading(true);
        setTimeout(() => {
            const result = login(email.trim(), password);
            setLoading(false);
            if (!result) {
                setError('Email o password non corretti.');
                return;
            }
            navigate(redirectTo, { replace: true });
        }, 300);
    }

    return (
        <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <Link to="/" className="inline-flex items-center gap-2 mb-5">
                        <div className="w-10 h-10 bg-ocean-600 rounded-xl flex items-center justify-center">
                            <Timer className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-display font-700 text-xl text-slate-800">
                            Run<span className="text-ocean-600">Timing</span>
                        </span>
                    </Link>
                    <h1 className="font-display font-700 text-2xl text-slate-800">Bentornato atleta</h1>
                    <p className="text-slate-500 text-sm mt-1">Accedi alla tua area personale</p>
                </div>

                <form onSubmit={handleSubmit}
                    className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
                    {error && (
                        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-sm">
                            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                        <input type="email" autoComplete="email" value={email}
                            onChange={e => setEmail(e.target.value)}
                            className={inputCls} placeholder="mario@esempio.it" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                        <div className="relative">
                            <input type={showPw ? 'text' : 'password'} autoComplete="current-password"
                                value={password} onChange={e => setPassword(e.target.value)}
                                className={`${inputCls} pr-10`} placeholder="••••••••" required />
                            <button type="button" onClick={() => setShowPw(v => !v)} tabIndex={-1}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                    <button type="submit" disabled={loading}
                        className="w-full bg-ocean-600 hover:bg-ocean-700 disabled:opacity-60 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors flex items-center justify-center gap-2">
                        {loading
                            ? <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                            : <LogIn className="w-4 h-4" />}
                        {loading ? 'Accesso…' : 'Accedi'}
                    </button>
                </form>

                <p className="text-center text-sm text-slate-500 mt-4">
                    Non hai un account?{' '}
                    <Link
                        to={`/registrati${redirectTo !== '/profilo' ? `?redirect=${encodeURIComponent(redirectTo)}&from=iscrizione` : ''}`}
                        className="text-ocean-600 font-medium hover:underline">
                        Registrati gratuitamente
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
