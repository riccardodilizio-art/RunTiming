import { useState } from 'react';
import { ChevronLeft, Search, Trophy, Medal, Award, Users, Repeat } from 'lucide-react';
import { mockEvents, categoryLabels, categoryColors } from '../data/mockEvents';
import { mockResults, raceClassifications } from '../data/mockResults';
import type { Event, Race, Result } from '../types';
import CertificateModal from '../components/results/CertificateModal';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
}

function positionIcon(pos: number) {
    if (pos === 1) return <Trophy className="w-4 h-4 text-yellow-500" />;
    if (pos === 2) return <Medal className="w-4 h-4 text-slate-400" />;
    if (pos === 3) return <Medal className="w-4 h-4 text-amber-600" />;
    return null;
}

function rowBg(pos: number) {
    if (pos === 1) return 'bg-yellow-50 border-l-2 border-yellow-400';
    if (pos === 2) return 'bg-slate-50 border-l-2 border-slate-300';
    if (pos === 3) return 'bg-amber-50 border-l-2 border-amber-400';
    return '';
}

function statusBadge(r: Result) {
    if (r.status === 'dnf') return <span className="text-xs bg-red-50 text-red-500 border border-red-200 px-1.5 py-0.5 rounded">DNF</span>;
    if (r.status === 'dns') return <span className="text-xs bg-slate-100 text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded">DNS</span>;
    if (r.status === 'dsq') return <span className="text-xs bg-orange-50 text-orange-500 border border-orange-200 px-1.5 py-0.5 rounded">DSQ</span>;
    return null;
}

const ALL_CAT = ['Tutti', 'M18-34', 'M35-49', 'M50-59', 'M60+', 'F18-34', 'F35-49', 'F50+'];

type ClassTab = 'overall' | 'category' | 'team' | 'specials';

// ─── Subcomponents ──────────────────────────────────────────────────────────

function ResultRow({ r, race, onCertificate, catPosition }: {
    r: Result;
    race: Race;
    onCertificate: (r: Result, catPos?: number) => void;
    catPosition?: number;
}) {
    const isLap = race.raceType !== 'linear';
    const isFinisher = r.status === 'finisher';

    return (
        <div className={`grid items-center gap-2 px-4 py-3 hover:bg-slate-50 transition-colors text-sm ${rowBg(r.position)}`}
             style={{ gridTemplateColumns: isLap ? '40px 56px 1fr 80px 70px 60px 48px' : '40px 56px 1fr 80px 80px 70px 48px' }}>

            <div className="flex items-center justify-center">
                {isFinisher
                    ? (positionIcon(r.position) ?? <span className={`text-sm ${r.position <= 3 ? 'font-bold text-slate-700' : 'text-slate-500'}`}>{r.position}</span>)
                    : statusBadge(r)
                }
            </div>

            <span className="text-slate-500 text-xs font-mono">{r.bib}</span>

            <div className="min-w-0">
                <p className="text-slate-800 font-medium truncate">{r.athleteName}</p>
                {r.team && <p className="text-slate-400 text-xs truncate">{r.team}</p>}
            </div>

            <span className="text-slate-400 text-xs hidden sm:block">{r.category}</span>

            {isLap ? (
                <span className="text-slate-700 font-mono font-semibold text-center">
                    {r.lapsCompleted ?? '—'} giri
                </span>
            ) : (
                <span className={`font-mono font-semibold text-right ${isFinisher ? 'text-slate-800' : 'text-slate-400'}`}>
                    {isFinisher ? r.time : '—'}
                </span>
            )}

            <span className="text-slate-400 text-xs font-mono text-right hidden sm:block">
                {r.gap ?? (isFinisher ? '—' : '')}
            </span>

            {isFinisher ? (
                <button
                    onClick={() => onCertificate(r, catPosition)}
                    title="Scarica attestato"
                    className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-300 hover:text-ocean-600 hover:bg-ocean-50 transition-colors"
                >
                    <Award className="w-4 h-4" />
                </button>
            ) : <div />}
        </div>
    );
}

// ─── Main page ──────────────────────────────────────────────────────────────

const pastEvents = mockEvents.filter(e => new Date(e.date) < new Date());

export default function ResultsPage() {
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [selectedRace,  setSelectedRace]  = useState<Race | null>(null);
    const [query,      setQuery]      = useState('');
    const [catFilter,  setCatFilter]  = useState('Tutti');
    const [classTab,   setClassTab]   = useState<ClassTab>('overall');
    const [certificate, setCertificate] = useState<{ result: Result; catPos?: number } | null>(null);

    const results = selectedRace ? (mockResults[selectedRace.id] ?? []) : [];
    const finishers = results.filter(r => r.status === 'finisher');
    const specials  = selectedRace ? raceClassifications[selectedRace.id]?.specials : undefined;

    const isLapRace = selectedRace?.raceType !== 'linear';

    // Filter for overall/search
    const filtered = results.filter(r => {
        const q = query.toLowerCase();
        const matchQ   = !q || r.athleteName.toLowerCase().includes(q) || r.bib.includes(q);
        const matchCat = catFilter === 'Tutti' || r.category === catFilter;
        return matchQ && matchCat;
    });

    // Per-category classification (only finishers)
    const categories = [...new Set(finishers.map(r => r.category))].sort();
    const byCategory = Object.fromEntries(
        categories.map(cat => [cat, finishers.filter(r => r.category === cat)])
    );

    // Per-team classification (sum of best 3 finishers per team)
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
    }

    function back() {
        if (selectedRace) { setSelectedRace(null); setQuery(''); setCatFilter('Tutti'); setClassTab('overall'); }
        else setSelectedEvent(null);
    }

    const colHeaders = isLapRace
        ? ['#', 'Pet.', 'Atleta', 'Cat.', 'Giri', 'Distacco', '']
        : ['#', 'Pet.', 'Atleta', 'Cat.', 'Tempo', 'Distacco', ''];

    return (
        <main className="min-h-screen bg-slate-50">

            <div className="py-8 px-4 text-center" style={{ background: 'linear-gradient(135deg, #0a3c6e 0%, #0168c8 100%)' }}>
                <h1 className="font-display font-800 text-3xl md:text-4xl text-white mb-1">Risultati</h1>
                <p className="text-sky-200 text-sm">Classifiche ufficiali degli eventi conclusi</p>
            </div>

            <div className="max-w-5xl mx-auto px-4 py-8">

                {selectedEvent && (
                    <button onClick={back} className="inline-flex items-center gap-1.5 text-slate-400 hover:text-ocean-600 text-sm mb-6 transition-colors">
                        <ChevronLeft className="w-4 h-4" />
                        {selectedRace ? selectedEvent.title : 'Tutti gli eventi'}
                    </button>
                )}

                {/* ── STEP 1: Event list ── */}
                {!selectedEvent && (
                    <div>
                        <h2 className="font-display font-700 text-xl text-slate-700 uppercase tracking-wide border-b border-slate-200 pb-2 mb-5">
                            Seleziona un evento
                        </h2>
                        <div className="space-y-3">
                            {pastEvents.map(event => (
                                <button key={event.id} onClick={() => selectEvent(event)}
                                    className="group w-full flex items-center gap-4 bg-white border border-slate-200 rounded-lg p-4 hover:bg-slate-50 hover:border-ocean-300 transition-all text-left"
                                    style={{ boxShadow: '2px 4px 6px 0 #eeeeee' }}>
                                    <div className="w-14 h-14 rounded-md overflow-hidden flex-shrink-0">
                                        <img src={event.coverImage} alt={event.title} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-slate-800 text-sm group-hover:text-ocean-600 transition-colors">{event.title}</h3>
                                        <p className="text-slate-400 text-xs mt-0.5">{formatDate(event.date)} · {event.city} ({event.province})</p>
                                    </div>
                                    <div className="flex-shrink-0 flex items-center gap-2">
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
                        <div className="flex items-center gap-3 mb-6">
                            <img src={selectedEvent.coverImage} alt={selectedEvent.title} className="w-12 h-12 rounded-lg object-cover" />
                            <div>
                                <h2 className="font-display font-800 text-2xl text-slate-800">{selectedEvent.title}</h2>
                                <p className="text-slate-400 text-sm">{formatDate(selectedEvent.date)} · {selectedEvent.city}</p>
                            </div>
                        </div>
                        <h3 className="font-display font-700 text-base text-slate-500 uppercase tracking-wide border-b border-slate-200 pb-2 mb-4">
                            Seleziona una gara
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                                        <div className="flex-1">
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
                        {/* Race header */}
                        <div className="flex items-start justify-between gap-4 mb-5">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <h2 className="font-display font-800 text-2xl text-slate-800">{selectedRace.name}</h2>
                                    {isLapRace && (
                                        <span className="text-xs bg-ocean-50 text-ocean-600 border border-ocean-200 px-2 py-0.5 rounded-full">
                                            {selectedRace.raceType === 'laps_fixed' ? `${selectedRace.totalLaps} giri` : `${selectedRace.timeLimitMinutes} min`}
                                        </span>
                                    )}
                                </div>
                                <p className="text-slate-400 text-sm">{selectedEvent.title} · {formatDate(selectedEvent.date)}</p>
                            </div>
                            <div className="text-right flex-shrink-0 grid grid-cols-3 gap-3">
                                {[
                                    { label: 'Classificati', val: finishers.length },
                                    { label: 'DNF/DSQ', val: results.filter(r => r.status !== 'finisher' && r.status !== 'dns').length },
                                    { label: 'DNS', val: results.filter(r => r.status === 'dns').length },
                                ].map(s => (
                                    <div key={s.label} className="text-center">
                                        <p className="text-xs text-slate-400">{s.label}</p>
                                        <p className="font-display font-700 text-xl text-ocean-700">{s.val}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Classification tabs */}
                        <div className="flex border-b border-slate-200 mb-5 overflow-x-auto">
                            {([
                                { id: 'overall',  label: 'Assoluta',    icon: <Trophy className="w-3.5 h-3.5" /> },
                                { id: 'category', label: 'Categorie',   icon: <Users className="w-3.5 h-3.5" /> },
                                { id: 'team',     label: 'Squadre',     icon: <Users className="w-3.5 h-3.5" /> },
                                ...(specials?.length ? [{ id: 'specials', label: 'Premi speciali', icon: <Award className="w-3.5 h-3.5" /> }] : []),
                            ] as { id: ClassTab; label: string; icon: React.ReactNode }[]).map(t => (
                                <button key={t.id} onClick={() => setClassTab(t.id as ClassTab)}
                                    className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${classTab === t.id ? 'border-ocean-600 text-ocean-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                                    {t.icon} {t.label}
                                </button>
                            ))}
                        </div>

                        {/* ── Classifica assoluta ── */}
                        {classTab === 'overall' && (
                            <>
                                <div className="flex flex-wrap gap-2 mb-4">
                                    <div className="relative flex-1 min-w-[200px]">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                        <input type="text" placeholder="Cerca atleta o pettorale..."
                                            value={query} onChange={e => setQuery(e.target.value)}
                                            className="w-full bg-white border border-slate-300 focus:border-ocean-400 focus:outline-none rounded-lg pl-9 pr-4 py-2 text-sm text-slate-700 placeholder-slate-400 transition-colors" />
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {ALL_CAT.map(cat => (
                                            <button key={cat} onClick={() => setCatFilter(cat)}
                                                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${catFilter === cat ? 'bg-ocean-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-ocean-300'}`}>
                                                {cat}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <p className="text-xs text-slate-400 mb-3">{filtered.length} atleti</p>

                                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden" style={{ boxShadow: '2px 4px 6px 0 #eeeeee' }}>
                                    <div className="grid gap-2 px-4 py-2.5 border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-400 uppercase tracking-wide"
                                         style={{ gridTemplateColumns: isLapRace ? '40px 56px 1fr 80px 70px 60px 48px' : '40px 56px 1fr 80px 80px 70px 48px' }}>
                                        {colHeaders.map((h, i) => <span key={i} className={i > 3 ? 'text-right' : ''}>{h}</span>)}
                                    </div>
                                    {filtered.length > 0
                                        ? filtered.map(r => (
                                            <ResultRow key={r.bib} r={r} race={selectedRace}
                                                catPosition={catPositionFor(r)}
                                                onCertificate={(res, cp) => openCert(res, cp)} />
                                        ))
                                        : <p className="text-center text-slate-400 text-sm py-10">Nessun atleta trovato.</p>
                                    }
                                </div>
                            </>
                        )}

                        {/* ── Per categoria ── */}
                        {classTab === 'category' && (
                            <div className="space-y-6">
                                {categories.map(cat => (
                                    <div key={cat}>
                                        <h3 className="font-display font-700 text-base text-slate-700 uppercase tracking-wide border-b border-slate-200 pb-2 mb-3">
                                            {cat}
                                            <span className="ml-2 text-slate-400 text-sm normal-case font-normal">
                                                ({byCategory[cat].length} atleti)
                                            </span>
                                        </h3>
                                        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden" style={{ boxShadow: '2px 4px 6px 0 #eeeeee' }}>
                                            {byCategory[cat].map((r, idx) => {
                                                const catR = { ...r, position: idx + 1 };
                                                return <ResultRow key={r.bib} r={catR} race={selectedRace} onCertificate={() => openCert(r, idx + 1)} catPosition={idx + 1} />;
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* ── Per squadra ── */}
                        {classTab === 'team' && (
                            <div className="space-y-4">
                                {teamRankings.length === 0 ? (
                                    <p className="text-slate-400 text-sm text-center py-10">Nessuna squadra nei risultati.</p>
                                ) : teamRankings.map(({ team, members, count }, idx) => (
                                    <div key={team} className="bg-white border border-slate-200 rounded-xl overflow-hidden" style={{ boxShadow: '2px 4px 6px 0 #eeeeee' }}>
                                        <div className={`flex items-center justify-between px-5 py-3 border-b border-slate-100 ${rowBg(idx + 1)}`}>
                                            <div className="flex items-center gap-3">
                                                {positionIcon(idx + 1) ?? <span className="text-slate-500 font-semibold text-sm w-4">{idx + 1}°</span>}
                                                <p className="font-semibold text-slate-800">{team}</p>
                                            </div>
                                            <span className="text-xs text-slate-500">{count} atleti classificati</span>
                                        </div>
                                        <div className="divide-y divide-slate-50">
                                            {members.map(r => (
                                                <div key={r.bib} className="flex items-center justify-between px-5 py-2.5 text-sm">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-slate-400 w-6 text-xs">{r.position}°</span>
                                                        <span className="text-slate-800">{r.athleteName}</span>
                                                        <span className="text-slate-400 text-xs">{r.category}</span>
                                                    </div>
                                                    <span className="font-mono text-slate-700 text-xs">
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
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {specials.map((award, i) => (
                                    <div key={i} className="bg-white border border-slate-200 rounded-xl p-5" style={{ boxShadow: '2px 4px 6px 0 #eeeeee' }}>
                                        <div className="flex items-center gap-2 mb-3">
                                            <Award className="w-4 h-4 text-ocean-500" />
                                            <p className="text-xs font-semibold text-ocean-600 uppercase tracking-wide">{award.label}</p>
                                        </div>
                                        <p className="font-semibold text-slate-800 text-lg">{award.result.athleteName}</p>
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

        </main>
    );
}
