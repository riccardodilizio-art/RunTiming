import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle, ClipboardList, Users, CreditCard, BarChart2 } from 'lucide-react';

const FEATURES = [
    { icon: <ClipboardList className="w-5 h-5" />, text: 'Iscrizioni online con moduli personalizzati' },
    { icon: <Users         className="w-5 h-5" />, text: 'Categorie e gestione atleti automatizzata' },
    { icon: <CreditCard    className="w-5 h-5" />, text: 'Quote, sconti e validazione pagamenti' },
    { icon: <BarChart2     className="w-5 h-5" />, text: 'Risultati e classifiche pubblicate live' },
];

export default function OrganizerCTA() {
    return (
        <section className="relative overflow-hidden py-20 px-4"
            style={{ background: 'linear-gradient(135deg, #2b0a02 0%, #7a2510 60%, #97290e 100%)' }}
        >
            <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-10 pointer-events-none"
                 style={{ background: 'radial-gradient(circle, #fb8038, transparent 70%)' }} />
            <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
                 style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

            <div className="relative z-10 max-w-5xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

                    {/* Left */}
                    <div>
                        <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-5">
                            <CheckCircle className="w-3.5 h-3.5 text-brand-300" />
                            <span className="text-orange-200 text-xs font-medium uppercase tracking-wide">Per gli organizzatori</span>
                        </div>
                        <h2 className="font-display font-800 text-3xl sm:text-4xl text-white leading-tight mb-4">
                            Organizzi una gara?<br />
                            <span style={{
                                background: 'linear-gradient(90deg, #fb8038, #fdac74)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                            }}>
                                Pensiamo a tutto noi.
                            </span>
                        </h2>
                        <p className="text-orange-200/80 text-base leading-relaxed mb-8">
                            Richiedi un preventivo gratuito: configuriamo noi la tua gara sulla piattaforma,
                            dai moduli di iscrizione alle classifiche live.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <Link to="/organizer"
                                className="inline-flex items-center justify-center gap-2 bg-white text-brand-700 font-semibold px-6 py-3 rounded-xl text-sm hover:bg-orange-50 transition-colors">
                                Scopri come funziona <ArrowRight className="w-4 h-4" />
                            </Link>
                            <Link to="/contacts"
                                className="inline-flex items-center justify-center gap-2 bg-white/10 border border-white/20 text-white font-medium px-6 py-3 rounded-xl text-sm hover:bg-white/15 transition-colors">
                                Richiedi preventivo
                            </Link>
                        </div>
                    </div>

                    {/* Right: feature cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {FEATURES.map((f, i) => (
                            <div key={i}
                                className="bg-white/8 backdrop-blur-sm border border-white/10 rounded-xl p-4 flex items-start gap-3 hover:bg-white/12 transition-colors">
                                <div className="shrink-0 w-9 h-9 rounded-lg bg-brand-500/20 flex items-center justify-center text-brand-300">
                                    {f.icon}
                                </div>
                                <p className="text-orange-100/90 text-sm leading-snug pt-1">{f.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
