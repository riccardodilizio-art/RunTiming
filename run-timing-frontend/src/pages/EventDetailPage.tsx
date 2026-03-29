import { useParams, Link } from 'react-router-dom';
import { Calendar, MapPin, Users, ChevronLeft, Clock, Building2 } from 'lucide-react';
import { mockEvents, categoryLabels, categoryColors } from '../data/mockEvents';

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('it-IT', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    });
}

function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('it-IT', {
        hour: '2-digit', minute: '2-digit',
    });
}

export default function EventDetailPage() {
    const { slug } = useParams<{ slug: string }>();
    const event = mockEvents.find(e => e.slug === slug);

    if (!event) {
        return (
            <main className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-slate-700 font-semibold text-xl mb-2">Evento non trovato</p>
                    <Link to="/events" className="text-ocean-600 hover:underline text-sm">
                        ← Torna agli eventi
                    </Link>
                </div>
            </main>
        );
    }

    const isPast = new Date(event.date) < new Date();
    const fillPercent = Math.round((event.participants / event.maxParticipants) * 100);
    const almostFull = fillPercent >= 85;

    return (
        <main className="min-h-screen bg-slate-50">

            {/* Cover image */}
            <div className="relative h-56 md:h-72 overflow-hidden">
                <img
                    src={event.coverImage}
                    alt={event.title}
                    className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 px-4 pb-5 max-w-5xl mx-auto">
                    <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs px-2.5 py-1 rounded border backdrop-blur-sm ${categoryColors[event.category]}`}>
                            {categoryLabels[event.category]}
                        </span>
                        {event.isLive && (
                            <span className="flex items-center gap-1 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                LIVE
                            </span>
                        )}
                        {isPast && (
                            <span className="bg-slate-600/80 text-slate-200 text-xs px-2.5 py-1 rounded backdrop-blur-sm">
                                Evento concluso
                            </span>
                        )}
                    </div>
                    <h1 className="font-display font-800 text-3xl md:text-4xl text-white leading-tight">
                        {event.title}
                    </h1>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 py-6">

                {/* Back link */}
                <Link
                    to="/events"
                    className="inline-flex items-center gap-1 text-slate-400 hover:text-ocean-600 text-sm mb-6 transition-colors"
                >
                    <ChevronLeft className="w-4 h-4" />
                    Tutti gli eventi
                </Link>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                    {/* Left: event details */}
                    <div className="md:col-span-2 space-y-4">

                        {/* Info card */}
                        <div className="bg-white border border-slate-200 rounded-xl p-5"
                             style={{ boxShadow: '2px 4px 6px 0 #eeeeee' }}>
                            <h2 className="font-display font-700 text-lg text-slate-700 uppercase tracking-wide border-b border-slate-100 pb-3 mb-4">
                                Informazioni
                            </h2>
                            <div className="space-y-3">
                                <div className="flex items-start gap-3">
                                    <Calendar className="w-4 h-4 text-ocean-500 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="text-slate-800 text-sm font-medium capitalize">
                                            {formatDate(event.date)}
                                        </p>
                                        <p className="text-slate-400 text-xs">Ore {formatTime(event.date)}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <MapPin className="w-4 h-4 text-ocean-500 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="text-slate-800 text-sm font-medium">{event.location}</p>
                                        <p className="text-slate-400 text-xs">{event.city} ({event.province})</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <Building2 className="w-4 h-4 text-ocean-500 mt-0.5 flex-shrink-0" />
                                    <p className="text-slate-800 text-sm font-medium">{event.organizer}</p>
                                </div>
                            </div>
                        </div>

                        {/* Distances card */}
                        <div className="bg-white border border-slate-200 rounded-xl p-5"
                             style={{ boxShadow: '2px 4px 6px 0 #eeeeee' }}>
                            <h2 className="font-display font-700 text-lg text-slate-700 uppercase tracking-wide border-b border-slate-100 pb-3 mb-4">
                                Distanze disponibili
                            </h2>
                            <div className="flex flex-wrap gap-2">
                                {event.distances.map(d => (
                                    <div key={d} className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                                        <Clock className="w-3.5 h-3.5 text-ocean-500" />
                                        <span className="text-slate-700 text-sm font-medium">{d}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Participants card */}
                        <div className="bg-white border border-slate-200 rounded-xl p-5"
                             style={{ boxShadow: '2px 4px 6px 0 #eeeeee' }}>
                            <h2 className="font-display font-700 text-lg text-slate-700 uppercase tracking-wide border-b border-slate-100 pb-3 mb-4">
                                Partecipanti
                            </h2>
                            <div className="flex items-center gap-3 mb-2">
                                <Users className="w-4 h-4 text-ocean-500 flex-shrink-0" />
                                <span className="text-slate-700 text-sm">
                                    <span className="font-semibold">{event.participants.toLocaleString('it-IT')}</span>
                                    <span className="text-slate-400"> / {event.maxParticipants.toLocaleString('it-IT')} posti</span>
                                </span>
                                <span className={`ml-auto text-xs font-medium ${almostFull ? 'text-red-500' : 'text-slate-400'}`}>
                                    {fillPercent}%
                                </span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all ${almostFull ? 'bg-red-400' : 'bg-ocean-500'}`}
                                    style={{ width: `${fillPercent}%` }}
                                />
                            </div>
                            {almostFull && (
                                <p className="text-red-500 text-xs mt-2">Posti in esaurimento</p>
                            )}
                        </div>

                    </div>

                    {/* Right: registration box */}
                    <div className="md:col-span-1">
                        <div className="bg-white border border-slate-200 rounded-xl p-5 sticky top-20"
                             style={{ boxShadow: '2px 4px 6px 0 #eeeeee' }}>
                            <div className="text-center mb-5">
                                <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Quota iscrizione</p>
                                <p className="font-display font-800 text-4xl text-ocean-700">€{event.price}</p>
                            </div>

                            {isPast ? (
                                <>
                                    <Link
                                        to="/results"
                                        className="block w-full text-center bg-ocean-600 hover:bg-ocean-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
                                    >
                                        Vedi i risultati
                                    </Link>
                                    <p className="text-slate-400 text-xs text-center mt-3">
                                        Le iscrizioni sono chiuse
                                    </p>
                                </>
                            ) : (
                                <>
                                    <button
                                        className="w-full bg-ocean-600 hover:bg-ocean-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
                                    >
                                        Iscriviti ora
                                    </button>
                                    <p className="text-slate-400 text-xs text-center mt-3">
                                        {event.maxParticipants - event.participants} posti ancora disponibili
                                    </p>
                                </>
                            )}

                            <div className="border-t border-slate-100 mt-5 pt-4 space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-400">Categoria</span>
                                    <span className="text-slate-700 font-medium">{categoryLabels[event.category]}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-400">Organizzatore</span>
                                    <span className="text-slate-700 font-medium text-right max-w-[120px] leading-tight">{event.organizer}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </main>
    );
}
