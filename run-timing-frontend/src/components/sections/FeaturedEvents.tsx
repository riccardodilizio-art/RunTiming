import { Link } from 'react-router-dom';
import { Calendar, MapPin, ArrowRight } from 'lucide-react';
import { mockEvents, categoryLabels } from '../../data/mockEvents';

const categoryStyles: Record<string, string> = {
    running:   'bg-sky-100 text-sky-700 border-sky-200',
    cycling:   'bg-indigo-100 text-indigo-700 border-indigo-200',
    triathlon: 'bg-violet-100 text-violet-700 border-violet-200',
    swimming:  'bg-cyan-100 text-cyan-700 border-cyan-200',
    trail:     'bg-teal-100 text-teal-700 border-teal-200',
    other:     'bg-slate-100 text-slate-600 border-slate-200',
};

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
        <section className="bg-slate-50 py-16 px-4">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <p className="text-ocean-500 text-xs font-mono font-medium tracking-widest uppercase mb-1">
                            In programma
                        </p>
                        <h2 className="font-display font-800 text-3xl text-slate-900">
                            Prossime Gare
                        </h2>
                    </div>
                    <Link
                        to="/events"
                        className="flex items-center gap-1.5 text-ocean-600 hover:text-ocean-700 text-sm font-medium transition-colors"
                    >
                        Vedi tutte <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>

                <div className="space-y-3">
                    {upcoming.map(event => (
                        <Link
                            key={event.id}
                            to={`/events/${event.slug}`}
                            className="group flex items-center gap-4 bg-white hover:bg-ocean-50 border border-slate-200 hover:border-ocean-300 rounded-xl p-4 transition-all card-hover"
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
                                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${categoryStyles[event.category]}`}>
                                        {categoryLabels[event.category]}
                                    </span>
                                    {event.isLive && (
                                        <span className="flex items-center gap-1 bg-red-50 text-red-500 text-xs font-bold px-2 py-0.5 rounded-full border border-red-200">
                                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                            LIVE
                                        </span>
                                    )}
                                </div>
                                <h3 className="font-display font-700 text-slate-800 text-lg leading-snug group-hover:text-ocean-600 transition-colors">
                                    {event.title}
                                </h3>
                                <div className="flex flex-wrap gap-3 text-slate-400 text-xs mt-1">
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
                                <span className="font-mono text-ocean-600 font-semibold text-sm">€{event.price}</span>
                                <div className="text-slate-400 text-xs mt-1">{event.distances[0]}</div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </section>
    );
}
