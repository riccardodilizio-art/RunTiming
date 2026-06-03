import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Building2, LogIn, AlertCircle } from 'lucide-react';
import { useSocietyAuth } from '../../context/useSocietyAuth';

const inputCls =
    'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500';

export default function SocietyLoginPage() {
    const navigate = useNavigate();
    const { login } = useSocietyAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        const res = login(email.trim(), password);
        if (!res) { setError('Email o password non corretti.'); return; }
        navigate('/societa');
    }

    return (
        <main className="min-h-screen bg-slate-50 py-12 px-4">
            <div className="max-w-sm mx-auto">
                <div className="text-center mb-6">
                    <div className="w-12 h-12 rounded-xl bg-brand-600 flex items-center justify-center mx-auto mb-3">
                        <Building2 className="w-6 h-6 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800">Accesso società</h1>
                    <p className="text-slate-500 text-sm mt-1">Area riservata ai presidenti.</p>
                </div>
                <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                    {error && (
                        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-sm">
                            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                        <input type="email" className={inputCls} value={email} onChange={e => setEmail(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                        <input type="password" className={inputCls} value={password} onChange={e => setPassword(e.target.value)} />
                    </div>
                    <button type="submit"
                        className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors">
                        <LogIn className="w-4 h-4" /> Accedi
                    </button>
                    <p className="text-center text-sm text-slate-500">
                        Non hai un account? <Link to="/societa/registrati" className="text-brand-600 hover:underline">Registra la società</Link>
                    </p>
                </form>
            </div>
        </main>
    );
}
