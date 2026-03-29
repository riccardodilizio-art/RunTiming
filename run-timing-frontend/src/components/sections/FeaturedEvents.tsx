import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, Search } from 'lucide-react';
import { mockEvents, categoryLabels, categoryColors } from '../../data/mockEvents';

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('it-IT', {
        day: '2-digit', month: 'short', year: 'numeric',
    });
}

function EventRow({ event }: { event: (typeof mockEvents)[number] }) {
    return (
        <Link
            to={`/events/${event.slug}`}
            className="group flex items-center gap-4 bg-white border border-slate-200 rounded-lg p-4 hover:bg-slate-50 hover:border-slate-300 transition-colors"
            style={{ boxShadow: '2px 4px 6px 0 #eeeeee' }}
        >
            <div className="w-16 h-16 rounded-md overflow-hidden flex-shrink-0 bg-slate-100">
                <img
                    src={event.coverImage}
                    alt={event.title}
                    className="w-full h-full object-cover"
                />
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <span className="flex items-center gap-1 text-xs text-ocean-600 font-medium">
                        <Calendar className="w-3 h-3" />
                        {formatDate(event.date)}
                    </span>
                    {event.isLive && (
                        <span className="flex items-center gap-1 bg-red-50 text-red-500 text-xs font-bold px-2 py-0.5 rounded-full border border-red-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                            LIVE
                        </span>
                    )}
                </div>
                <h3 className="font-semibold text-slate-800 text-base leading-snug group-hover:text-ocean-600 transition-colors truncate">
                    {event.title}
                </h3>
                <div className="flex flex-wrap items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-slate-400 text-xs">
                        <MapPin className="w-3 h-3" />
                        {event.city} ({event.province})
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded border ${categoryColors[event.category]}`}>
                        {categoryLabels[event.category]}
                    </span>
                    <span className="text-slate-400 text-xs">{event.distances.join(' · ')}</span>
                </div>
            </div>

            <div className="flex-shrink-0 text-right">
                <span className="font-semibold text-ocean-700 text-sm">€{event.price}</span>
                <div className="text-slate-400 text-xs mt-0.5">
                    {event.participants.toLocaleString('it-IT')} iscritti
                </div>
            </div>
        </Link>
    );
}

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

                {/* Search bar */}
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

                {/* Upcoming events */}
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

                {/* Past events */}
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
