import { Link } from 'react-router-dom';
import { Calendar, MapPin } from 'lucide-react';
import type { Event } from '../../types';
import { categoryLabels, categoryColors } from '../../data/mockEvents';

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('it-IT', {
        day: '2-digit', month: 'short', year: 'numeric',
    });
}

export default function EventGridCard({ event }: { event: Event }) {
    const isPast = new Date(event.date) < new Date();
    const prices = event.races.map(r => r.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const hasOpenRaces = event.races.some(r => r.isOpen);

    return (
        <Link
            to={`/events/${event.slug}`}
            className="group bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 hover:shadow-md transition-all"
        >
            {/* Cover image */}
            <div className="relative aspect-video overflow-hidden">
                <img
                    src={event.coverImage}
                    alt={event.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    <span className={`text-xs px-2 py-0.5 rounded border backdrop-blur-sm ${categoryColors[event.category]}`}>
                        {categoryLabels[event.category]}
                    </span>
                    {event.isLive && (
                        <span className="flex items-center gap-1 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            LIVE
                        </span>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="p-4">
                <h3 className="font-semibold text-slate-800 text-sm leading-snug group-hover:text-ocean-600 transition-colors mb-2 line-clamp-2">
                    {event.title}
                </h3>
                <div className="space-y-1 mb-3">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Calendar className="w-3 h-3 text-ocean-400 flex-shrink-0" />
                        {formatDate(event.date)}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <MapPin className="w-3 h-3 text-ocean-400 flex-shrink-0" />
                        {event.city} ({event.province})
                    </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <div>
                        <span className="font-semibold text-ocean-700 text-sm">
                            {minPrice === maxPrice ? `€${minPrice}` : `€${minPrice} – €${maxPrice}`}
                        </span>
                        <span className="text-slate-400 text-xs ml-1.5">{event.races.length} gare</span>
                    </div>
                    {isPast ? (
                        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">Concluso</span>
                    ) : hasOpenRaces ? (
                        <span className="text-xs text-ocean-600 bg-ocean-50 border border-ocean-200 px-2 py-1 rounded-lg font-medium">Aperto</span>
                    ) : (
                        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">Chiuso</span>
                    )}
                </div>
            </div>
        </Link>
    );
}
