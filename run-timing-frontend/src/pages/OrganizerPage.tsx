import { Link } from 'react-router-dom';
import {
    ArrowRight, CheckCircle, ClipboardList, Users, CreditCard,
    BarChart2, Lock, Zap, Mail, Settings, UserCheck, Trophy,
} from 'lucide-react';

// ─── Steps ────────────────────────────────────────────────────────────────────

const STEPS = [
    {
        n: '01',
        title: 'Richiedi l\'accesso',
        desc: 'Contatta il team RunTiming per ottenere un account organizzatore. Ti verranno fornite le credenziali personalizzate per accedere al pannello di gestione.',
        icon: <Mail className="w-6 h-6" />,
    },
    {
        n: '02',
        title: 'Configura il tuo evento',
        desc: 'Accedi al pannello e crea la tua manifestazione: aggiungi distanze, prezzi, categorie agonistiche, moduli di iscrizione e tutte le informazioni necessarie.',
        icon: <Settings className="w-6 h-6" />,
    },
    {
        n: '03',
        title: 'Gestisci gli iscritti',
        desc: 'Monitora le iscrizioni in tempo reale, valida i pagamenti, aggiungi atleti manualmente e comunica con i partecipanti.',
        icon: <UserCheck className="w-6 h-6" />,
    },
    {
        n: '04',
        title: 'Pubblica i risultati',
        desc: 'A gara conclusa, inserisci le classifiche e i tempi. Gli atleti potranno visualizzare i risultati live direttamente sulla piattaforma.',
        icon: <Trophy className="w-6 h-6" />,
    },
];

// ─── Features ─────────────────────────────────────────────────────────────────

const FEATURES = [
    {
        icon: <ClipboardList className="w-5 h-5 text-ocean-600" />,
        title: 'Form iscrizione personalizzato',
        desc: 'Scegli i campi da raccogliere: dati anagrafici, tessera federale, certificato medico, taglia maglia e altro. Il modulo viene generato automaticamente.',
    },
    {
        icon: <Users className="w-5 h-5 text-ocean-600" />,
        title: 'Categorie agonistiche',
        desc: 'Definisci categorie per sesso e fascia d\'età. Il sistema assegna automaticamente ogni atleta alla categoria corretta al momento dell\'iscrizione.',
    },
    {
        icon: <CreditCard className="w-5 h-5 text-ocean-600" />,
        title: 'Gestione quote e pagamenti',
        desc: 'Imposta scaglioni di prezzo con scadenze (Early Bird, standard, last minute). Valida manualmente i pagamenti o registra iscrizioni in contanti.',
    },
    {
        icon: <BarChart2 className="w-5 h-5 text-ocean-600" />,
        title: 'Lista iscritti pubblica',
        desc: 'Configura quali informazioni degli iscritti sono visibili al pubblico. I partecipanti possono cercare il proprio nome nella lista ufficiale.',
    },
    {
        icon: <Lock className="w-5 h-5 text-ocean-600" />,
        title: 'Accesso separato per ruolo',
        desc: 'L\'organizzatore vede e modifica solo le proprie gare. L\'amministratore della piattaforma gestisce tutto il sito in modo separato.',
    },
    {
        icon: <Zap className="w-5 h-5 text-ocean-600" />,
        title: 'Risultati in tempo reale',
        desc: 'Inserisci i tempi durante o dopo la gara. Le classifiche vengono aggiornate immediatamente e sono consultabili da tutti gli atleti.',
    },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrganizerPage() {
    return (
        <main className="bg-slate-50">

            {/* Hero */}
            <section className="relative overflow-hidden py-20 px-4 text-center"
                style={{ background: 'linear-gradient(135deg, #041e3e 0%, #0a3c6e 50%, #0168c8 100%)' }}>
                <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full opacity-10"
                     style={{ background: 'radial-gradient(circle, #38bdf8, transparent 70%)' }} />
                <div className="absolute inset-0 opacity-[0.04]"
                     style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
                <div className="relative z-10 max-w-3xl mx-auto">
                    <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-6">
                        <CheckCircle className="w-3.5 h-3.5 text-sky-400" />
                        <span className="text-sky-200 text-xs font-medium uppercase tracking-wide">Per gli organizzatori</span>
                    </div>
                    <h1 className="font-display font-800 text-4xl sm:text-5xl text-white mb-4 leading-tight">
                        Porta la tua gara<br />
                        <span style={{
                            background: 'linear-gradient(90deg, #38bdf8, #7dd3fc)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                        }}>
                            al livello successivo
                        </span>
                    </h1>
                    <p className="text-sky-200/75 text-base sm:text-lg max-w-xl mx-auto mb-8 leading-relaxed">
                        RunTiming è la piattaforma italiana che semplifica ogni aspetto della
                        gestione di eventi podistici e sportivi: iscrizioni, pagamenti, categorie e risultati.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Link to="/contacts"
                            className="inline-flex items-center justify-center gap-2 bg-white text-ocean-700 font-semibold px-6 py-3 rounded-xl text-sm hover:bg-sky-50 transition-colors">
                            Richiedi accesso <ArrowRight className="w-4 h-4" />
                        </Link>
                        <Link to="/events"
                            className="inline-flex items-center justify-center gap-2 bg-white/10 border border-white/20 text-white font-medium px-6 py-3 rounded-xl text-sm hover:bg-white/15 transition-colors">
                            Guarda gli eventi attivi
                        </Link>
                    </div>
                </div>
            </section>

            {/* Steps */}
            <section className="py-20 px-4">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-12">
                        <p className="text-ocean-600 text-xs font-semibold uppercase tracking-widest mb-2">Come funziona</p>
                        <h2 className="font-display font-800 text-3xl text-slate-800">Inizia in 4 semplici passi</h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {STEPS.map((step, i) => (
                            <div key={step.n} className="relative">
                                {/* Connector line */}
                                {i < STEPS.length - 1 && (
                                    <div className="hidden lg:block absolute top-8 left-full w-full h-px bg-slate-200 z-0" style={{ width: 'calc(100% - 2rem)', left: '4rem' }} />
                                )}
                                <div className="relative z-10 bg-white border border-slate-200 rounded-2xl p-6 h-full hover:border-ocean-200 hover:shadow-sm transition-all"
                                     style={{ boxShadow: '2px 4px 12px 0 #f1f5f9' }}>
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-12 h-12 rounded-xl bg-ocean-50 border border-ocean-100 flex items-center justify-center text-ocean-600">
                                            {step.icon}
                                        </div>
                                        <span className="font-display font-800 text-3xl text-slate-100 select-none">
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

            {/* Features grid */}
            <section className="py-16 px-4 bg-white border-y border-slate-100">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-12">
                        <p className="text-ocean-600 text-xs font-semibold uppercase tracking-widest mb-2">Funzionalità</p>
                        <h2 className="font-display font-800 text-3xl text-slate-800">Tutto quello che ti serve</h2>
                        <p className="text-slate-500 text-sm mt-2 max-w-lg mx-auto">
                            Ogni strumento è pensato per farti risparmiare tempo e offrire un'esperienza
                            professionale agli atleti.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {FEATURES.map((f, i) => (
                            <div key={i}
                                className="bg-slate-50 border border-slate-200 rounded-xl p-5 hover:border-ocean-200 hover:bg-ocean-50/30 transition-all group">
                                <div className="w-10 h-10 rounded-lg bg-ocean-50 border border-ocean-100 flex items-center justify-center mb-4 group-hover:bg-ocean-100 transition-colors">
                                    {f.icon}
                                </div>
                                <h3 className="font-semibold text-slate-800 text-sm mb-1.5">{f.title}</h3>
                                <p className="text-slate-500 text-xs leading-relaxed">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA bottom */}
            <section className="py-20 px-4 text-center bg-slate-50">
                <div className="max-w-lg mx-auto">
                    <div className="w-14 h-14 bg-ocean-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
                        <Mail className="w-7 h-7 text-ocean-600" />
                    </div>
                    <h2 className="font-display font-800 text-2xl text-slate-800 mb-3">
                        Pronto a portare la tua gara online?
                    </h2>
                    <p className="text-slate-500 text-sm mb-7 leading-relaxed">
                        Contattaci per richiedere il tuo account organizzatore.
                        L'attivazione è gratuita e veloce.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Link to="/contacts"
                            className="inline-flex items-center justify-center gap-2 bg-ocean-600 hover:bg-ocean-700 text-white font-semibold px-7 py-3 rounded-xl text-sm transition-colors">
                            Contattaci ora <ArrowRight className="w-4 h-4" />
                        </Link>
                        <Link to="/events"
                            className="inline-flex items-center justify-center gap-2 border border-slate-300 text-slate-600 hover:border-slate-400 font-medium px-7 py-3 rounded-xl text-sm transition-colors">
                            Guarda gli eventi attivi
                        </Link>
                    </div>
                </div>
            </section>

        </main>
    );
}
