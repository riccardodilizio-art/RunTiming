import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import EventCover from '../components/ui/EventCover';
import { allRaces, eventStartDate } from '../utils/event';
import { ChevronLeft, ChevronDown, Search, Trophy, Medal, Award, Users, Repeat, Upload, User, Calendar } from 'lucide-react';
import { categoryLabels, categoryColors } from '../data/mockEvents';
import { useAdminStore, loadResultsApi } from '../hooks/useAdminStore';
import { USE_API } from '../lib/api';
import { mockResults, raceClassifications } from '../data/mockResults';
import type { Event, Race, Result, LapSplit, ResultStatus } from '../types';

// ─── Indice risultati per atleta (aggregazione su tutte le gare) ──────────────

interface AthleteEntry {
    eventTitle: string;
    eventSlug: string;
    raceName: string;
    date: string;
    position: number;
    category: string;
    team?: string;
    time: string;
    status: ResultStatus;
    isLap: boolean;
    lapsCompleted?: number;
}
interface AthleteAgg { name: string; entries: AthleteEntry[] }
import CertificateModal from '../components/results/CertificateModal';
import LapDetail from '../components/results/LapDetail';
import ImportLapsModal from '../components/results/ImportLapsModal';
import { SITE_NAME } from '../lib/brand';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
}

function positionIcon(pos: number) {
    if (pos === 1) return <Trophy className="w-4 h-4 text-yellow-500 flex-shrink-0" />;
    if (pos === 2) return <Medal className="w-4 h-4 text-slate-400 flex-shrink-0" />;
    if (pos === 3) return <Medal className="w-4 h-4 text-amber-600 flex-shrink-0" />;
    return null;
}

function rowBg(pos: number) {
    if (pos === 1) return 'bg-yellow-50 border-l-2 border-yellow-400';
    if (pos === 2) return 'bg-slate-50 border-l-2 border-slate-300';
    if (pos === 3) return 'bg-amber-50 border-l-2 border-amber-400';
    return '';
}

function statusBadge(r: Result) {
    if (r.status === 'dnf') return <span className="text-[10px] bg-red-50 text-red-500 border border-red-200 px-1.5 py-0.5 rounded font-semibold">DNF</span>;
    if (r.status === 'dns') return <span className="text-[10px] bg-slate-100 text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded font-semibold">DNS</span>;
    if (r.status === 'dsq') return <span className="text-[10px] bg-orange-50 text-orange-500 border border-orange-200 px-1.5 py-0.5 rounded font-semibold">DSQ</span>;
    return null;
}

const ALL_CAT = ['Tutti', 'M18-34', 'M35-49', 'M50-59', 'M60+', 'F18-34', 'F35-49', 'F50+'];

type ClassTab = 'overall' | 'category' | 'team' | 'specials';

// ─── Result row (flex-based, mobile-first) ───────────────────────────────────

function ResultRow({ r, race, onCertificate, catPosition, hasLaps, expanded, onToggle }: {
    r: Result;
    race: Race;
    onCertificate: (r: Result, catPos?: number) => void;
    catPosition?: number;
    hasLaps?: boolean;
    expanded?: boolean;
    onToggle?: () => void;
}) {
    const isLap = race.raceType !== 'linear';
    const isFinisher = r.status === 'finisher';

    return (
        <div className={`flex items-center gap-2 px-3 sm:px-4 py-3 hover:bg-slate-50 transition-colors ${rowBg(r.position)}`}>

            {/* Position / status */}
            <div className="w-8 sm:w-10 flex-shrink-0 flex items-center justify-center">
                {isFinisher
                    ? (positionIcon(r.position) ?? (
                        <span className={`text-xs font-bold tabular-nums ${r.position <= 10 ? 'text-slate-600' : 'text-slate-400'}`}>
                            {r.position}
                        </span>
                    ))
                    : statusBadge(r)
                }
            </div>

            {/* Bib — separate column on desktop, inline on mobile */}
            <span className="hidden sm:block w-11 flex-shrink-0 text-slate-400 text-xs font-mono">{r.bib}</span>

            {/* Athlete info */}
            <div className="flex-1 min-w-0">
                <p className="text-slate-800 font-medium text-sm leading-tight truncate">{r.athleteName}</p>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {/* Bib inline on mobile */}
                    <span className="sm:hidden text-slate-400 text-[10px] font-mono">{r.bib}</span>
                    <span className="text-slate-400 text-[10px]">{r.category}</span>
                    {r.team && (
                        <span className="text-slate-400 text-[10px] truncate max-w-[120px]">· {r.team}</span>
                    )}
                </div>
            </div>

            {/* Time / laps + gap */}
            <div className="flex-shrink-0 text-right min-w-[60px]">
                {isLap ? (
                    <span className="text-slate-700 font-mono font-semibold text-sm tabular-nums">
                        {r.lapsCompleted ?? '—'}<span className="text-[10px] font-normal ml-0.5 text-slate-500">giri</span>
                    </span>
                ) : (
                    <span className={`font-mono font-semibold text-sm tabular-nums ${isFinisher ? 'text-slate-800' : 'text-slate-400'}`}>
                        {isFinisher ? r.time : '—'}
                    </span>
                )}
                {r.gap && isFinisher && (
                    <p className="text-slate-400 text-[10px] font-mono mt-0.5 tabular-nums">{r.gap}</p>
                )}
            </div>

            {/* Expand toggle (lap races) */}
            {isLap && (
                hasLaps && onToggle ? (
                    <button
                        onClick={onToggle}
                        title="Dettaglio giri"
                        className={`flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${expanded ? 'text-brand-600 bg-brand-50' : 'text-slate-300 hover:text-brand-600 hover:bg-brand-50'}`}
                    >
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    </button>
                ) : <div className="w-7 flex-shrink-0" />
            )}

            {/* Award */}
            {isFinisher ? (
                <button
                    onClick={() => onCertificate(r, catPosition)}
                    title="Scarica attestato"
                    className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg text-slate-300 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                >
                    <Award className="w-4 h-4" />
                </button>
            ) : <div className="w-8 flex-shrink-0" />}
        </div>
    );
}

// Desktop-only column header (flex-aligned)
function TableHeader({ isLapRace }: { isLapRace: boolean }) {
    return (
        <div className="hidden sm:flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 bg-slate-50 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
            <span className="w-10 flex-shrink-0 text-center">#</span>
            <span className="w-11 flex-shrink-0">Pet.</span>
            <span className="flex-1">Atleta</span>
            <span className="flex-shrink-0 w-[68px] text-right">{isLapRace ? 'Giri' : 'Tempo'}</span>
            {isLapRace && <span className="w-7 flex-shrink-0" />}
            <span className="w-8 flex-shrink-0" />
        </div>
    );
}

// ─── Storico risultati di un atleta ──────────────────────────────────────────

function AthleteHistory({ agg, onBack }: { agg: AthleteAgg; onBack: () => void }) {
    const finishers = agg.entries.filter(e => e.status === 'finisher');
    const wins = finishers.filter(e => e.position === 1).length;
    const podi = finishers.filter(e => e.position <= 3).length;

    const stats = [
        { label: 'Gare',      val: agg.entries.length },
        { label: 'Vittorie',  val: wins },
        { label: 'Podi',      val: podi },
    ];

    return (
        <div>
            <button onClick={onBack} className="inline-flex items-center gap-1.5 text-slate-400 hover:text-brand-600 text-sm mb-4 transition-colors">
                <ChevronLeft className="w-4 h-4" /> Tutti gli atleti
            </button>

            {/* Header */}
            <div className="flex items-center gap-4 bg-white border border-slate-200 rounded-2xl p-5 mb-4" style={{ boxShadow: '2px 4px 6px 0 #eeeeee' }}>
                <div className="w-14 h-14 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                    <User className="w-7 h-7 text-brand-600" />
                </div>
                <div className="min-w-0">
                    <h2 className="font-display font-800 text-xl sm:text-2xl text-slate-800 leading-tight">{agg.name}</h2>
                    <p className="text-slate-400 text-sm">Storico risultati su {SITE_NAME}</p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-5">
                {stats.map(s => (
                    <div key={s.label} className="bg-white border border-slate-200 rounded-xl px-3 py-3 text-center" style={{ boxShadow: '2px 4px 6px 0 #eeeeee' }}>
                        <p className="text-[10px] sm:text-xs text-slate-400">{s.label}</p>
                        <p className="font-display font-700 text-lg sm:text-2xl text-brand-700">{s.val}</p>
                    </div>
                ))}
            </div>

            {/* History */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden" style={{ boxShadow: '2px 4px 6px 0 #eeeeee' }}>
                <div className="hidden sm:flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 bg-slate-50 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                    <span className="w-24 flex-shrink-0">Data</span>
                    <span className="flex-1">Evento · Gara</span>
                    <span className="w-24 flex-shrink-0 hidden md:block">Categoria</span>
                    <span className="w-10 flex-shrink-0 text-center">Pos.</span>
                    <span className="w-16 flex-shrink-0 text-right">Tempo</span>
                </div>
                {agg.entries.map((e, i) => (
                    <div key={i} className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 transition-colors">
                        <span className="w-24 flex-shrink-0 text-xs text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3 hidden sm:block" />{formatDate(e.date)}
                        </span>
                        <div className="flex-1 min-w-0">
                            <Link to={`/events/${e.eventSlug}`} className="text-sm font-medium text-slate-800 hover:text-brand-600 transition-colors truncate block">
                                {e.eventTitle}
                            </Link>
                            <p className="text-xs text-slate-400 truncate">{e.raceName}{e.team ? ` · ${e.team}` : ''}</p>
                        </div>
                        <span className="w-24 flex-shrink-0 text-xs text-slate-400 hidden md:block truncate">{e.category}</span>
                        <span className="w-10 flex-shrink-0 flex items-center justify-center">
                            {e.status === 'finisher'
                                ? (positionIcon(e.position) ?? <span className="text-xs font-bold text-slate-600 tabular-nums">{e.position}</span>)
                                : <span className="text-[10px] text-slate-400 font-semibold uppercase">{e.status}</span>}
                        </span>
                        <span className="w-16 flex-shrink-0 text-right font-mono text-sm font-semibold text-slate-800 tabular-nums">
                            {e.isLap ? `${e.lapsCompleted ?? '—'}g` : (e.status === 'finisher' ? e.time : '—')}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Main page ──────────────────────────────────────────────────────────────

export default function ResultsPage() {
    const { events, getResults, resultsMeta } = useAdminStore();
    // Eventi già iniziati o con una classifica pubblicata (anche live, il giorno della gara)
    const pastEvents = events.filter(e =>
        new Date(eventStartDate(e)) < new Date() || allRaces(e).some(r => (r.resultsCount ?? 0) > 0));
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [selectedRace,  setSelectedRace]  = useState<Race | null>(null);
    const [query,      setQuery]      = useState('');
    const [catFilter,  setCatFilter]  = useState('Tutti');
    const [classTab,   setClassTab]   = useState<ClassTab>('overall');
    const [certificate, setCertificate] = useState<{ result: Result; catPos?: number } | null>(null);
    const [importedLaps, setImportedLaps] = useState<Record<string, LapSplit[]>>({});
    const [showImport,   setShowImport]   = useState(false);
    const [expandedBib,  setExpandedBib]  = useState<string | null>(null);
    // Modalità scoperta risultati: per evento (default) o per atleta.
    const [mode, setMode] = useState<'eventi' | 'atleti'>('eventi');
    const [athQuery, setAthQuery] = useState('');
    const [selectedAthleteKey, setSelectedAthleteKey] = useState<string | null>(null);

    // Aggrega i risultati di tutte le gare per atleta (nome).
    const athleteIndex = useMemo(() => {
        const idx = new Map<string, AthleteAgg>();
        for (const ev of events) {
            for (const race of allRaces(ev)) {
                const stored = getResults(race.id);
                const list = stored.length > 0 ? stored : (mockResults[race.id] ?? []);
                for (const r of list) {
                    const key = r.athleteName.trim().toLowerCase();
                    if (!key) continue;
                    let a = idx.get(key);
                    if (!a) { a = { name: r.athleteName.trim(), entries: [] }; idx.set(key, a); }
                    a.entries.push({
                        eventTitle: ev.title, eventSlug: ev.slug, raceName: race.name,
                        date: eventStartDate(ev), position: r.position, category: r.category,
                        team: r.team, time: r.time, status: r.status,
                        isLap: race.raceType !== 'linear', lapsCompleted: r.lapsCompleted,
                    });
                }
            }
        }
        for (const a of idx.values()) {
            a.entries.sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime());
        }
        return idx;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [events]);

    const storedResults = selectedRace ? getResults(selectedRace.id) : [];
    const results = storedResults.length > 0 || USE_API
        ? storedResults
        : (selectedRace ? (mockResults[selectedRace.id] ?? []) : []);
    const meta = selectedRace ? resultsMeta[selectedRace.id] : undefined;
    const isLive = meta?.status === 'live';

    // Classifica live (semi-live dal PC di gara): si aggiorna da sola ogni 30 secondi
    useEffect(() => {
        if (!USE_API || !selectedRace || !isLive) return;
        const t = setInterval(() => { loadResultsApi(selectedRace.id, true).catch(() => undefined); }, 30_000);
        return () => clearInterval(t);
    }, [selectedRace, isLive]);
    const finishers = results.filter(r => r.status === 'finisher');
    const specials  = selectedRace ? raceClassifications[selectedRace.id]?.specials : undefined;
    const isLapRace = selectedRace?.raceType !== 'linear';

    function getLapSplits(r: Result): LapSplit[] {
        return importedLaps[r.bib] ?? r.lapSplits ?? [];
    }

    const filtered = results.filter(r => {
        const q = query.toLowerCase();
        const matchQ   = !q || r.athleteName.toLowerCase().includes(q) || r.bib.includes(q);
        const matchCat = catFilter === 'Tutti' || r.category === catFilter;
        return matchQ && matchCat;
    });

    const categories = [...new Set(finishers.map(r => r.category))].sort();
    const byCategory = Object.fromEntries(
        categories.map(cat => [cat, finishers.filter(r => r.category === cat)])
    );

    const teamsMap: Record<string, Result[]> = {};
    finishers.forEach(r => {
        if (!r.team) return;
        if (!teamsMap[r.team]) teamsMap[r.team] = [];
        teamsMap[r.team].push(r);
    });
    const teamRankings = Object.entries(teamsMap)
        .map(([team, members]) => ({ team, members, count: members.length }))
        .sort((a, b) => b.count - a.count);

    function catPositionFor(r: Result): number | undefined {
        const catResults = byCategory[r.category];
        if (!catResults) return undefined;
        return catResults.findIndex(x => x.bib === r.bib) + 1;
    }

    function openCert(r: Result, catPos?: number) {
        setCertificate({ result: r, catPos });
    }

    function selectEvent(event: Event) {
        setSelectedEvent(event);
        setSelectedRace(null);
        setQuery('');
        setCatFilter('Tutti');
        setClassTab('overall');
        setImportedLaps({});
        setExpandedBib(null);
    }

    function back() {
        if (selectedRace) {
            setSelectedRace(null);
            setQuery('');
            setCatFilter('Tutti');
            setClassTab('overall');
            setImportedLaps({});
            setExpandedBib(null);
        } else {
            setSelectedEvent(null);
        }
    }

    const athleteList = [...athleteIndex.values()];
    const athMatches = athQuery.trim().length >= 2
        ? athleteList
            .filter(a => a.name.toLowerCase().includes(athQuery.trim().toLowerCase()))
            .sort((a, b) => a.name.localeCompare(b.name))
            .slice(0, 40)
        : [];
    const selectedAthlete = selectedAthleteKey ? athleteIndex.get(selectedAthleteKey) : null;

    return (
        <main className="min-h-screen bg-slate-50">

            <div className="py-8 px-4 text-center" style={{ background: 'linear-gradient(135deg, #7a2510 0%, #e8430a 100%)' }}>
                <h1 className="font-display font-800 text-3xl md:text-4xl text-white mb-1">Risultati</h1>
                <p className="text-orange-100 text-sm">Classifiche ufficiali e risultati in diretta</p>
            </div>

            <div className="max-w-5xl mx-auto px-3 sm:px-4 py-6 sm:py-8">

                {selectedEvent && (
                    <button onClick={back} className="inline-flex items-center gap-1.5 text-slate-400 hover:text-brand-600 text-sm mb-5 transition-colors">
                        <ChevronLeft className="w-4 h-4" />
                        {selectedRace ? selectedEvent.title : 'Tutti gli eventi'}
                    </button>
                )}

                {/* ── Mode toggle (top level) ── */}
                {!selectedEvent && (
                    <div className="flex gap-2 mb-5">
                        {([
                            { id: 'eventi', label: 'Per evento', icon: <Trophy className="w-3.5 h-3.5" /> },
                            { id: 'atleti', label: 'Per atleta', icon: <User className="w-3.5 h-3.5" /> },
                        ] as const).map(t => (
                            <button key={t.id}
                                onClick={() => { setMode(t.id); setSelectedAthleteKey(null); }}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                                    mode === t.id ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300'
                                }`}>
                                {t.icon} {t.label}
                            </button>
                        ))}
                    </div>
                )}

                {/* ── Per atleta: ricerca + storico ── */}
                {!selectedEvent && mode === 'atleti' && (
                    <div>
                        {!selectedAthlete ? (
                            <>
                                <div className="relative mb-4 max-w-lg">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text" autoFocus
                                        placeholder="Cerca un atleta per nome o cognome…"
                                        value={athQuery}
                                        onChange={e => setAthQuery(e.target.value)}
                                        className="w-full bg-white border border-slate-300 focus:border-brand-400 focus:outline-none rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 transition-colors"
                                    />
                                </div>
                                {athQuery.trim().length < 2 ? (
                                    <p className="text-sm text-slate-400">Digita almeno 2 lettere per cercare un atleta tra tutte le classifiche.</p>
                                ) : athMatches.length === 0 ? (
                                    <p className="text-sm text-slate-400">Nessun atleta trovato per “{athQuery}”.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {athMatches.map(a => {
                                            const key = a.name.toLowerCase();
                                            const wins = a.entries.filter(e => e.status === 'finisher' && e.position === 1).length;
                                            return (
                                                <button key={key} onClick={() => setSelectedAthleteKey(key)}
                                                    className="group w-full flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-3.5 hover:border-brand-300 hover:shadow-md transition-all text-left"
                                                    style={{ boxShadow: '2px 4px 6px 0 #eeeeee' }}>
                                                    <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                                                        <User className="w-5 h-5 text-brand-600" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-semibold text-slate-800 text-sm group-hover:text-brand-600 transition-colors">{a.name}</p>
                                                        <p className="text-xs text-slate-400">{a.entries.length} {a.entries.length === 1 ? 'gara' : 'gare'}{wins > 0 ? ` · ${wins} ${wins === 1 ? 'vittoria' : 'vittorie'}` : ''}</p>
                                                    </div>
                                                    <ChevronLeft className="w-4 h-4 text-slate-300 rotate-180 group-hover:text-brand-500" />
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </>
                        ) : (
                            <AthleteHistory agg={selectedAthlete} onBack={() => setSelectedAthleteKey(null)} />
                        )}
                    </div>
                )}

                {/* ── STEP 1: Event list ── */}
                {!selectedEvent && mode === 'eventi' && (
                    <div>
                        <h2 className="font-display font-700 text-base sm:text-xl text-slate-700 uppercase tracking-wide border-b border-slate-200 pb-2 mb-4">
                            Seleziona un evento
                        </h2>
                        <div className="space-y-2.5">
                            {pastEvents.map(event => (
                                <button key={event.id} onClick={() => selectEvent(event)}
                                    className="group w-full flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-3 sm:p-4 hover:bg-slate-50 hover:border-brand-300 transition-all text-left"
                                    style={{ boxShadow: '2px 4px 6px 0 #eeeeee' }}>
                                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden flex-shrink-0">
                                        <EventCover src={event.coverImage} alt={event.title} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-slate-800 text-sm group-hover:text-brand-600 transition-colors leading-tight">{event.title}</h3>
                                        <p className="text-slate-400 text-xs mt-0.5 truncate">{formatDate(eventStartDate(event))} · {event.city}</p>
                                    </div>
                                    <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                                        <span className={`text-xs px-2 py-0.5 rounded border ${categoryColors[event.category]}`}>{categoryLabels[event.category]}</span>
                                        <span className="text-xs text-slate-400">{allRaces(event).length} gare</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── STEP 2: Race selector ── */}
                {selectedEvent && !selectedRace && (
                    <div>
                        <div className="flex items-center gap-3 mb-5">
                            <EventCover src={selectedEvent.coverImage} alt={selectedEvent.title} className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg object-cover flex-shrink-0" />
                            <div className="min-w-0">
                                <h2 className="font-display font-800 text-xl sm:text-2xl text-slate-800 truncate">{selectedEvent.title}</h2>
                                <p className="text-slate-400 text-xs sm:text-sm">{formatDate(eventStartDate(selectedEvent))} · {selectedEvent.city}</p>
                            </div>
                        </div>
                        <h3 className="font-display font-700 text-sm text-slate-500 uppercase tracking-wide border-b border-slate-200 pb-2 mb-3">
                            Seleziona una gara
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {allRaces(selectedEvent).map(race => {
                                const hasResults = (race.resultsCount ?? 0) > 0 || !!mockResults[race.id]?.length;
                                const isLap = race.raceType !== 'linear';
                                return (
                                    <button key={race.id}
                                        onClick={() => hasResults ? setSelectedRace(race) : null}
                                        disabled={!hasResults}
                                        className={`flex items-start gap-3 bg-white border rounded-xl p-4 text-left transition-all ${hasResults ? 'border-slate-200 hover:border-brand-300 hover:bg-slate-50 cursor-pointer' : 'border-slate-100 opacity-50 cursor-not-allowed'}`}
                                        style={{ boxShadow: '2px 4px 6px 0 #eeeeee' }}>
                                        {isLap && <Repeat className="w-4 h-4 text-brand-500 mt-0.5 flex-shrink-0" />}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-slate-800 text-sm">{race.name}</p>
                                            <p className="text-slate-400 text-xs mt-0.5">{race.distance}</p>
                                            {isLap && (
                                                <span className="inline-block mt-1 text-[10px] bg-brand-50 text-brand-600 border border-brand-200 px-1.5 py-0.5 rounded">
                                                    {race.raceType === 'laps_fixed' ? `${race.totalLaps} giri fissi` : `Gara a tempo ${race.timeLimitMinutes} min`}
                                                </span>
                                            )}
                                        </div>
                                        {hasResults ? (
                                            <span className="text-xs bg-brand-50 text-brand-600 border border-brand-200 px-2 py-1 rounded-lg font-medium flex-shrink-0">Classifica</span>
                                        ) : (
                                            <span className="text-xs bg-slate-100 text-slate-400 px-2 py-1 rounded-lg flex-shrink-0">N/D</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ── STEP 3: Classification ── */}
                {selectedEvent && selectedRace && (
                    <div>

                        {/* Race header — mobile-friendly stack */}
                        <div className="mb-4">
                            {/* Row 1: title + import button */}
                            <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                        <h2 className="font-display font-800 text-xl sm:text-2xl text-slate-800 leading-tight">{selectedRace.name}</h2>
                                        {isLive && (
                                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full flex-shrink-0">
                                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                                LIVE{meta?.updatedAt ? ` · ${new Date(meta.updatedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}` : ''}
                                            </span>
                                        )}
                                        {meta?.status === 'final' && (
                                            <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full flex-shrink-0">Ufficiale</span>
                                        )}
                                        {isLapRace && (
                                            <span className="text-xs bg-brand-50 text-brand-600 border border-brand-200 px-2 py-0.5 rounded-full flex-shrink-0">
                                                {selectedRace.raceType === 'laps_fixed' ? `${selectedRace.totalLaps} giri` : `${selectedRace.timeLimitMinutes} min`}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-slate-400 text-xs sm:text-sm truncate">{selectedEvent.title} · {formatDate(eventStartDate(selectedEvent))}</p>
                                </div>
                                {isLapRace && (
                                    <button
                                        onClick={() => setShowImport(true)}
                                        className="flex-shrink-0 flex items-center gap-1.5 text-xs sm:text-sm text-brand-600 hover:text-brand-700 border border-brand-200 hover:bg-brand-50 px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors"
                                    >
                                        <Upload className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">Importa tempi giro</span>
                                        <span className="sm:hidden">Importa</span>
                                        {Object.keys(importedLaps).length > 0 && (
                                            <span className="text-[10px] bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded-full font-semibold">
                                                {Object.keys(importedLaps).length}
                                            </span>
                                        )}
                                    </button>
                                )}
                            </div>
                            {/* Row 2: stats */}
                            <div className="grid grid-cols-3 gap-2 sm:gap-4 bg-white border border-slate-200 rounded-xl px-3 py-3 sm:px-5"
                                 style={{ boxShadow: '2px 4px 6px 0 #eeeeee' }}>
                                {[
                                    { label: 'Classificati', val: finishers.length },
                                    { label: 'DNF/DSQ', val: results.filter(r => r.status !== 'finisher' && r.status !== 'dns').length },
                                    { label: 'DNS', val: results.filter(r => r.status === 'dns').length },
                                ].map(s => (
                                    <div key={s.label} className="text-center">
                                        <p className="text-[10px] sm:text-xs text-slate-400 leading-tight">{s.label}</p>
                                        <p className="font-display font-700 text-lg sm:text-2xl text-brand-700">{s.val}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Classification tabs */}
                        <div className="flex border-b border-slate-200 mb-4 overflow-x-auto scrollbar-none">
                            {([
                                { id: 'overall',  label: 'Assoluta',       icon: <Trophy className="w-3.5 h-3.5" /> },
                                { id: 'category', label: 'Categorie',      icon: <Users className="w-3.5 h-3.5" /> },
                                { id: 'team',     label: 'Squadre',        icon: <Users className="w-3.5 h-3.5" /> },
                                ...(specials?.length ? [{ id: 'specials', label: 'Premi', icon: <Award className="w-3.5 h-3.5" /> }] : []),
                            ] as { id: ClassTab; label: string; icon: React.ReactNode }[]).map(t => (
                                <button key={t.id} onClick={() => setClassTab(t.id as ClassTab)}
                                    className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${classTab === t.id ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                                    {t.icon} {t.label}
                                </button>
                            ))}
                        </div>

                        {/* ── Classifica assoluta ── */}
                        {classTab === 'overall' && (
                            <>
                                <div className="flex flex-col sm:flex-row gap-2 mb-3">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                        <input type="text" placeholder="Cerca atleta o pettorale..."
                                            value={query} onChange={e => setQuery(e.target.value)}
                                            className="w-full bg-white border border-slate-300 focus:border-brand-400 focus:outline-none rounded-lg pl-9 pr-4 py-2 text-sm text-slate-700 placeholder-slate-400 transition-colors" />
                                    </div>
                                    {/* Category filter — horizontal scroll on mobile */}
                                    <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5 sm:pb-0 sm:flex-wrap">
                                        {ALL_CAT.map(cat => (
                                            <button key={cat} onClick={() => setCatFilter(cat)}
                                                className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${catFilter === cat ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-brand-300'}`}>
                                                {cat}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <p className="text-xs text-slate-400 mb-2">{filtered.length} atleti</p>

                                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden" style={{ boxShadow: '2px 4px 6px 0 #eeeeee' }}>
                                    <TableHeader isLapRace={isLapRace} />
                                    {filtered.length > 0
                                        ? filtered.map(r => {
                                            const laps = getLapSplits(r);
                                            const isExpanded = expandedBib === r.bib;
                                            return (
                                                <div key={r.bib} className="border-b border-slate-100 last:border-b-0">
                                                    <ResultRow
                                                        r={r} race={selectedRace}
                                                        catPosition={catPositionFor(r)}
                                                        onCertificate={(res, cp) => openCert(res, cp)}
                                                        hasLaps={laps.length > 0}
                                                        expanded={isExpanded}
                                                        onToggle={() => setExpandedBib(isExpanded ? null : r.bib)}
                                                    />
                                                    {isExpanded && laps.length > 0 && (
                                                        <LapDetail lapSplits={laps} athleteName={r.athleteName} />
                                                    )}
                                                </div>
                                            );
                                        })
                                        : <p className="text-center text-slate-400 text-sm py-10">Nessun atleta trovato.</p>
                                    }
                                </div>
                            </>
                        )}

                        {/* ── Per categoria ── */}
                        {classTab === 'category' && (
                            <div className="space-y-5">
                                {categories.map(cat => (
                                    <div key={cat}>
                                        <h3 className="font-display font-700 text-sm text-slate-700 uppercase tracking-wide border-b border-slate-200 pb-2 mb-3">
                                            {cat}
                                            <span className="ml-2 text-slate-400 text-xs normal-case font-normal">
                                                ({byCategory[cat].length} atleti)
                                            </span>
                                        </h3>
                                        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden" style={{ boxShadow: '2px 4px 6px 0 #eeeeee' }}>
                                            <TableHeader isLapRace={isLapRace} />
                                            {byCategory[cat].map((r, idx) => {
                                                const catR = { ...r, position: idx + 1 };
                                                return (
                                                    <div key={r.bib} className="border-b border-slate-100 last:border-b-0">
                                                        <ResultRow r={catR} race={selectedRace} onCertificate={() => openCert(r, idx + 1)} catPosition={idx + 1} />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* ── Per squadra ── */}
                        {classTab === 'team' && (
                            <div className="space-y-3">
                                {teamRankings.length === 0 ? (
                                    <p className="text-slate-400 text-sm text-center py-10">Nessuna squadra nei risultati.</p>
                                ) : teamRankings.map(({ team, members, count }, idx) => (
                                    <div key={team} className="bg-white border border-slate-200 rounded-xl overflow-hidden" style={{ boxShadow: '2px 4px 6px 0 #eeeeee' }}>
                                        <div className={`flex items-center justify-between px-4 py-3 border-b border-slate-100 ${rowBg(idx + 1)}`}>
                                            <div className="flex items-center gap-2.5">
                                                {positionIcon(idx + 1) ?? <span className="text-slate-500 font-semibold text-sm w-4">{idx + 1}°</span>}
                                                <p className="font-semibold text-slate-800 text-sm">{team}</p>
                                            </div>
                                            <span className="text-xs text-slate-400 flex-shrink-0">{count} atleti</span>
                                        </div>
                                        <div className="divide-y divide-slate-50">
                                            {members.map(r => (
                                                <div key={r.bib} className="flex items-center justify-between px-4 py-2 text-sm">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <span className="text-slate-400 text-xs flex-shrink-0">{r.position}°</span>
                                                        <span className="text-slate-800 truncate text-sm">{r.athleteName}</span>
                                                        <span className="text-slate-400 text-xs flex-shrink-0 hidden sm:inline">{r.category}</span>
                                                    </div>
                                                    <span className="font-mono text-slate-700 text-xs flex-shrink-0 ml-2">
                                                        {isLapRace ? `${r.lapsCompleted} giri` : r.time}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* ── Premi speciali ── */}
                        {classTab === 'specials' && specials && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {specials.map((award, i) => (
                                    <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5" style={{ boxShadow: '2px 4px 6px 0 #eeeeee' }}>
                                        <div className="flex items-center gap-2 mb-2.5">
                                            <Award className="w-4 h-4 text-brand-500" />
                                            <p className="text-xs font-semibold text-brand-600 uppercase tracking-wide">{award.label}</p>
                                        </div>
                                        <p className="font-semibold text-slate-800 text-base sm:text-lg">{award.result.athleteName}</p>
                                        <div className="flex items-center justify-between mt-2">
                                            <span className="text-slate-400 text-xs">{award.result.category} {award.result.team ? `· ${award.result.team}` : ''}</span>
                                            <span className="font-mono text-brand-700 font-semibold text-sm">{award.result.time}</span>
                                        </div>
                                        <button onClick={() => openCert(award.result)}
                                            className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 border border-brand-200 hover:bg-brand-50 py-1.5 rounded-lg transition-colors">
                                            <Award className="w-3.5 h-3.5" /> Genera attestato
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                    </div>
                )}

            </div>

            {/* Certificate modal */}
            {certificate && selectedEvent && selectedRace && (
                <CertificateModal
                    result={certificate.result}
                    event={selectedEvent}
                    race={selectedRace}
                    catPosition={certificate.catPos}
                    onClose={() => setCertificate(null)}
                />
            )}

            {/* Import laps modal */}
            {showImport && (
                <ImportLapsModal
                    onImport={(data) => {
                        setImportedLaps(prev => ({ ...prev, ...data }));
                        setExpandedBib(null);
                    }}
                    onClose={() => setShowImport(false)}
                />
            )}

        </main>
    );
}
