import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowRight, Timer, Trophy, MapPin, Zap } from 'lucide-react';

const STATS = [
    { icon: <Trophy className="w-4 h-4" />, value: '80+',    label: 'Gare nel 2025' },
    { icon: <Timer   className="w-4 h-4" />, value: '2.500+', label: 'Atleti iscritti' },
    { icon: <MapPin  className="w-4 h-4" />, value: '12',     label: 'Regioni coperte' },
    { icon: <Zap     className="w-4 h-4" />, value: '100%',   label: 'Risultati live' },
];

export default function HeroSection() {
    const [query, setQuery] = useState('');
    const navigate = useNavigate();

    function handleSearch(e: React.FormEvent) {
        e.preventDefault();
        navigate(query.trim() ? `/events?q=${encodeURIComponent(query.trim())}` : '/events');
    }

    return (
        <section className="relative overflow-hidden min-h-[82vh] flex flex-col justify-center"
            style={{ background: 'linear-gradient(135deg, #041e3e 0%, #0a3c6e 45%, #0168c8 100%)' }}
        >
            {/* ── Decorative blobs ── */}
            <div className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full"
                 style={{ background: 'radial-gradient(circle, rgba(1,104,200,0.35) 0%, transparent 70%)' }} />
            <div className="absolute -bottom-24 -left-24 w-[380px] h-[380px] rounded-full"
                 style={{ background: 'radial-gradient(circle, rgba(56,189,248,0.18) 0%, transparent 70%)' }} />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full opacity-5 border border-white" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full opacity-[0.03] border border-white" />

            {/* ── Subtle dot grid ── */}
            <div className="absolute inset-0 opacity-[0.06]"
                 style={{
                     backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
                     backgroundSize: '28px 28px',
                 }} />

            {/* ── Content ── */}
            <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-20 text-center">

                {/* Eyebrow */}
                <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-7">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                    <span className="text-sky-200 text-xs font-medium tracking-wide uppercase">
                        La piattaforma italiana del timing sportivo
                    </span>
                </div>

                {/* Headline */}
                <h1 className="font-display font-800 text-5xl sm:text-6xl md:text-7xl text-white leading-none mb-5 tracking-tight">
                    Corri.{' '}
                    <span style={{
                        background: 'linear-gradient(90deg, #38bdf8, #7dd3fc)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                    }}>
                        Gareggia.
                    </span>
                    <br />
                    Vinci.
                </h1>

                {/* Subtitle */}
                <p className="text-sky-200/80 text-base sm:text-lg max-w-xl mx-auto mb-10 leading-relaxed">
                    Iscriviti alle gare, segui i risultati in tempo reale e gestisci
                    ogni aspetto del tuo evento sportivo in un'unica piattaforma.
                </p>

                {/* Search bar */}
                <form onSubmit={handleSearch} className="relative max-w-xl mx-auto mb-10">
                    <div className="flex items-center bg-white rounded-2xl shadow-2xl overflow-hidden border-2 border-transparent focus-within:border-sky-400 transition-all">
                        <Search className="w-5 h-5 text-slate-400 ml-4 shrink-0" />
                        <input
                            type="text"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Cerca per nome, città o tipo di gara…"
                            className="flex-1 py-4 px-3 text-slate-700 placeholder-slate-400 text-sm bg-transparent focus:outline-none"
                        />
                        <button
                            type="submit"
                            className="m-1.5 px-5 py-2.5 bg-ocean-600 hover:bg-ocean-700 text-white text-sm font-semibold rounded-xl flex items-center gap-1.5 transition-colors shrink-0"
                        >
                            Cerca <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </form>

                {/* Stats row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto">
                    {STATS.map(s => (
                        <div key={s.label}
                             className="bg-white/8 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 text-center hover:bg-white/12 transition-colors">
                            <div className="flex items-center justify-center gap-1.5 text-sky-400 mb-1">
                                {s.icon}
                            </div>
                            <div className="font-display font-800 text-2xl text-white leading-none mb-0.5">{s.value}</div>
                            <div className="text-sky-300/70 text-xs">{s.label}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Bottom fade ── */}
            <div className="absolute bottom-0 left-0 right-0 h-16"
                 style={{ background: 'linear-gradient(to bottom, transparent, rgba(248,250,252,0.08))' }} />
        </section>
    );
}
