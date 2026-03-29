import { useState } from 'react';
import { Search } from 'lucide-react';
import { mockEvents } from '../data/mockEvents';
import type { SportCategory } from '../types';
import EventRow from '../components/ui/EventRow';

type Tab = 'all' | 'upcoming' | 'past';

const categories: Array<{ value: SportCategory | 'all'; label: string }> = [
    { value: 'all',       label: 'Tutti' },
    { value: 'running',   label: 'Running' },
    { value: 'cycling',   label: 'Ciclismo' },
    { value: 'triathlon', label: 'Triathlon' },
    { value: 'trail',     label: 'Trail' },
    { value: 'swimming',  label: 'Nuoto' },
];

export default function EventsPage() {
    const [query, setQuery]       = useState('');
    const [category, setCategory] = useState<SportCategory | 'all'>('all');
    const [tab, setTab]           = useState<Tab>('upcoming');
    const now = new Date();

    const filtered = mockEvents.filter(e => {
        const matchesQuery    = e.title.toLowerCase().includes(query.toLowerCase()) ||
                                e.city.toLowerCase().includes(query.toLowerCase());
        const matchesCategory = category === 'all' || e.category === category;
        const matchesTab      = tab === 'all'
            ? true
            : tab === 'upcoming'
            ? new Date(e.date) >= now
            : new Date(e.date) < now;
        return matchesQuery && matchesCategory && matchesTab;
    }).sort((a, b) =>
        tab === 'past'
            ? new Date(b.date).getTime() - new Date(a.date).getTime()
            : new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return (
        <main className="min-h-screen bg-slate-50">

            {/* Page header */}
            <div
                className="py-8 px-4 text-center"
                style={{ background: 'linear-gradient(135deg, #0a3c6e 0%, #0168c8 100%)' }}
            >
                <h1 className="font-display font-800 text-3xl md:text-4xl text-white mb-1">
                    Tutti gli eventi
                </h1>
                <p className="text-sky-200 text-sm">
                    Cerca e iscriviti alle gare sportive in tutta Italia
                </p>
            </div>

            <div className="max-w-5xl mx-auto px-4 py-8">

                {/* Search + category filters */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 space-y-3"
                     style={{ boxShadow: '2px 4px 6px 0 #eeeeee' }}>
                    <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Cerca per nome o città..."
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            className="w-full border border-slate-300 focus:border-ocean-400 focus:outline-none rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 transition-colors"
                        />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {categories.map(c => (
                            <button
                                key={c.value}
                                onClick={() => setCategory(c.value)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                    category === c.value
                                        ? 'bg-ocean-600 text-white'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                {c.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Upcoming / All / Past tabs */}
                <div className="flex border-b border-slate-200 mb-6">
                    {([
                        { value: 'upcoming', label: 'Prossimi' },
                        { value: 'all',      label: 'Tutti' },
                        { value: 'past',     label: 'Passati' },
                    ] as { value: Tab; label: string }[]).map(t => (
                        <button
                            key={t.value}
                            onClick={() => setTab(t.value)}
                            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                                tab === t.value
                                    ? 'border-ocean-600 text-ocean-600'
                                    : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Results */}
                {filtered.length > 0 ? (
                    <div className="space-y-3">
                        {filtered.map(e => <EventRow key={e.id} event={e} />)}
                    </div>
                ) : (
                    <div className="text-center py-16 text-slate-400">
                        <p className="text-base">Nessun evento trovato.</p>
                        <p className="text-sm mt-1">Prova a modificare i filtri di ricerca.</p>
                    </div>
                )}

            </div>
        </main>
    );
}
