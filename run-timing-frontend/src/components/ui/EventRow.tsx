import { Link } from 'react-router-dom';
import { allRaces, eventStartDate } from '../../utils/event';
import { Calendar, MapPin, Users } from 'lucide-react';
import type { Event } from '../../types';
import { categoryLabels, categoryColors } from '../../data/mockEvents';
import EventCover from './EventCover';

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
}

function priceRange(event: Event): string {
    const prices = allRaces(event).map(r => r.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return min === max ? `€${min}` : `€${min} – €${max}`;
}

export default function EventRow({ event }: { event: Event }) {
    const races = allRaces(event);
    const isPast = new Date(eventStartDate(event)) < new Date();
    const hasOpenRaces = races.some(r => r.isOpen);
    const participants = races.reduce((sum, r) => sum + r.participants, 0);
    const distances = races.map(r => r.distance).filter(Boolean).join(' · ');

    return (
        <Link
            to={`/events/${event.slug}`}
            className="group flex items-center gap-4 bg-white border border-slate-200 rounded-xl p-3.5 hover:border-brand-300 hover:shadow-md transition-all"
            style={{ boxShadow: '2px 4px 6px 0 #eeeeee' }}
        >
            <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
                <EventCover
                    src={event.coverImage}
                    alt={event.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <span className="flex items-center gap-1 text-xs text-brand-600 font-medium">
                        <Calendar className="w-3 h-3" />
                        {formatDate(eventStartDate(event))}
                    </span>
                    {event.isLive && (
                        <span className="flex items-center gap-1 bg-red-50 text-red-500 text-xs font-bold px-2 py-0.5 rounded-full border border-red-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> LIVE
                        </span>
                    )}
                </div>
                <h3 className="font-display font-700 text-slate-800 text-base leading-snug group-hover:text-brand-600 transition-colors truncate">
                    {event.title}
                </h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                    <span className="flex items-center gap-1 text-slate-500 text-xs">
                        <MapPin className="w-3 h-3 text-brand-400" />
                        {event.city} ({event.province})
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${categoryColors[event.category]}`}>
                        {categoryLabels[event.category]}
                    </span>
                    {distances && <span className="text-slate-400 text-xs">{distances}</span>}
                </div>
            </div>

            <div className="flex-shrink-0 text-right flex flex-col items-end gap-1.5">
                <span className="font-display font-800 text-brand-700 text-base">{priceRange(event)}</span>
                {isPast ? (
                    <span className="text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Concluso</span>
                ) : hasOpenRaces ? (
                    <span className="text-[11px] font-semibold text-brand-700 bg-brand-50 border border-brand-200 px-2 py-0.5 rounded-full">Aperto</span>
                ) : (
                    <span className="text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Chiuso</span>
                )}
                {participants > 0 && (
                    <span className="flex items-center gap-1 text-[11px] text-slate-400">
                        <Users className="w-3 h-3" /> {participants.toLocaleString('it-IT')}
                    </span>
                )}
            </div>
        </Link>
    );
}
