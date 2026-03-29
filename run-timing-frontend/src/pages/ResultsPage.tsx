import { useState } from 'react';
import { ChevronLeft, Search, Trophy, Medal } from 'lucide-react';
import { mockEvents, categoryLabels, categoryColors } from '../data/mockEvents';
import { mockResults } from '../data/mockResults';
import type { Event } from '../types';

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('it-IT', {
        day: '2-digit', month: 'long', year: 'numeric',
    });
}

function positionStyle(pos: number): string {
    if (pos === 1) return 'text-yellow-500 font-bold';
    if (pos === 2) return 'text-slate-400 font-bold';
    if (pos === 3) return 'text-amber-600 font-bold';
    return 'text-slate-500';
}

function positionIcon(pos: number) {
    if (pos === 1) return <Trophy className="w-4 h-4 text-yellow-500" />;
    if (pos === 2) return <Medal className="w-4 h-4 text-slate-400" />;
    if (pos === 3) return <Medal className="w-4 h-4 text-amber-600" />;
    return null;
}

function rowBg(pos: number): string {
    if (pos === 1) return 'bg-yellow-50 border-l-2 border-yellow-400';
    if (pos === 2) return 'bg-slate-50 border-l-2 border-slate-300';
    if (pos === 3) return 'bg-amber-50 border-l-2 border-amber-400';
    return '';
}

const ALL_CATEGORIES = ['Tutti', 'M18-34', 'M35-49', 'M50-59', 'M60+', 'F18-34', 'F35-49', 'F50+'];

// Past events only
const pastEvents = mockEvents.filter(e => new Date(e.date) < new Date());

export default function ResultsPage() {
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [selectedRaceId, setSelectedRaceId] = useState<string | null>(null);
    const [query, setQuery]       = useState('');
    const [catFilter, setCatFilter] = useState('Tutti');

    const results = selectedRaceId ? (mockResults[selectedRaceId] ?? []) : [];

    const filtered = results.filter(r => {
        const matchesQuery = !query || r.athleteName.toLowerCase().includes(query.toLowerCase()) || r.bib.includes(query);
        const matchesCat   = catFilter === 'Tutti' || r.category === catFilter;
        return matchesQuery && matchesCat;
    });

    function selectEvent(event: Event) {
        setSelectedEvent(event);
        setSelectedRaceId(null);
        setQuery('');
        setCatFilter('Tutti');
    }

    function back() {
        if (selectedRaceId) {
            setSelectedRaceId(null);
            setQuery('');
            setCatFilter('Tutti');
        } else {
            setSelectedEvent(null);
        }
    }

    return (
        <main className="min-h-screen bg-slate-50">

            {/* Header */}
            <div className="py-8 px-4 text-center" style={{ background: 'linear-gradient(135deg, #0a3c6e 0%, #0168c8 100%)' }}>
                <h1 className="font-display font-800 text-3xl md:text-4xl text-white mb-1">Risultati</h1>
                <p className="text-sky-200 text-sm">Classifiche ufficiali degli eventi conclusi</p>
            </div>

            <div className="max-w-5xl mx-auto px-4 py-8">

                {/* Breadcrumb */}
                {selectedEvent && (
                    <button
                        onClick={back}
                        className="inline-flex items-center gap-1.5 text-slate-400 hover:text-ocean-600 text-sm mb-6 transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        {selectedRaceId ? selectedEvent.title : 'Tutti gli eventi'}
                    </button>
                )}

                {/* ── STEP 1: Event list ── */}
                {!selectedEvent && (
                    <div>
                        <h2 className="font-display font-700 text-xl text-slate-700 uppercase tracking-wide border-b border-slate-200 pb-2 mb-5">
                            Seleziona un evento
                        </h2>
                        <div className="space-y-3">
                            {pastEvents.map(event => (
                                <button
                                    key={event.id}
                                    onClick={() => selectEvent(event)}
                                    className="group w-full flex items-center gap-4 bg-white border border-slate-200 rounded-lg p-4 hover:bg-slate-50 hover:border-ocean-300 transition-all text-left"
                                    style={{ boxShadow: '2px 4px 6px 0 #eeeeee' }}
                                >
                                    <div className="w-14 h-14 rounded-md overflow-hidden flex-shrink-0">
                                        <img src={event.coverImage} alt={event.title} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-slate-800 text-sm group-hover:text-ocean-600 transition-colors">
                                            {event.title}
                                        </h3>
                                        <p className="text-slate-400 text-xs mt-0.5">
                                            {formatDate(event.date)} · {event.city} ({event.province})
                                        </p>
                                    </div>
                                    <div className="flex-shrink-0 flex items-center gap-2">
                                        <span className={`text-xs px-2 py-0.5 rounded border ${categoryColors[event.category]}`}>
                                            {categoryLabels[event.category]}
                                        </span>
                                        <span className="text-xs text-slate-400">{event.races.length} gare</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── STEP 2: Race selector ── */}
                {selectedEvent && !selectedRaceId && (
                    <div>
                        <div className="flex items-center gap-3 mb-6">
                            <img
                                src={selectedEvent.coverImage}
                                alt={selectedEvent.title}
                                className="w-12 h-12 rounded-lg object-cover"
                            />
                            <div>
                                <h2 className="font-display font-800 text-2xl text-slate-800">{selectedEvent.title}</h2>
                                <p className="text-slate-400 text-sm">{formatDate(selectedEvent.date)} · {selectedEvent.city}</p>
                            </div>
                        </div>

                        <h3 className="font-display font-700 text-base text-slate-500 uppercase tracking-wide border-b border-slate-200 pb-2 mb-4">
                            Seleziona una gara
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {selectedEvent.races.map(race => {
                                const hasResults = !!mockResults[race.id]?.length;
                                return (
                                    <button
                                        key={race.id}
                                        onClick={() => hasResults ? setSelectedRaceId(race.id) : null}
                                        disabled={!hasResults}
                                        className={`flex items-center justify-between bg-white border rounded-xl p-4 text-left transition-all ${
                                            hasResults
                                                ? 'border-slate-200 hover:border-ocean-300 hover:bg-slate-50 cursor-pointer'
                                                : 'border-slate-100 opacity-50 cursor-not-allowed'
                                        }`}
                                        style={{ boxShadow: '2px 4px 6px 0 #eeeeee' }}
                                    >
                                        <div>
                                            <p className="font-semibold text-slate-800 text-sm">{race.name}</p>
                                            <p className="text-slate-400 text-xs mt-0.5">{race.distance} · {race.participants} iscritti</p>
                                        </div>
                                        {hasResults ? (
                                            <span className="text-xs bg-ocean-50 text-ocean-600 border border-ocean-200 px-2 py-1 rounded-lg font-medium">
                                                Vedi classifica
                                            </span>
                                        ) : (
                                            <span className="text-xs bg-slate-100 text-slate-400 px-2 py-1 rounded-lg">
                                                Non disponibile
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ── STEP 3: Results table ── */}
                {selectedEvent && selectedRaceId && (() => {
                    const race = selectedEvent.races.find(r => r.id === selectedRaceId)!;
                    return (
                        <div>
                            {/* Race header */}
                            <div className="flex items-start justify-between gap-4 mb-6">
                                <div>
                                    <h2 className="font-display font-800 text-2xl text-slate-800">{race.name}</h2>
                                    <p className="text-slate-400 text-sm">{selectedEvent.title} · {formatDate(selectedEvent.date)}</p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <p className="text-xs text-slate-400">Classificati</p>
                                    <p className="font-display font-700 text-2xl text-ocean-700">{results.length}</p>
                                </div>
                            </div>

                            {/* Search + category filter */}
                            <div className="flex flex-wrap gap-2 mb-4">
                                <div className="relative flex-1 min-w-[200px]">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Cerca atleta o pettorale..."
                                        value={query}
                                        onChange={e => setQuery(e.target.value)}
                                        className="w-full bg-white border border-slate-300 focus:border-ocean-400 focus:outline-none rounded-lg pl-9 pr-4 py-2 text-sm text-slate-700 placeholder-slate-400 transition-colors"
                                    />
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {ALL_CATEGORIES.map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => setCatFilter(cat)}
                                            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                                catFilter === cat
                                                    ? 'bg-ocean-600 text-white'
                                                    : 'bg-white border border-slate-200 text-slate-600 hover:border-ocean-300'
                                            }`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Results count */}
                            <p className="text-xs text-slate-400 mb-3">
                                {filtered.length} {filtered.length === 1 ? 'atleta' : 'atleti'}
                                {catFilter !== 'Tutti' ? ` in categoria ${catFilter}` : ''}
                            </p>

                            {/* Table */}
                            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden"
                                 style={{ boxShadow: '2px 4px 6px 0 #eeeeee' }}>
                                {/* Header */}
                                <div className="grid grid-cols-[40px_56px_1fr_80px_80px_70px] gap-3 px-4 py-2.5 border-b border-slate-100 bg-slate-50">
                                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide text-center">#</span>
                                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Pet.</span>
                                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Atleta</span>
                                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide hidden sm:block">Cat.</span>
                                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide text-right">Tempo</span>
                                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide text-right hidden sm:block">Distacco</span>
                                </div>

                                {filtered.length > 0 ? (
                                    <div className="divide-y divide-slate-100">
                                        {filtered.map(r => (
                                            <div
                                                key={r.bib}
                                                className={`grid grid-cols-[40px_56px_1fr_80px_80px_70px] gap-3 px-4 py-3 items-center hover:bg-slate-50 transition-colors ${rowBg(r.position)}`}
                                            >
                                                <div className={`flex items-center justify-center gap-1 text-sm ${positionStyle(r.position)}`}>
                                                    {positionIcon(r.position) ?? r.position}
                                                </div>
                                                <span className="text-slate-500 text-xs font-mono">{r.bib}</span>
                                                <span className="text-slate-800 text-sm font-medium truncate">{r.athleteName}</span>
                                                <span className="text-slate-400 text-xs hidden sm:block">{r.category}</span>
                                                <span className="text-slate-800 text-sm font-mono font-semibold text-right">{r.time}</span>
                                                <span className="text-slate-400 text-xs font-mono text-right hidden sm:block">
                                                    {r.gap ?? '—'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12 text-slate-400">
                                        <p className="text-sm">Nessun atleta trovato.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })()}

            </div>
        </main>
    );
}
