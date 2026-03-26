import { Link } from 'react-router-dom';
import { Calendar, MapPin, ArrowRight } from 'lucide-react';
import { mockEvents, categoryLabels, categoryColors } from '../../data/mockEvents';

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('it-IT', {
        day: '2-digit', month: 'long', year: 'numeric',
    });
}

export default function FeaturedEvents() {
    const upcoming = [...mockEvents]
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 5);

    return (
        <section className="py-14 px-4">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="font-display font-800 text-3xl text-white">Prossime Gare</h2>
                    <Link
                        to="/events"
                        className="flex items-center gap-1.5 text-brand-400 hover:text-brand-300 text-sm font-medium transition-colors"
                    >
                        Vedi tutte <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>

                <div className="space-y-3">
                    {upcoming.map(event => (
                        <Link
                            key={event.id}
                            to={`/events/${event.slug}`}
                            className="group flex items-center gap-4 bg-dark-800 hover:bg-dark-700 border border-white/5 hover:border-brand-500/20 rounded-xl p-4 transition-all"
                        >
                            <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                                <img
                                    src={event.coverImage}
                                    alt={event.title}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-xs px-2 py-0.5 rounded-full border ${categoryColors[event.category]}`}>
                                        {categoryLabels[event.category]}
                                    </span>
                                    {event.isLive && (
                                        <span className="flex items-center gap-1 bg-red-500/20 text-red-400 text-xs font-bold px-2 py-0.5 rounded-full border border-red-500/30">
                                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                                            LIVE
                                        </span>
                                    )}
                                </div>
                                <h3 className="font-display font-700 text-white text-lg leading-snug group-hover:text-brand-400 transition-colors">
                                    {event.title}
                                </h3>
                                <div className="flex flex-wrap gap-3 text-gray-500 text-xs mt-1">
                                    <span className="flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        {formatDate(event.date)}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <MapPin className="w-3 h-3" />
                                        {event.city} ({event.province})
                                    </span>
                                </div>
                            </div>

                            <div className="flex-shrink-0 text-right">
                                <span className="font-mono text-brand-400 font-semibold">€{event.price}</span>
                                <div className="text-gray-600 text-xs mt-1">{event.distances[0]}</div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </section>
    );
}
