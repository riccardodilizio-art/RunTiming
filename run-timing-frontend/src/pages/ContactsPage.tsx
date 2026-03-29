import { useState } from 'react';
import { Mail, Phone, MapPin, Send, CheckCircle } from 'lucide-react';

type FormState = { name: string; email: string; subject: string; message: string };
const EMPTY: FormState = { name: '', email: '', subject: '', message: '' };

const SUBJECTS = [
    'Informazioni generali',
    'Supporto tecnico',
    'Iscrizioni e pagamenti',
    'Organizzatori',
    'Altro',
];

export default function ContactsPage() {
    const [form, setForm]       = useState<FormState>(EMPTY);
    const [errors, setErrors]   = useState<Partial<FormState>>({});
    const [sent, setSent]       = useState(false);
    const [loading, setLoading] = useState(false);

    function validate(): boolean {
        const e: Partial<FormState> = {};
        if (!form.name.trim())    e.name    = 'Il nome è obbligatorio';
        if (!form.email.trim())   e.email   = "L'email è obbligatoria";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
                                  e.email   = 'Inserisci un indirizzo email valido';
        if (!form.subject)        e.subject = 'Seleziona un argomento';
        if (!form.message.trim()) e.message = 'Il messaggio è obbligatorio';
        setErrors(e);
        return Object.keys(e).length === 0;
    }

    function handleChange(field: keyof FormState, value: string) {
        setForm(f => ({ ...f, [field]: value }));
        if (errors[field]) setErrors(e => ({ ...e, [field]: undefined }));
    }

    async function handleSubmit(ev: React.FormEvent) {
        ev.preventDefault();
        if (!validate()) return;
        setLoading(true);
        // Simuliamo invio
        await new Promise(r => setTimeout(r, 1000));
        setLoading(false);
        setSent(true);
    }

    return (
        <main className="min-h-screen bg-slate-50">

            {/* Header */}
            <div className="py-8 px-4 text-center" style={{ background: 'linear-gradient(135deg, #0a3c6e 0%, #0168c8 100%)' }}>
                <h1 className="font-display font-800 text-3xl md:text-4xl text-white mb-1">Contatti</h1>
                <p className="text-sky-200 text-sm">Siamo qui per aiutarti</p>
            </div>

            <div className="max-w-5xl mx-auto px-4 py-10">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

                    {/* Left: contact info */}
                    <div className="space-y-5">
                        <div>
                            <h2 className="font-display font-700 text-lg text-slate-800 mb-1">Parlaci</h2>
                            <p className="text-slate-500 text-sm leading-relaxed">
                                Hai domande su un evento, un'iscrizione o vuoi collaborare con noi?
                                Scrivici e ti risponderemo entro 24 ore.
                            </p>
                        </div>

                        <div className="space-y-3">
                            {[
                                { icon: Mail,    label: 'Email',     value: 'info@runtiming.it' },
                                { icon: Phone,   label: 'Telefono',  value: '+39 02 1234 5678' },
                                { icon: MapPin,  label: 'Indirizzo', value: 'Via dello Sport 12\n20121 Milano (MI)' },
                            ].map(({ icon: Icon, label, value }) => (
                                <div key={label} className="flex items-start gap-3 bg-white border border-slate-200 rounded-xl p-4"
                                     style={{ boxShadow: '2px 4px 6px 0 #eeeeee' }}>
                                    <div className="w-8 h-8 bg-ocean-50 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <Icon className="w-4 h-4 text-ocean-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">{label}</p>
                                        <p className="text-slate-700 text-sm mt-0.5 whitespace-pre-line">{value}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="bg-ocean-50 border border-ocean-200 rounded-xl p-4">
                            <p className="text-ocean-700 text-xs font-medium mb-1">Orari di supporto</p>
                            <p className="text-ocean-600 text-sm">Lun – Ven: 9:00 – 18:00</p>
                            <p className="text-ocean-600 text-sm">Sab: 9:00 – 13:00</p>
                        </div>
                    </div>

                    {/* Right: form */}
                    <div className="md:col-span-2">
                        <div className="bg-white border border-slate-200 rounded-xl p-6"
                             style={{ boxShadow: '2px 4px 6px 0 #eeeeee' }}>

                            {sent ? (
                                <div className="text-center py-12">
                                    <CheckCircle className="w-12 h-12 text-teal-500 mx-auto mb-4" />
                                    <h3 className="font-display font-700 text-xl text-slate-800 mb-2">
                                        Messaggio inviato!
                                    </h3>
                                    <p className="text-slate-500 text-sm mb-6">
                                        Grazie per averci contattato. Ti risponderemo entro 24 ore.
                                    </p>
                                    <button
                                        onClick={() => { setSent(false); setForm(EMPTY); }}
                                        className="text-ocean-600 hover:text-ocean-700 text-sm font-medium underline"
                                    >
                                        Invia un altro messaggio
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} noValidate>
                                    <h2 className="font-display font-700 text-lg text-slate-800 border-b border-slate-100 pb-3 mb-5">
                                        Inviaci un messaggio
                                    </h2>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                        {/* Name */}
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 mb-1.5">
                                                Nome e Cognome <span className="text-red-400">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={form.name}
                                                onChange={e => handleChange('name', e.target.value)}
                                                placeholder="Mario Rossi"
                                                className={`w-full border rounded-lg px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:outline-none transition-colors ${
                                                    errors.name
                                                        ? 'border-red-300 focus:border-red-400 bg-red-50'
                                                        : 'border-slate-300 focus:border-ocean-400'
                                                }`}
                                            />
                                            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                                        </div>

                                        {/* Email */}
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 mb-1.5">
                                                Email <span className="text-red-400">*</span>
                                            </label>
                                            <input
                                                type="email"
                                                value={form.email}
                                                onChange={e => handleChange('email', e.target.value)}
                                                placeholder="mario@email.it"
                                                className={`w-full border rounded-lg px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:outline-none transition-colors ${
                                                    errors.email
                                                        ? 'border-red-300 focus:border-red-400 bg-red-50'
                                                        : 'border-slate-300 focus:border-ocean-400'
                                                }`}
                                            />
                                            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                                        </div>
                                    </div>

                                    {/* Subject */}
                                    <div className="mb-4">
                                        <label className="block text-xs font-medium text-slate-600 mb-1.5">
                                            Argomento <span className="text-red-400">*</span>
                                        </label>
                                        <select
                                            value={form.subject}
                                            onChange={e => handleChange('subject', e.target.value)}
                                            className={`w-full border rounded-lg px-3 py-2.5 text-sm text-slate-700 focus:outline-none transition-colors appearance-none bg-white ${
                                                errors.subject
                                                    ? 'border-red-300 focus:border-red-400 bg-red-50'
                                                    : 'border-slate-300 focus:border-ocean-400'
                                            }`}
                                        >
                                            <option value="">Seleziona un argomento...</option>
                                            {SUBJECTS.map(s => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                        </select>
                                        {errors.subject && <p className="text-red-500 text-xs mt-1">{errors.subject}</p>}
                                    </div>

                                    {/* Message */}
                                    <div className="mb-6">
                                        <label className="block text-xs font-medium text-slate-600 mb-1.5">
                                            Messaggio <span className="text-red-400">*</span>
                                        </label>
                                        <textarea
                                            rows={5}
                                            value={form.message}
                                            onChange={e => handleChange('message', e.target.value)}
                                            placeholder="Scrivi qui il tuo messaggio..."
                                            className={`w-full border rounded-lg px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:outline-none transition-colors resize-none ${
                                                errors.message
                                                    ? 'border-red-300 focus:border-red-400 bg-red-50'
                                                    : 'border-slate-300 focus:border-ocean-400'
                                            }`}
                                        />
                                        {errors.message && <p className="text-red-500 text-xs mt-1">{errors.message}</p>}
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="flex items-center gap-2 bg-ocean-600 hover:bg-ocean-700 disabled:bg-ocean-300 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors text-sm"
                                    >
                                        {loading ? (
                                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <Send className="w-4 h-4" />
                                        )}
                                        {loading ? 'Invio in corso...' : 'Invia messaggio'}
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </main>
    );
}
