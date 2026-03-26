import { Link } from 'react-router-dom';

export default function HeroSection() {
    return (
        <section
            className="px-4 py-24 text-center"
            style={{ background: 'linear-gradient(160deg, #0a3c6e 0%, #0152a2 45%, #0d87ea 100%)' }}
        >
            <div className="max-w-3xl mx-auto">
                <p className="text-sky-200 text-sm font-medium tracking-widest uppercase mb-4 font-mono">
                    Cronometraggio sportivo
                </p>
                <h1 className="font-display font-900 text-5xl md:text-7xl text-white leading-tight mb-6">
                    Benvenuti su RunTiming
                </h1>
                <p className="text-sky-100 text-lg md:text-xl leading-relaxed max-w-xl mx-auto mb-10">
                    La piattaforma italiana per iscriversi alle gare, seguire i risultati live
                    e vivere ogni evento sportivo in tempo reale.
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                    <Link
                        to="/events"
                        className="bg-white text-ocean-700 hover:bg-sky-50 font-semibold px-7 py-3 rounded-xl transition-colors"
                    >
                        Esplora le gare
                    </Link>
                    <Link
                        to="/results"
                        className="border border-white/40 text-white hover:bg-white/10 font-medium px-7 py-3 rounded-xl transition-colors"
                    >
                        Vedi i risultati
                    </Link>
                </div>
            </div>
        </section>
    );
}
