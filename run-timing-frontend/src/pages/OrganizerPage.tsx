import { Link } from 'react-router-dom';
import { ArrowRight, Mail, FileText, CheckCircle, Users, Settings } from 'lucide-react';

// ─── Come funziona ────────────────────────────────────────────────────────────

const STEPS = [
    {
        n: '01',
        icon: <Mail className="w-6 h-6" />,
        title: 'Richiedi un preventivo',
        desc: 'Contattaci raccontandoci la tua gara: distanze, numero stimato di partecipanti e data. Ti risponderemo entro 24 ore con una proposta personalizzata.',
    },
    {
        n: '02',
        icon: <FileText className="w-6 h-6" />,
        title: 'Ricevi la proposta',
        desc: 'Ti invieremo un preventivo chiaro con tutti i costi del servizio. Nessuna sorpresa: sai esattamente cosa include la piattaforma per la tua manifestazione.',
    },
    {
        n: '03',
        icon: <CheckCircle className="w-6 h-6" />,
        title: 'La tua gara va online',
        desc: 'Ci occupiamo noi di configurare l\'evento, i moduli di iscrizione, le quote e tutte le impostazioni. La tua gara sarà pronta per ricevere iscrizioni in pochissimo tempo.',
    },
];

// ─── Opzioni di gestione ──────────────────────────────────────────────────────

const OPTIONS = [
    {
        icon: <Settings className="w-6 h-6 text-ocean-600" />,
        title: 'Gestione completa affidata a noi',
        desc: 'Pensiamo a tutto: dalla creazione dell\'evento alla gestione degli iscritti. Tu ricevi report e aggiornamenti senza dover fare nulla.',
        tags: ['Zero operatività', 'Ideale per chi non ha tempo'],
    },
    {
        icon: <Users className="w-6 h-6 text-ocean-600" />,
        title: 'Accesso diretto per te',
        desc: 'Se lo desideri, possiamo fornirti delle credenziali personali. Potrai accedere al pannello per consultare la lista iscritti, aggiungere atleti manualmente e tenere sotto controllo la tua gara.',
        tags: ['Pannello organizzatore', 'Lista iscritti in tempo reale'],
    },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrganizerPage() {
    return (
        <main className="bg-slate-50">

            {/* Hero */}
            <section
                className="relative overflow-hidden py-20 px-4 text-center"
                style={{ background: 'linear-gradient(135deg, #041e3e 0%, #0a3c6e 50%, #0168c8 100%)' }}
            >
                <div
                    className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-10 pointer-events-none"
                    style={{ background: 'radial-gradient(circle, #38bdf8, transparent 70%)' }}
                />
                <div
                    className="absolute inset-0 opacity-[0.04] pointer-events-none"
                    style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '28px 28px' }}
                />
                <div className="relative z-10 max-w-2xl mx-auto">
                    <h1 className="font-display font-800 text-4xl sm:text-5xl text-white mb-4 leading-tight">
                        Organizzi una gara?<br />
                        <span style={{
                            background: 'linear-gradient(90deg, #38bdf8, #7dd3fc)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                        }}>
                            Affidati a RunTiming.
                        </span>
                    </h1>
                    <p className="text-sky-200/80 text-base sm:text-lg mb-8 max-w-xl mx-auto leading-relaxed">
                        Gestiamo noi la parte tecnica: iscrizioni online, moduli personalizzati,
                        pagamenti e pubblicazione dei risultati. Tu ti concentri sulla gara.
                    </p>
                    <Link
                        to="/contacts"
                        className="inline-flex items-center gap-2 bg-white text-ocean-700 font-semibold px-7 py-3 rounded-xl text-sm hover:bg-sky-50 transition-colors"
                    >
                        Richiedi un preventivo gratuito <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            </section>

            {/* Steps */}
            <section className="py-20 px-4">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-12">
                        <p className="text-ocean-600 text-xs font-semibold uppercase tracking-widest mb-2">Come funziona</p>
                        <h2 className="font-display font-800 text-3xl text-slate-800">Semplice, veloce, senza pensieri</h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        {STEPS.map((step, i) => (
                            <div key={step.n} className="relative flex flex-col">
                                {/* connector */}
                                {i < STEPS.length - 1 && (
                                    <div className="hidden sm:block absolute top-10 left-full w-full h-px bg-slate-200 z-0"
                                         style={{ left: 'calc(50% + 2rem)', width: 'calc(100% - 2rem)' }} />
                                )}
                                <div
                                    className="relative z-10 bg-white border border-slate-200 rounded-2xl p-6 flex-1 hover:border-ocean-200 hover:shadow-sm transition-all"
                                    style={{ boxShadow: '2px 4px 12px 0 #f1f5f9' }}
                                >
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-12 h-12 rounded-xl bg-ocean-50 border border-ocean-100 flex items-center justify-center text-ocean-600 shrink-0">
                                            {step.icon}
                                        </div>
                                        <span className="font-display font-800 text-4xl text-slate-100 select-none leading-none">
                                            {step.n}
                                        </span>
                                    </div>
                                    <h3 className="font-semibold text-slate-800 text-sm mb-2">{step.title}</h3>
                                    <p className="text-slate-500 text-xs leading-relaxed">{step.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Options */}
            <section className="py-16 px-4 bg-white border-y border-slate-100">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-10">
                        <p className="text-ocean-600 text-xs font-semibold uppercase tracking-widest mb-2">Flessibilità</p>
                        <h2 className="font-display font-800 text-3xl text-slate-800">Scegli come lavorare con noi</h2>
                        <p className="text-slate-500 text-sm mt-2 max-w-lg mx-auto">
                            In entrambi i casi siamo noi a configurare la tua gara sulla piattaforma.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        {OPTIONS.map((opt, i) => (
                            <div
                                key={i}
                                className="bg-slate-50 border border-slate-200 rounded-2xl p-6 hover:border-ocean-200 hover:bg-ocean-50/20 transition-all"
                            >
                                <div className="w-11 h-11 rounded-xl bg-ocean-50 border border-ocean-100 flex items-center justify-center mb-4">
                                    {opt.icon}
                                </div>
                                <h3 className="font-semibold text-slate-800 text-sm mb-2">{opt.title}</h3>
                                <p className="text-slate-500 text-xs leading-relaxed mb-4">{opt.desc}</p>
                                <div className="flex flex-wrap gap-2">
                                    {opt.tags.map(tag => (
                                        <span key={tag} className="text-xs px-2.5 py-1 bg-ocean-100 text-ocean-700 rounded-full font-medium">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-20 px-4 text-center">
                <div className="max-w-md mx-auto">
                    <div className="w-14 h-14 bg-ocean-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
                        <Mail className="w-7 h-7 text-ocean-600" />
                    </div>
                    <h2 className="font-display font-800 text-2xl text-slate-800 mb-3">
                        Pronto a portare la tua gara online?
                    </h2>
                    <p className="text-slate-500 text-sm mb-7 leading-relaxed">
                        Scrivici, raccontaci la tua gara e riceverai un preventivo gratuito e senza impegno.
                    </p>
                    <Link
                        to="/contacts"
                        className="inline-flex items-center gap-2 bg-ocean-600 hover:bg-ocean-700 text-white font-semibold px-7 py-3 rounded-xl text-sm transition-colors"
                    >
                        Contattaci ora <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            </section>

        </main>
    );
}
