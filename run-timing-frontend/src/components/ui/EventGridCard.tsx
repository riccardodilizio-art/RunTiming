import { Link } from 'react-router-dom';
import { allRaces, eventStartDate, iscrizioniAperte } from '../../utils/event';
import { Calendar, MapPin, Users } from 'lucide-react';
import type { Event } from '../../types';
import { categoryLabels, categoryColors } from '../../data/mockEvents';
import EventCover from './EventCover';

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function EventGridCard({ event }: { event: Event }) {
    const races = allRaces(event);
    const isPast = new Date(eventStartDate(event)) < new Date();
    const prices = races.map(r => r.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const hasOpenRaces = races.some(r => iscrizioniAperte(r));
    const participants = races.reduce((s, r) => s + r.participants, 0);
    const distances = races.map(r => r.distance).filter(Boolean);

    return (
        <Link
            to={`/events/${event.slug}`}
            className="group bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-brand-300 hover:shadow-lg transition-all flex flex-col"
        >
            {/* Cover */}
            <div className="relative aspect-[16/10] overflow-hidden">
                <EventCover
                    src={event.coverImage}
                    alt={event.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" />

                {/* Top badges */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full border backdrop-blur-sm ${categoryColors[event.category]}`}>
                        {categoryLabels[event.category]}
                    </span>
                    {event.isLive && (
                        <span className="flex items-center gap-1 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
                        </span>
                    )}
                </div>

                {/* Status badge */}
                <div className="absolute top-3 right-3">
                    {isPast ? (
                        <span className="text-[11px] font-medium text-white/90 bg-slate-800/60 backdrop-blur-sm px-2 py-0.5 rounded-full">Concluso</span>
                    ) : hasOpenRaces ? (
                        <span className="text-[11px] font-semibold text-white bg-brand-600/90 backdrop-blur-sm px-2 py-0.5 rounded-full">Iscrizioni aperte</span>
                    ) : (
                        <span className="text-[11px] font-medium text-white/90 bg-slate-800/60 backdrop-blur-sm px-2 py-0.5 rounded-full">Chiuso</span>
                    )}
                </div>

                {/* Date + title over image */}
                <div className="absolute bottom-0 left-0 right-0 p-3.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-white/90 mb-1">
                        <Calendar className="w-3 h-3" /> {formatDate(eventStartDate(event))}
                    </div>
                    <h3 className="font-display font-700 text-white text-[17px] leading-tight line-clamp-2 drop-shadow-sm">
                        {event.title}
                    </h3>
                </div>
            </div>

            {/* Content */}
            <div className="p-4 flex flex-col flex-1">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2.5">
                    <MapPin className="w-3.5 h-3.5 text-brand-500 flex-shrink-0" />
                    {event.city} ({event.province})
                </div>

                {distances.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                        {distances.slice(0, 3).map((d, i) => (
                            <span key={i} className="text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">{d}</span>
                        ))}
                        {distances.length > 3 && (
                            <span className="text-[11px] text-slate-400 px-1 py-0.5">+{distances.length - 3}</span>
                        )}
                    </div>
                )}

                <div className="flex items-end justify-between pt-3 mt-auto border-t border-slate-100">
                    <div>
                        <p className="font-display font-800 text-brand-700 text-lg leading-none">
                            {minPrice === maxPrice ? `€${minPrice}` : `€${minPrice}–${maxPrice}`}
                        </p>
                        <p className="text-slate-400 text-xs mt-1">{races.length} {races.length === 1 ? 'gara' : 'gare'}</p>
                    </div>
                    {participants > 0 && (
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                            <Users className="w-3.5 h-3.5" /> {participants.toLocaleString('it-IT')}
                        </span>
                    )}
                </div>
            </div>
        </Link>
    );
}
