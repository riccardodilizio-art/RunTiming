import { Link } from 'react-router-dom';
import { Timer } from 'lucide-react';

export default function HeroSection() {
    return (
        <section className="bg-dark-900 py-20 px-4">
            <div className="max-w-6xl mx-auto text-center">
                <div className="inline-flex items-center gap-2 bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
                    <Timer className="w-3 h-3" />
                    Cronometraggio professionale
                </div>
                <h1 className="font-display font-900 text-5xl md:text-7xl text-white mb-5">
                    Benvenuti su <span className="text-brand-400">RunTiming</span>
                </h1>
                <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
                    La piattaforma italiana per iscriversi alle gare, seguire i risultati live e
                    gestire eventi sportivi con cronometraggio in tempo reale.
                </p>
                <div className="flex flex-wrap justify-center gap-3 mt-8">
                    <Link
                        to="/events"
                        className="bg-brand-500 hover:bg-brand-600 text-white font-medium px-6 py-3 rounded-xl transition-colors"
                    >
                        Esplora le gare
                    </Link>
                    <Link
                        to="/results"
                        className="border border-white/10 hover:border-white/20 text-gray-300 hover:text-white font-medium px-6 py-3 rounded-xl transition-colors"
                    >
                        Vedi i risultati
                    </Link>
                </div>
            </div>
        </section>
    );
}
