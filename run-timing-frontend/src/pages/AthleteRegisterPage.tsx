import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus, Eye, EyeOff, AlertCircle, Timer } from 'lucide-react';
import { useAthleteAuth } from '../context/AthleteAuthContext';

const inputCls =
    'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ocean-500 focus:border-ocean-500';

const selectCls =
    'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ocean-500 focus:border-ocean-500 bg-white';

export default function AthleteRegisterPage() {
    const navigate   = useNavigate();
    const { register } = useAthleteAuth();

    const [form, setForm] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        name: '',
        surname: '',
        birthYear: '',
        gender: '' as 'M' | 'F' | '',
        phone: '',
        club: '',
        fidalTessera: '',
        runcardTessera: '',
    });
    const [showPw,  setShowPw]  = useState(false);
    const [error,   setError]   = useState('');
    const [loading, setLoading] = useState(false);

    function set(field: keyof typeof form) {
        return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
            setForm(f => ({ ...f, [field]: e.target.value }));
    }

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
        if (!form.gender) {
            setError('Seleziona il sesso.');
            return;
        }
        const year = parseInt(form.birthYear, 10);
        if (!year || year < 1920 || year > new Date().getFullYear() - 5) {
            setError('Anno di nascita non valido.');
            return;
        }

        setLoading(true);
        setTimeout(() => {
            const result = register({
                email:          form.email.trim(),
                password:       form.password,
                name:           form.name.trim(),
                surname:        form.surname.trim(),
                birthYear:      year,
                gender:         form.gender as 'M' | 'F',
                phone:          form.phone.trim() || undefined,
                club:           form.club.trim() || undefined,
                fidalTessera:   form.fidalTessera.trim() || undefined,
                runcardTessera: form.runcardTessera.trim() || undefined,
            });
            setLoading(false);
            if ('error' in result) {
                setError(result.error);
                return;
            }
            navigate('/profilo', { replace: true });
        }, 300);
    }

    return (
        <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
            <div className="w-full max-w-md">
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
                    <p className="text-slate-500 text-sm mt-1">Accedi alla tua area personale dopo ogni gara</p>
                </div>

                <form onSubmit={handleSubmit}
                    className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
                    {error && (
                        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-sm">
                            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                        </div>
                    )}

                    {/* Email */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                        <input type="email" autoComplete="email" value={form.email} onChange={set('email')}
                            className={inputCls} placeholder="mario@esempio.it" required />
                    </div>

                    {/* Password */}
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

                    <hr className="border-slate-100" />

                    {/* Name / Surname */}
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

                    {/* Birth year / Gender */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Anno di nascita *</label>
                            <input type="number" min={1920} max={new Date().getFullYear() - 5}
                                value={form.birthYear} onChange={set('birthYear')}
                                className={inputCls} placeholder="1990" required />
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

                    {/* Phone / Club */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Telefono</label>
                            <input type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')}
                                className={inputCls} placeholder="+39 333 000 0000" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Società</label>
                            <input type="text" value={form.club} onChange={set('club')}
                                className={inputCls} placeholder="ASD Esempio" />
                        </div>
                    </div>

                    <hr className="border-slate-100" />

                    {/* Tessere */}
                    <p className="text-xs text-slate-500 -mb-1">
                        Inserisci le tessere per il pre-compilazione automatica delle iscrizioni
                    </p>
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
                    <Link to="/accedi" className="text-ocean-600 font-medium hover:underline">
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
