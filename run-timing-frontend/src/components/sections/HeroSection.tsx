import { useNavigate } from 'react-router-dom';
import { Search, ArrowRight } from 'lucide-react';
import { useState } from 'react';

// 5 sport photos pulled from the same Unsplash source already used in the app
const HERO_PHOTOS = [
    {
        src: 'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=400&h=280&fit=crop&q=80',
        alt: 'Triathlon',
    },
    {
        src: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=320&fit=crop&q=80',
        alt: 'Trail running',
    },
    {
        src: 'https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?w=400&h=360&fit=crop&q=80',
        alt: 'Road running',
    },
    {
        src: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=400&h=320&fit=crop&q=80',
        alt: 'Ciclismo',
    },
    {
        src: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=400&h=280&fit=crop&q=80',
        alt: 'Running',
    },
];

// Heights: outer photos shorter, center tallest — creates the ENDU fan effect
const PHOTO_HEIGHTS = [200, 240, 280, 240, 200];

export default function HeroSection() {
    const [query, setQuery] = useState('');
    const navigate = useNavigate();

    function handleSearch(e: React.FormEvent) {
        e.preventDefault();
        navigate(query.trim() ? `/events?q=${encodeURIComponent(query.trim())}` : '/events');
    }

    return (
        <section
            className="relative overflow-hidden"
            style={{ background: '#0a3c6e' }}
        >
            {/* ── White arch ────────────────────────────────────────────────── */}
            {/*  Positioned above the photos; its curved bottom edge frames them */}
            <div
                className="absolute bg-slate-50 pointer-events-none"
                style={{
                    top: '-8%',
                    left: '-20%',
                    width: '140%',
                    height: '68%',
                    borderRadius: '0 0 50% 50% / 0 0 38% 38%',
                }}
            />

            {/* ── Photos row ────────────────────────────────────────────────── */}
            <div className="relative z-10 flex justify-center items-end gap-3 sm:gap-4 px-4 pt-10 sm:pt-14">
                {HERO_PHOTOS.map((photo, i) => (
                    <div
                        key={photo.alt}
                        className="flex-shrink-0 rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl"
                        style={{
                            width: 'clamp(80px, 16vw, 220px)',
                            height: `clamp(${PHOTO_HEIGHTS[i] * 0.6}px, ${PHOTO_HEIGHTS[i] / 3.5}vw, ${PHOTO_HEIGHTS[i]}px)`,
                        }}
                    >
                        <img
                            src={photo.src}
                            alt={photo.alt}
                            className="w-full h-full object-cover"
                            loading="eager"
                        />
                    </div>
                ))}
            </div>

            {/* ── Text + search ─────────────────────────────────────────────── */}
            <div className="relative z-10 text-center px-4 pt-10 pb-16">
                <h1 className="font-display font-800 text-3xl sm:text-4xl md:text-5xl text-white mb-3 leading-tight tracking-tight uppercase">
                    La tua prossima gara<br className="hidden sm:block" /> ti aspetta
                </h1>
                <p className="text-sky-200/80 text-sm sm:text-base mb-8 max-w-md mx-auto">
                    Iscriviti, segui i risultati live e gestisci la tua manifestazione sportiva in un'unica piattaforma italiana.
                </p>

                {/* Search */}
                <form onSubmit={handleSearch} className="flex items-center max-w-lg mx-auto mb-6 bg-white rounded-full shadow-2xl overflow-hidden border-2 border-transparent focus-within:border-sky-300 transition-all">
                    <Search className="w-5 h-5 text-slate-400 ml-4 shrink-0" />
                    <input
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Cerca per nome, città o sport…"
                        className="flex-1 py-3.5 px-3 text-slate-700 placeholder-slate-400 text-sm bg-transparent focus:outline-none"
                    />
                    <button
                        type="submit"
                        className="m-1.5 px-5 py-2.5 bg-ocean-600 hover:bg-ocean-700 text-white text-sm font-semibold rounded-full flex items-center gap-1.5 transition-colors shrink-0"
                    >
                        Cerca <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                </form>
            </div>
        </section>
    );
}
