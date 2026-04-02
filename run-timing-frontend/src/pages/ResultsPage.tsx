import { useState } from 'react';
import { ChevronLeft, ChevronDown, Search, Trophy, Medal, Award, Users, Repeat, Upload } from 'lucide-react';
import { categoryLabels, categoryColors } from '../data/mockEvents';
import { useAdminStore } from '../hooks/useAdminStore';
import { mockResults, raceClassifications } from '../data/mockResults';
import type { Event, Race, Result, LapSplit } from '../types';
import CertificateModal from '../components/results/CertificateModal';
import LapDetail from '../components/results/LapDetail';
import ImportLapsModal from '../components/results/ImportLapsModal';

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
                        className={`flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${expanded ? 'text-ocean-600 bg-ocean-50' : 'text-slate-300 hover:text-ocean-600 hover:bg-ocean-50'}`}
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
                    className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg text-slate-300 hover:text-ocean-600 hover:bg-ocean-50 transition-colors"
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

// ─── Main page ──────────────────────────────────────────────────────────────

export default function ResultsPage() {
    const { events, getResults } = useAdminStore();
    const pastEvents = events.filter(e => new Date(e.date) < new Date());
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [selectedRace,  setSelectedRace]  = useState<Race | null>(null);
    const [query,      setQuery]      = useState('');
    const [catFilter,  setCatFilter]  = useState('Tutti');
    const [classTab,   setClassTab]   = useState<ClassTab>('overall');
    const [certificate, setCertificate] = useState<{ result: Result; catPos?: number } | null>(null);
    const [importedLaps, setImportedLaps] = useState<Record<string, LapSplit[]>>({});
    const [showImport,   setShowImport]   = useState(false);
    const [expandedBib,  setExpandedBib]  = useState<string | null>(null);

    const storedResults = selectedRace ? getResults(selectedRace.id) : [];
    const results = storedResults.length > 0
        ? storedResults
        : (selectedRace ? (mockResults[selectedRace.id] ?? []) : []);
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

    return (
        <main className="min-h-screen bg-slate-50">

            <div className="py-8 px-4 text-center" style={{ background: 'linear-gradient(135deg, #0a3c6e 0%, #0168c8 100%)' }}>
                <h1 className="font-display font-800 text-3xl md:text-4xl text-white mb-1">Risultati</h1>
                <p className="text-sky-200 text-sm">Classifiche ufficiali degli eventi conclusi</p>
            </div>

            <div className="max-w-5xl mx-auto px-3 sm:px-4 py-6 sm:py-8">

                {selectedEvent && (
                    <button onClick={back} className="inline-flex items-center gap-1.5 text-slate-400 hover:text-ocean-600 text-sm mb-5 transition-colors">
                        <ChevronLeft className="w-4 h-4" />
                        {selectedRace ? selectedEvent.title : 'Tutti gli eventi'}
                    </button>
                )}

                {/* ── STEP 1: Event list ── */}
                {!selectedEvent && (
                    <div>
                        <h2 className="font-display font-700 text-base sm:text-xl text-slate-700 uppercase tracking-wide border-b border-slate-200 pb-2 mb-4">
                            Seleziona un evento
                        </h2>
                        <div className="space-y-2.5">
                            {pastEvents.map(event => (
                                <button key={event.id} onClick={() => selectEvent(event)}
                                    className="group w-full flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-3 sm:p-4 hover:bg-slate-50 hover:border-ocean-300 transition-all text-left"
                                    style={{ boxShadow: '2px 4px 6px 0 #eeeeee' }}>
                                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden flex-shrink-0">
                                        <img src={event.coverImage} alt={event.title} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-slate-800 text-sm group-hover:text-ocean-600 transition-colors leading-tight">{event.title}</h3>
                                        <p className="text-slate-400 text-xs mt-0.5 truncate">{formatDate(event.date)} · {event.city}</p>
                                    </div>
                                    <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                                        <span className={`text-xs px-2 py-0.5 rounded border ${categoryColors[event.category]}`}>{categoryLabels[event.category]}</span>
                                        <span className="text-xs text-slate-400">{event.races.length} gare</span>
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
                            <img src={selectedEvent.coverImage} alt={selectedEvent.title} className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg object-cover flex-shrink-0" />
                            <div className="min-w-0">
                                <h2 className="font-display font-800 text-xl sm:text-2xl text-slate-800 truncate">{selectedEvent.title}</h2>
                                <p className="text-slate-400 text-xs sm:text-sm">{formatDate(selectedEvent.date)} · {selectedEvent.city}</p>
                            </div>
                        </div>
                        <h3 className="font-display font-700 text-sm text-slate-500 uppercase tracking-wide border-b border-slate-200 pb-2 mb-3">
                            Seleziona una gara
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {selectedEvent.races.map(race => {
                                const hasResults = !!mockResults[race.id]?.length;
                                const isLap = race.raceType !== 'linear';
                                return (
                                    <button key={race.id}
                                        onClick={() => hasResults ? setSelectedRace(race) : null}
                                        disabled={!hasResults}
                                        className={`flex items-start gap-3 bg-white border rounded-xl p-4 text-left transition-all ${hasResults ? 'border-slate-200 hover:border-ocean-300 hover:bg-slate-50 cursor-pointer' : 'border-slate-100 opacity-50 cursor-not-allowed'}`}
                                        style={{ boxShadow: '2px 4px 6px 0 #eeeeee' }}>
                                        {isLap && <Repeat className="w-4 h-4 text-ocean-500 mt-0.5 flex-shrink-0" />}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-slate-800 text-sm">{race.name}</p>
                                            <p className="text-slate-400 text-xs mt-0.5">{race.distance}</p>
                                            {isLap && (
                                                <span className="inline-block mt-1 text-[10px] bg-ocean-50 text-ocean-600 border border-ocean-200 px-1.5 py-0.5 rounded">
                                                    {race.raceType === 'laps_fixed' ? `${race.totalLaps} giri fissi` : `Gara a tempo ${race.timeLimitMinutes} min`}
                                                </span>
                                            )}
                                        </div>
                                        {hasResults ? (
                                            <span className="text-xs bg-ocean-50 text-ocean-600 border border-ocean-200 px-2 py-1 rounded-lg font-medium flex-shrink-0">Classifica</span>
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
                                        {isLapRace && (
                                            <span className="text-xs bg-ocean-50 text-ocean-600 border border-ocean-200 px-2 py-0.5 rounded-full flex-shrink-0">
                                                {selectedRace.raceType === 'laps_fixed' ? `${selectedRace.totalLaps} giri` : `${selectedRace.timeLimitMinutes} min`}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-slate-400 text-xs sm:text-sm truncate">{selectedEvent.title} · {formatDate(selectedEvent.date)}</p>
                                </div>
                                {isLapRace && (
                                    <button
                                        onClick={() => setShowImport(true)}
                                        className="flex-shrink-0 flex items-center gap-1.5 text-xs sm:text-sm text-ocean-600 hover:text-ocean-700 border border-ocean-200 hover:bg-ocean-50 px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors"
                                    >
                                        <Upload className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">Importa tempi giro</span>
                                        <span className="sm:hidden">Importa</span>
                                        {Object.keys(importedLaps).length > 0 && (
                                            <span className="text-[10px] bg-ocean-100 text-ocean-700 px-1.5 py-0.5 rounded-full font-semibold">
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
                                        <p className="font-display font-700 text-lg sm:text-2xl text-ocean-700">{s.val}</p>
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
                                    className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${classTab === t.id ? 'border-ocean-600 text-ocean-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
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
                                            className="w-full bg-white border border-slate-300 focus:border-ocean-400 focus:outline-none rounded-lg pl-9 pr-4 py-2 text-sm text-slate-700 placeholder-slate-400 transition-colors" />
                                    </div>
                                    {/* Category filter — horizontal scroll on mobile */}
                                    <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5 sm:pb-0 sm:flex-wrap">
                                        {ALL_CAT.map(cat => (
                                            <button key={cat} onClick={() => setCatFilter(cat)}
                                                className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${catFilter === cat ? 'bg-ocean-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-ocean-300'}`}>
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
                                            <Award className="w-4 h-4 text-ocean-500" />
                                            <p className="text-xs font-semibold text-ocean-600 uppercase tracking-wide">{award.label}</p>
                                        </div>
                                        <p className="font-semibold text-slate-800 text-base sm:text-lg">{award.result.athleteName}</p>
                                        <div className="flex items-center justify-between mt-2">
                                            <span className="text-slate-400 text-xs">{award.result.category} {award.result.team ? `· ${award.result.team}` : ''}</span>
                                            <span className="font-mono text-ocean-700 font-semibold text-sm">{award.result.time}</span>
                                        </div>
                                        <button onClick={() => openCert(award.result)}
                                            className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs text-ocean-600 hover:text-ocean-700 border border-ocean-200 hover:bg-ocean-50 py-1.5 rounded-lg transition-colors">
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
