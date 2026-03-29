import { useParams, Link } from 'react-router-dom';
import { Calendar, MapPin, ChevronLeft, Clock, Building2, ShieldCheck, Users } from 'lucide-react';
import type { Race } from '../types';
import { mockEvents, categoryLabels, categoryColors } from '../data/mockEvents';

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('it-IT', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    });
}

function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

function ageLabel(race: Race): string {
    if (race.minAge !== undefined && race.maxAge !== undefined) {
        return `${race.minAge} – ${race.maxAge} anni`;
    }
    if (race.minAge !== undefined) return `${race.minAge}+ anni`;
    if (race.maxAge !== undefined) return `fino a ${race.maxAge} anni`;
    return 'Tutti';
}

export default function EventDetailPage() {
    const { slug } = useParams<{ slug: string }>();
    const event = mockEvents.find(e => e.slug === slug);

    if (!event) {
        return (
            <main className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-slate-700 font-semibold text-xl mb-2">Evento non trovato</p>
                    <Link to="/events" className="text-ocean-600 hover:underline text-sm">← Torna agli eventi</Link>
                </div>
            </main>
        );
    }

    const isPast = new Date(event.date) < new Date();
    const totalParticipants = event.races.reduce((s, r) => s + r.participants, 0);
    const totalMax = event.races.reduce((s, r) => s + r.maxParticipants, 0);
    const fillPercent = Math.round((totalParticipants / totalMax) * 100);
    const openRaces = event.races.filter(r => r.isOpen);

    return (
        <main className="min-h-screen bg-slate-50">

            {/* Cover */}
            <div className="relative h-56 md:h-72 overflow-hidden">
                <img src={event.coverImage} alt={event.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 px-4 pb-5">
                    <div className="max-w-5xl mx-auto">
                        <div className="flex items-center gap-2 mb-2">
                            <span className={`text-xs px-2.5 py-1 rounded border backdrop-blur-sm ${categoryColors[event.category]}`}>
                                {categoryLabels[event.category]}
                            </span>
                            {event.isLive && (
                                <span className="flex items-center gap-1 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
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
            </div>

            <div className="max-w-5xl mx-auto px-4 py-6">

                <Link to="/events" className="inline-flex items-center gap-1 text-slate-400 hover:text-ocean-600 text-sm mb-6 transition-colors">
                    <ChevronLeft className="w-4 h-4" /> Tutti gli eventi
                </Link>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                    {/* Left */}
                    <div className="md:col-span-2 space-y-5">

                        {/* Info */}
                        <div className="bg-white border border-slate-200 rounded-xl p-5" style={{ boxShadow: '2px 4px 6px 0 #eeeeee' }}>
                            <h2 className="font-display font-700 text-base text-slate-500 uppercase tracking-wide border-b border-slate-100 pb-3 mb-4">
                                Informazioni
                            </h2>
                            <div className="space-y-3">
                                <div className="flex items-start gap-3">
                                    <Calendar className="w-4 h-4 text-ocean-500 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="text-slate-800 text-sm font-medium capitalize">{formatDate(event.date)}</p>
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

                        {/* Races table */}
                        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden" style={{ boxShadow: '2px 4px 6px 0 #eeeeee' }}>
                            <div className="px-5 py-4 border-b border-slate-100">
                                <h2 className="font-display font-700 text-base text-slate-500 uppercase tracking-wide">
                                    Gare disponibili
                                </h2>
                            </div>

                            <div className="divide-y divide-slate-100">
                                {event.races.map(race => {
                                    const raceFill = Math.round((race.participants / race.maxParticipants) * 100);
                                    const raceAlmostFull = raceFill >= 85;
                                    return (
                                        <div key={race.id} className={`p-5 ${!race.isOpen ? 'opacity-60' : ''}`}>
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                        <h3 className="font-semibold text-slate-800 text-sm">{race.name}</h3>
                                                        <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                                                            <Clock className="w-3 h-3" /> {race.distance}
                                                        </span>
                                                        {!race.isOpen && (
                                                            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200">
                                                                Iscrizioni chiuse
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Requirements */}
                                                    <div className="flex flex-wrap gap-2 mb-3">
                                                        <span className="flex items-center gap-1 text-xs text-slate-500">
                                                            <Users className="w-3 h-3 text-ocean-400" />
                                                            {ageLabel(race)}
                                                        </span>
                                                        {race.requiresMedicalCert ? (
                                                            <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                                                                <ShieldCheck className="w-3 h-3" /> Cert. agonistico richiesto
                                                            </span>
                                                        ) : (
                                                            <span className="flex items-center gap-1 text-xs text-teal-600 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded">
                                                                <ShieldCheck className="w-3 h-3" /> Nessun certificato
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Participants bar */}
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-[160px]">
                                                            <div
                                                                className={`h-full rounded-full ${raceAlmostFull ? 'bg-red-400' : 'bg-ocean-400'}`}
                                                                style={{ width: `${raceFill}%` }}
                                                            />
                                                        </div>
                                                        <span className={`text-xs ${raceAlmostFull ? 'text-red-500' : 'text-slate-400'}`}>
                                                            {race.participants}/{race.maxParticipants} posti
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Price + CTA */}
                                                <div className="flex-shrink-0 text-right">
                                                    <p className="font-bold text-ocean-700 text-lg">€{race.price}</p>
                                                    {!isPast && race.isOpen && (
                                                        <button className="mt-2 bg-ocean-600 hover:bg-ocean-700 text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors">
                                                            Iscriviti
                                                        </button>
                                                    )}
                                                    {isPast && (
                                                        <Link to="/results" className="mt-2 inline-block text-ocean-600 hover:underline text-xs">
                                                            Risultati
                                                        </Link>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                    </div>

                    {/* Right: summary box */}
                    <div className="md:col-span-1">
                        <div className="bg-white border border-slate-200 rounded-xl p-5 sticky top-20" style={{ boxShadow: '2px 4px 6px 0 #eeeeee' }}>

                            <div className="text-center mb-4 pb-4 border-b border-slate-100">
                                <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Quote da</p>
                                <p className="font-display font-800 text-4xl text-ocean-700">
                                    €{Math.min(...event.races.map(r => r.price))}
                                </p>
                                <p className="text-slate-400 text-xs mt-1">{event.races.length} gare disponibili</p>
                            </div>

                            {!isPast && openRaces.length > 0 ? (
                                <p className="text-center text-sm text-slate-500 mb-4">
                                    Scegli una gara e iscriviti
                                </p>
                            ) : isPast ? (
                                <Link
                                    to="/results"
                                    className="block w-full text-center bg-ocean-600 hover:bg-ocean-700 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm mb-4"
                                >
                                    Vedi i risultati
                                </Link>
                            ) : (
                                <p className="text-center text-sm text-slate-400 mb-4">Iscrizioni non ancora aperte</p>
                            )}

                            {/* Totals */}
                            <div className="space-y-3">
                                <div>
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="text-slate-400">Iscritti totali</span>
                                        <span className="text-slate-600 font-medium">
                                            {totalParticipants.toLocaleString('it-IT')} / {totalMax.toLocaleString('it-IT')}
                                        </span>
                                    </div>
                                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full ${fillPercent >= 85 ? 'bg-red-400' : 'bg-ocean-400'}`}
                                            style={{ width: `${fillPercent}%` }}
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-400">Organizzatore</span>
                                    <span className="text-slate-600 font-medium text-right max-w-[120px] leading-tight">{event.organizer}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-400">Categoria</span>
                                    <span className="text-slate-600 font-medium">{categoryLabels[event.category]}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </main>
    );
}
