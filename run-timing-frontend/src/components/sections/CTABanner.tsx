import { Link } from 'react-router-dom';
import { ArrowRight, Users } from 'lucide-react';

export default function CTABanner() {
    return (
        <section className="py-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-500 to-brand-700 p-10 md:p-16">
                    <div className="absolute inset-0 opacity-10"
                         style={{ backgroundImage: 'repeating-linear-gradient(-45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)', backgroundSize: '12px 12px' }} />
                    <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
                    <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
                        <div>
                            <div className="flex items-center gap-2 text-orange-200 text-sm font-medium mb-3">
                                <Users className="w-4 h-4" /> Unisciti a 85.000+ atleti
                            </div>
                            <h2 className="font-display font-900 text-4xl md:text-5xl text-white leading-tight mb-3">Sei un organizzatore?</h2>
                            <p className="text-orange-100 text-base max-w-md leading-relaxed">
                                Gestisci iscrizioni, cronometraggio e classifiche con un'unica piattaforma. Semplice, affidabile, scalabile.
                            </p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
                            <Link to="/organizer" className="flex items-center gap-2 bg-white text-brand-600 hover:bg-orange-50 font-semibold px-6 py-3.5 rounded-xl transition-colors">
                                Inizia gratis <ArrowRight className="w-4 h-4" />
                            </Link>
                            <Link to="/demo" className="flex items-center gap-2 border border-white/30 text-white hover:bg-white/10 font-medium px-6 py-3.5 rounded-xl transition-colors">
                                Richiedi demo
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}