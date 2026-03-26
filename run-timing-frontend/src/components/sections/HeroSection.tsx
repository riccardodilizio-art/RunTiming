import { Link } from 'react-router-dom';
import { Search, ArrowRight, Zap } from 'lucide-react';
import { useState } from 'react';

export default function HeroSection() {
    const [query, setQuery] = useState('');

    return (
        <section className="relative min-h-screen flex items-center overflow-hidden">
            <div className="absolute inset-0 bg-dark-900" />
            <div className="absolute top-0 right-0 w-1/2 h-full opacity-10"
                 style={{ background: 'radial-gradient(ellipse at 80% 20%, #f97316 0%, transparent 60%)' }} />
            <div className="absolute bottom-0 left-0 w-96 h-96 opacity-5"
                 style={{ background: 'radial-gradient(circle, #f97316 0%, transparent 70%)' }} />
            <div className="absolute inset-0 opacity-[0.03]"
                 style={{
                     backgroundImage: `linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)`,
                     backgroundSize: '60px 60px',
                 }} />
            <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-[0.04]"
                 style={{
                     backgroundImage: 'repeating-linear-gradient(-45deg, #f97316 0, #f97316 1px, transparent 0, transparent 50%)',
                     backgroundSize: '10px 10px',
                 }} />

            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 w-full">
                <div className="max-w-3xl">
                    <div className="inline-flex items-center gap-2 bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-medium px-3 py-1.5 rounded-full mb-6 animate-fade-up opacity-0-init">
                        <Zap className="w-3 h-3" />
                        Cronometraggio professionale per ogni evento
                    </div>
                    <h1 className="font-display font-900 text-6xl sm:text-7xl lg:text-8xl leading-[0.9] text-white mb-6 animate-fade-up opacity-0-init animate-delay-100">
                        LA TUA<br /><span className="text-gradient">GARA.</span><br />IL TUO<br /><span className="text-white">TEMPO.</span>
                    </h1>
                    <p className="text-gray-400 text-lg leading-relaxed mb-10 max-w-xl animate-fade-up opacity-0-init animate-delay-200">
                        Iscriviti alle competizioni sportive più emozionanti d'Italia. Risultati live, classifiche in tempo reale e molto altro.
                    </p>
                    <div className="flex gap-3 mb-8 animate-fade-up opacity-0-init animate-delay-300">
                        <div className="flex-1 relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input
                                type="text"
                                placeholder="Cerca una gara, città o sport..."
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                className="w-full bg-dark-700 border border-white/10 focus:border-brand-500/50 text-white placeholder-gray-600 text-sm pl-11 pr-4 py-3.5 rounded-xl outline-none transition-colors"
                            />
                        </div>
                        <Link to={`/events${query ? `?q=${encodeURIComponent(query)}` : ''}`}
                              className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white font-medium px-6 py-3.5 rounded-xl transition-colors whitespace-nowrap">
                            Cerca <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                    <div className="flex flex-wrap gap-2 animate-fade-up opacity-0-init animate-delay-400">
                        <span className="text-gray-600 text-sm self-center mr-1">Popolari:</span>
                        {['Running', 'Triathlon', 'Ciclismo', 'Trail', 'Nuoto'].map(cat => (
                            <Link key={cat} to={`/events?category=${cat.toLowerCase()}`}
                                  className="text-xs text-gray-400 hover:text-white bg-dark-700 hover:bg-dark-600 border border-white/5 hover:border-brand-500/30 px-3 py-1.5 rounded-full transition-all">
                                {cat}
                            </Link>
                        ))}
                    </div>
                </div>

                <div className="absolute right-4 lg:right-8 bottom-16 hidden lg:block animate-fade-up opacity-0-init animate-delay-500">
                    <div className="bg-dark-700/80 backdrop-blur-md border border-white/10 rounded-2xl p-4 w-56">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                            <span className="text-xs text-gray-400 font-mono">3 gare in corso</span>
                        </div>
                        <div className="space-y-2">
                            {['Triathlon Rimini', 'Run Torino', 'Garda Swim'].map((name, i) => (
                                <div key={i} className="flex items-center justify-between">
                                    <span className="text-xs text-gray-300">{name}</span>
                                    <span className="text-xs font-mono text-brand-400">LIVE</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-dark-900 to-transparent" />
        </section>
    );
}