import { useParams, Link } from 'react-router-dom';
import {
    Calendar, MapPin, ChevronLeft, Clock, Building2, ShieldCheck, Users,
    TrendingUp, Mountain, Download, Layers,
} from 'lucide-react';
import type { Race, ElevationPoint } from '../types';
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

// ─── Elevation chart ─────────────────────────────────────────────────────────

function ElevationChart({ profile }: { profile: ElevationPoint[] }) {
    const W = 600;
    const H = 110;
    const padL = 34, padR = 10, padT = 8, padB = 22;

    const minElev = Math.min(...profile.map(p => p.elev));
    const maxElev = Math.max(...profile.map(p => p.elev));
    const elevRange = Math.max(maxElev - minElev, 30);
    const maxKm = profile[profile.length - 1].km;

    const toX = (km: number) => padL + (km / maxKm) * (W - padL - padR);
    const toY = (elev: number) => H - padB - ((elev - minElev) / elevRange) * (H - padT - padB);

    // Smooth bezier path
    const pts = profile.map(p => ({ x: toX(p.km), y: toY(p.elev) }));
    let linePath = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
        const prev = pts[i - 1];
        const curr = pts[i];
        const cpX = (prev.x + curr.x) / 2;
        linePath += ` C ${cpX} ${prev.y} ${cpX} ${curr.y} ${curr.x} ${curr.y}`;
    }
    const areaPath = `${linePath} L ${pts[pts.length - 1].x} ${H - padB} L ${pts[0].x} ${H - padB} Z`;

    // KM axis ticks
    const step = maxKm <= 5 ? 1 : maxKm <= 15 ? 3 : maxKm <= 50 ? 10 : maxKm <= 100 ? 20 : 30;
    const kmTicks: number[] = [];
    for (let km = 0; km <= maxKm; km += step) kmTicks.push(km);
    if (kmTicks[kmTicks.length - 1] !== maxKm) kmTicks.push(maxKm);

    // Elev axis ticks
    const elevStep = elevRange <= 30 ? 10 : elevRange <= 100 ? 25 : elevRange <= 300 ? 50 : elevRange <= 1000 ? 200 : 500;
    const elevTicks: number[] = [];
    const startElev = Math.ceil(minElev / elevStep) * elevStep;
    for (let e = startElev; e <= maxElev; e += elevStep) elevTicks.push(e);

    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: '110px' }}>
            <defs>
                <linearGradient id="elev-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0168c8" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#0168c8" stopOpacity="0.02" />
                </linearGradient>
            </defs>

            {/* Elev grid lines */}
            {elevTicks.map(e => (
                <g key={e}>
                    <line x1={padL} y1={toY(e)} x2={W - padR} y2={toY(e)}
                          stroke="#e2e8f0" strokeWidth="0.6" strokeDasharray="3 3" />
                    <text x={padL - 4} y={toY(e) + 3.5} textAnchor="end"
                          fontSize="7.5" fill="#94a3b8">{e}m</text>
                </g>
            ))}

            {/* Baseline */}
            <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB}
                  stroke="#cbd5e1" strokeWidth="1" />

            {/* Area fill */}
            <path d={areaPath} fill="url(#elev-fill)" />

            {/* Profile line */}
            <path d={linePath} fill="none" stroke="#0168c8" strokeWidth="2.2"
                  strokeLinecap="round" strokeLinejoin="round" />

            {/* KM axis labels */}
            {kmTicks.map(km => (
                <g key={km}>
                    <line x1={toX(km)} y1={H - padB} x2={toX(km)} y2={H - padB + 3}
                          stroke="#cbd5e1" strokeWidth="1" />
                    <text x={toX(km)} y={H - 4} textAnchor="middle"
                          fontSize="7.5" fill="#94a3b8">{km}km</text>
                </g>
            ))}
        </svg>
    );
}

// ─── Download regulation helper ───────────────────────────────────────────────

function downloadRegulation(title: string, slug: string, date: string) {
    const lines = [
        `REGOLAMENTO UFFICIALE`,
        ``,
        `Evento: ${title}`,
        `Data: ${new Date(date).toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}`,
        ``,
        `ART. 1 – ORGANIZZAZIONE`,
        `La manifestazione è organizzata nel rispetto delle norme vigenti.`,
        ``,
        `ART. 2 – PARTECIPANTI`,
        `Possono partecipare tutti gli atleti regolarmente tesserati.`,
        ``,
        `ART. 3 – ISCRIZIONI`,
        `Le iscrizioni si effettuano tramite il portale RunTiming entro i termini indicati.`,
        ``,
        `ART. 4 – PREMIAZIONI`,
        `Saranno premiati i primi tre classificati assoluti e per categoria.`,
        ``,
        `ART. 5 – RITIRO PACCO GARA`,
        `Il pacco gara può essere ritirato il giorno prima e la mattina dell'evento.`,
        ``,
        `Documento generato da RunTiming — ${new Date().toLocaleDateString('it-IT')}`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `regolamento-${slug}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

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

    // OSM embed URL — bbox: west,south,east,north
    const delta = 0.018;
    const osmSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${event.lng - delta},${event.lat - delta},${event.lng + delta},${event.lat + delta}&layer=mapnik&marker=${event.lat},${event.lng}`;

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

                                                <div className="flex-shrink-0 text-right">
                                                    <p className="font-bold text-ocean-700 text-lg">€{race.price}</p>
                                                    {!isPast && race.isOpen && (
                                                        <Link
                                                            to={`/events/${event.slug}/register?race=${race.id}`}
                                                            className="mt-2 inline-block bg-ocean-600 hover:bg-ocean-700 text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors"
                                                        >
                                                            Iscriviti
                                                        </Link>
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

                        {/* ── Percorso ── */}
                        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden" style={{ boxShadow: '2px 4px 6px 0 #eeeeee' }}>
                            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                                <h2 className="font-display font-700 text-base text-slate-500 uppercase tracking-wide">
                                    Percorso &amp; Sede
                                </h2>
                                <button
                                    onClick={() => downloadRegulation(event.title, event.slug, event.date)}
                                    className="flex items-center gap-1.5 text-xs text-ocean-600 hover:text-ocean-700 border border-ocean-200 hover:bg-ocean-50 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    Scarica regolamento
                                </button>
                            </div>

                            <div className="p-5">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">

                                    {/* OSM mini map */}
                                    <div className="rounded-xl overflow-hidden border border-slate-100">
                                        <iframe
                                            title={`Mappa ${event.title}`}
                                            src={osmSrc}
                                            className="w-full border-0"
                                            style={{ height: '200px' }}
                                            loading="lazy"
                                        />
                                    </div>

                                    {/* Route stats */}
                                    <div className="flex flex-col justify-between">
                                        {event.routeInfo ? (
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                                    <div className="flex items-center gap-1.5 mb-1">
                                                        <TrendingUp className="w-3.5 h-3.5 text-ocean-500" />
                                                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Dislivello +</p>
                                                    </div>
                                                    <p className="font-display font-700 text-lg text-slate-800">
                                                        +{event.routeInfo.elevationGainM.toLocaleString('it-IT')} m
                                                    </p>
                                                </div>
                                                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                                    <div className="flex items-center gap-1.5 mb-1">
                                                        <Mountain className="w-3.5 h-3.5 text-ocean-500" />
                                                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Quota max</p>
                                                    </div>
                                                    <p className="font-display font-700 text-lg text-slate-800">
                                                        {event.routeInfo.maxElevationM.toLocaleString('it-IT')} m
                                                    </p>
                                                </div>
                                                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                                    <div className="flex items-center gap-1.5 mb-1">
                                                        <Mountain className="w-3.5 h-3.5 text-slate-400" />
                                                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Quota min</p>
                                                    </div>
                                                    <p className="font-display font-700 text-lg text-slate-800">
                                                        {event.routeInfo.minElevationM.toLocaleString('it-IT')} m
                                                    </p>
                                                </div>
                                                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                                    <div className="flex items-center gap-1.5 mb-1">
                                                        <Layers className="w-3.5 h-3.5 text-ocean-500" />
                                                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Terreno</p>
                                                    </div>
                                                    <p className="text-sm font-semibold text-slate-700 leading-tight">
                                                        {event.routeInfo.terrain}
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col justify-center h-full bg-slate-50 rounded-xl p-4 border border-slate-100">
                                                <p className="text-sm text-slate-500 leading-relaxed">
                                                    Dati altimetrici non disponibili per questa tipologia di gara.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Elevation chart */}
                                {event.routeInfo && (
                                    <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/50">
                                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
                                            Profilo altimetrico
                                        </p>
                                        <ElevationChart profile={event.routeInfo.profile} />
                                    </div>
                                )}
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
