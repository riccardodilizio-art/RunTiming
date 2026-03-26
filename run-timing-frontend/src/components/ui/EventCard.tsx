import { Link } from 'react-router-dom';
import { Calendar, MapPin, Users, Zap } from 'lucide-react';
import type { Event } from '../../types';
import { categoryLabels, categoryColors } from '../../data/mockEvents';

interface EventCardProps {
    event: Event;
    featured?: boolean;
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('it-IT', {
        day: '2-digit', month: 'short', year: 'numeric',
    });
}

export default function EventCard({ event, featured = false }: EventCardProps) {
    const fillPercent = Math.round((event.participants / event.maxParticipants) * 100);
    const almostFull = fillPercent >= 85;

    if (featured) {
        return (
            <Link to={`/events/${event.slug}`} className="group relative overflow-hidden rounded-2xl block card-hover">
                <div className="aspect-[16/9] overflow-hidden">
                    <img src={event.coverImage} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-dark-900 via-dark-900/40 to-transparent" />
                {event.isLive && (
                    <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        LIVE
                    </div>
                )}
                <div className={`absolute top-4 right-4 text-xs font-medium px-2.5 py-1 rounded-full border backdrop-blur-sm ${categoryColors[event.category]}`}>
                    {categoryLabels[event.category]}
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-5">
                    <h3 className="font-display font-700 text-2xl text-white mb-2 leading-tight group-hover:text-brand-400 transition-colors">
                        {event.title}
                    </h3>
                    <div className="flex flex-wrap gap-3 text-gray-300 text-sm mb-3">
                        <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-brand-400" />{formatDate(event.date)}</span>
                        <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-brand-400" />{event.city} ({event.province})</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${almostFull ? 'bg-red-400' : 'bg-brand-500'}`} style={{ width: `${fillPercent}%` }} />
                        </div>
                        <span className={`text-xs font-mono ${almostFull ? 'text-red-400' : 'text-gray-400'}`}>
              {event.participants}/{event.maxParticipants}
            </span>
                    </div>
                </div>
            </Link>
        );
    }

    return (
        <Link to={`/events/${event.slug}`} className="group flex gap-4 bg-dark-700 hover:bg-dark-600 border border-white/5 hover:border-brand-500/30 rounded-xl p-4 transition-all duration-200 card-hover">
            <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
                <img src={event.coverImage} alt={event.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-display font-700 text-base text-white leading-snug group-hover:text-brand-400 transition-colors truncate">{event.title}</h3>
                    {event.isLive && (
                        <span className="flex-shrink-0 flex items-center gap-1 bg-red-500/20 text-red-400 text-xs font-bold px-2 py-0.5 rounded-full border border-red-500/30">
              <Zap className="w-3 h-3" /> LIVE
            </span>
                    )}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-gray-500 text-xs mb-2">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(event.date)}</span>
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{event.city}</span>
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />{event.participants.toLocaleString('it-IT')}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${categoryColors[event.category]}`}>{categoryLabels[event.category]}</span>
                    {event.distances.map(d => (
                        <span key={d} className="text-xs text-gray-600 bg-dark-500 px-2 py-0.5 rounded-full">{d}</span>
                    ))}
                </div>
            </div>
            <div className="flex-shrink-0 text-right">
                <span className="font-mono text-brand-400 font-medium text-sm">€{event.price}</span>
            </div>
        </Link>
    );
}