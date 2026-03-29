import { useState } from 'react';
import { Search } from 'lucide-react';
import { mockEvents } from '../../data/mockEvents';
import EventRow from '../ui/EventRow';

export default function FeaturedEvents() {
    const [query, setQuery] = useState('');
    const now = new Date();

    const filtered = mockEvents.filter(e =>
        e.title.toLowerCase().includes(query.toLowerCase()) ||
        e.city.toLowerCase().includes(query.toLowerCase())
    );

    const upcoming = filtered
        .filter(e => new Date(e.date) >= now)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const past = filtered
        .filter(e => new Date(e.date) < now)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
        <section className="py-10 px-4">
            <div className="max-w-5xl mx-auto">

                <div className="relative mb-10">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Cerca per nome o città..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        className="w-full bg-white border border-slate-300 focus:border-ocean-400 focus:outline-none rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 transition-colors"
                    />
                </div>

                <div className="mb-10">
                    <h2 className="font-display font-700 text-xl text-slate-700 uppercase tracking-wide border-b border-slate-200 pb-2 mb-4">
                        Prossimi eventi
                    </h2>
                    {upcoming.length > 0 ? (
                        <div className="space-y-3">
                            {upcoming.map(e => <EventRow key={e.id} event={e} />)}
                        </div>
                    ) : (
                        <p className="text-slate-400 text-sm py-6 text-center">Nessun evento trovato.</p>
                    )}
                </div>

                <div>
                    <h2 className="font-display font-700 text-xl text-slate-700 uppercase tracking-wide border-b border-slate-200 pb-2 mb-4">
                        Eventi passati
                    </h2>
                    {past.length > 0 ? (
                        <div className="space-y-3">
                            {past.map(e => <EventRow key={e.id} event={e} />)}
                        </div>
                    ) : (
                        <p className="text-slate-400 text-sm py-6 text-center">Nessun evento trovato.</p>
                    )}
                </div>

            </div>
        </section>
    );
}
