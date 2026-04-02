import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    User, LogOut, Trophy, Flag, Timer, TrendingUp,
    Edit3, Check, X, AlertCircle, ChevronRight, Star,
    Calendar, MapPin, Clock,
} from 'lucide-react';
import { useAthleteAuth } from '../context/AthleteAuthContext';
import { loadRegistrations } from '../hooks/useAdminStore';
import { loadResults } from '../hooks/useAdminStore';
import { mockEvents } from '../data/mockEvents';

const inputCls =
    'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ocean-500 focus:border-ocean-500';

// ── helpers ──────────────────────────────────────────────────────────────────

/** Parses a "HH:MM:SS" or "MM:SS" string to total seconds */
function timeToSeconds(t: string): number {
    if (!t || t === '-') return 0;
    const parts = t.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
}

/** Parses distance string like "10 km" → 10, "42,195 km" → 42.195, "5000 m" → 5 */
function parseKm(dist: string): number {
    if (!dist) return 0;
    const lower = dist.toLowerCase();
    const match = lower.match(/([\d,.]+)\s*(km|m)/);
    if (!match) return 0;
    const val = parseFloat(match[1].replace(',', '.'));
    return match[2] === 'm' ? val / 1000 : val;
}

/** Build a quick lookup: raceId → { eventTitle, raceName, date, city, race } */
function buildRaceLookup() {
    const map: Record<string, { eventTitle: string; raceName: string; date: string; city: string; distanceKm: number }> = {};

    // load admin overrides
    let allEvents = [...mockEvents];
    try {
        const overrides = JSON.parse(localStorage.getItem('rt_admin_events') ?? '[]');
        for (const ov of overrides) {
            const idx = allEvents.findIndex(e => e.id === ov.id);
            if (idx >= 0) allEvents[idx] = ov; else allEvents.push(ov);
        }
    } catch { /* ignore */ }

    for (const ev of allEvents) {
        for (const race of ev.races) {
            map[race.id] = {
                eventTitle: ev.title,
                raceName:   race.name,
                date:       ev.date,
                city:       ev.city,
                distanceKm: parseKm(race.distance),
            };
        }
    }
    return map;
}

// ─────────────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'races' | 'settings';

export default function AthleteDashboardPage() {
    const navigate = useNavigate();
    const { currentAthlete, logout, updateProfile } = useAthleteAuth();

    const [tab, setTab] = useState<Tab>('overview');
    const [editing, setEditing] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [saveOk, setSaveOk] = useState(false);

    // edit form state mirrors currentAthlete fields
    const [editForm, setEditForm] = useState(() => ({
        name:           currentAthlete?.name ?? '',
        surname:        currentAthlete?.surname ?? '',
        phone:          currentAthlete?.phone ?? '',
        club:           currentAthlete?.club ?? '',
        fidalTessera:   currentAthlete?.fidalTessera ?? '',
        runcardTessera: currentAthlete?.runcardTessera ?? '',
    }));

    if (!currentAthlete) {
        navigate('/accedi', { replace: true });
        return null;
    }

    // ── data ─────────────────────────────────────────────────────────────────

    const raceLookup = useMemo(() => buildRaceLookup(), []);
    const resultsMap = useMemo(() => loadResults(), []);

    const myRegistrations = useMemo(
        () => loadRegistrations().filter(r => r.athleteAccountId === currentAthlete.id),
        [currentAthlete.id]
    );

    /** Enrich registrations with event/race info and optional result */
    const enrichedRegs = useMemo(() => {
        return myRegistrations.map(reg => {
            const info = raceLookup[reg.raceId];
            const raceResults = resultsMap[reg.raceId] ?? [];
            // match by bib or by name
            const myResult = raceResults.find(r =>
                r.athleteName.toLowerCase().includes(currentAthlete.surname.toLowerCase()) &&
                r.athleteName.toLowerCase().includes(currentAthlete.name.toLowerCase())
            ) ?? null;
            return { reg, info, myResult };
        }).sort((a, b) => {
            const da = a.info?.date ?? a.reg.submittedAt;
            const db = b.info?.date ?? b.reg.submittedAt;
            return db.localeCompare(da);
        });
    }, [myRegistrations, raceLookup, resultsMap, currentAthlete]);

    /** Stats */
    const stats = useMemo(() => {
        const finishedWithTime = enrichedRegs.filter(
            e => e.myResult?.status === 'finisher' && e.myResult.time && e.myResult.time !== '-'
        );

        let totalKm = 0;
        let totalSeconds = 0;
        let podiums = 0;

        for (const { myResult, info } of finishedWithTime) {
            const km = info?.distanceKm ?? 0;
            const secs = timeToSeconds(myResult!.time);
            if (km > 0 && secs > 0) {
                totalKm += km;
                totalSeconds += secs;
            }
            if (myResult!.position <= 3) podiums++;
        }

        const avgPaceSecPerKm = totalKm > 0 ? totalSeconds / totalKm : 0;
        const paceMin = Math.floor(avgPaceSecPerKm / 60);
        const paceSec = Math.round(avgPaceSecPerKm % 60);
        const avgPaceStr = avgPaceSecPerKm > 0
            ? `${paceMin}:${String(paceSec).padStart(2, '0')} min/km`
            : '-';

        return {
            totalRaces:   myRegistrations.length,
            finishedRaces: finishedWithTime.length,
            totalKm:      Math.round(totalKm * 10) / 10,
            avgPace:      avgPaceStr,
            podiums,
        };
    }, [enrichedRegs, myRegistrations]);

    // ── handlers ──────────────────────────────────────────────────────────────

    function handleLogout() {
        logout();
        navigate('/', { replace: true });
    }

    function setField(field: keyof typeof editForm) {
        return (e: React.ChangeEvent<HTMLInputElement>) =>
            setEditForm(f => ({ ...f, [field]: e.target.value }));
    }

    function handleSaveProfile(e: React.FormEvent) {
        e.preventDefault();
        setSaveError('');
        if (!editForm.name.trim() || !editForm.surname.trim()) {
            setSaveError('Nome e cognome sono obbligatori.');
            return;
        }
        updateProfile({
            name:           editForm.name.trim(),
            surname:        editForm.surname.trim(),
            phone:          editForm.phone.trim() || undefined,
            club:           editForm.club.trim() || undefined,
            fidalTessera:   editForm.fidalTessera.trim() || undefined,
            runcardTessera: editForm.runcardTessera.trim() || undefined,
        });
        setEditing(false);
        setSaveOk(true);
        setTimeout(() => setSaveOk(false), 3000);
    }

    function cancelEdit() {
        if (!currentAthlete) return;
        setEditForm({
            name:           currentAthlete.name,
            surname:        currentAthlete.surname,
            phone:          currentAthlete.phone ?? '',
            club:           currentAthlete.club ?? '',
            fidalTessera:   currentAthlete.fidalTessera ?? '',
            runcardTessera: currentAthlete.runcardTessera ?? '',
        });
        setEditing(false);
        setSaveError('');
    }

    // ── render ────────────────────────────────────────────────────────────────

    const statCards = [
        { icon: Flag,      label: 'Gare iscritto',  value: stats.totalRaces },
        { icon: Trophy,    label: 'Podi',            value: stats.podiums },
        { icon: TrendingUp,label: 'Km totali',       value: stats.totalKm > 0 ? `${stats.totalKm} km` : '-' },
        { icon: Timer,     label: 'Passo medio',     value: stats.avgPace },
    ];

    const statusLabels: Record<string, string> = {
        pending:   'In attesa',
        confirmed: 'Confermato',
        rejected:  'Rifiutato',
    };
    const statusColors: Record<string, string> = {
        pending:   'bg-yellow-100 text-yellow-700',
        confirmed: 'bg-green-100 text-green-700',
        rejected:  'bg-red-100 text-red-700',
    };

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Top bar */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
                <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
                    <Link to="/" className="inline-flex items-center gap-2">
                        <div className="w-8 h-8 bg-ocean-600 rounded-lg flex items-center justify-center">
                            <Timer className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-display font-700 text-base text-slate-800">
                            Run<span className="text-ocean-600">Timing</span>
                        </span>
                    </Link>
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-600 hidden sm:block">
                            {currentAthlete.name} {currentAthlete.surname}
                        </span>
                        <button onClick={handleLogout}
                            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors">
                            <LogOut className="w-4 h-4" />
                            <span className="hidden sm:inline">Esci</span>
                        </button>
                    </div>
                </div>
            </header>

            <div className="max-w-5xl mx-auto px-4 py-8">
                {/* Profile header */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6 flex items-center gap-5">
                    <div className="w-16 h-16 rounded-full bg-ocean-100 flex items-center justify-center shrink-0">
                        <User className="w-8 h-8 text-ocean-600" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="font-display font-700 text-xl text-slate-800">
                            {currentAthlete.name} {currentAthlete.surname}
                        </h1>
                        <p className="text-sm text-slate-500">{currentAthlete.email}</p>
                        {currentAthlete.club && (
                            <p className="text-sm text-ocean-600 font-medium mt-0.5">{currentAthlete.club}</p>
                        )}
                    </div>
                    {saveOk && (
                        <div className="ml-auto flex items-center gap-1.5 text-green-600 text-sm">
                            <Check className="w-4 h-4" /> Salvato
                        </div>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 mb-6 w-fit">
                    {(['overview', 'races', 'settings'] as Tab[]).map(t => (
                        <button key={t} onClick={() => setTab(t)}
                            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                tab === t
                                    ? 'bg-ocean-600 text-white'
                                    : 'text-slate-500 hover:text-slate-800'
                            }`}>
                            {{ overview: 'Panoramica', races: 'Gare', settings: 'Profilo' }[t]}
                        </button>
                    ))}
                </div>

                {/* ── OVERVIEW ─────────────────────────────────────────── */}
                {tab === 'overview' && (
                    <div className="space-y-6">
                        {/* Stat cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {statCards.map(({ icon: Icon, label, value }) => (
                                <div key={label}
                                    className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-2">
                                    <div className="w-9 h-9 rounded-lg bg-ocean-50 flex items-center justify-center">
                                        <Icon className="w-5 h-5 text-ocean-600" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-slate-800">{value}</p>
                                        <p className="text-xs text-slate-500">{label}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Recent races */}
                        <div className="bg-white rounded-2xl border border-slate-200">
                            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                                <h2 className="font-semibold text-slate-800">Ultime gare</h2>
                                <button onClick={() => setTab('races')}
                                    className="text-ocean-600 text-sm font-medium hover:underline flex items-center gap-1">
                                    Vedi tutte <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                            </div>
                            {enrichedRegs.length === 0 ? (
                                <div className="px-5 py-10 text-center text-slate-400 text-sm">
                                    Non hai ancora gare registrate.<br />
                                    <Link to="/gare" className="text-ocean-600 hover:underline mt-1 inline-block">
                                        Sfoglia gli eventi
                                    </Link>
                                </div>
                            ) : (
                                <ul className="divide-y divide-slate-100">
                                    {enrichedRegs.slice(0, 5).map(({ reg, info, myResult }) => (
                                        <li key={reg.id} className="px-5 py-3 flex items-center gap-4">
                                            <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                                                <Flag className="w-4 h-4 text-slate-400" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="font-medium text-slate-800 text-sm truncate">
                                                    {info?.eventTitle ?? reg.eventId}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {info?.raceName}{info?.city ? ` · ${info.city}` : ''}{info?.date ? ` · ${new Date(info.date).toLocaleDateString('it-IT')}` : ''}
                                                </p>
                                            </div>
                                            {myResult ? (
                                                <div className="text-right shrink-0">
                                                    <p className="font-semibold text-slate-800 text-sm">
                                                        {myResult.position}°
                                                        {myResult.position <= 3 && <Star className="w-3 h-3 text-yellow-400 inline ml-0.5" />}
                                                    </p>
                                                    <p className="text-xs text-slate-500">{myResult.time}</p>
                                                </div>
                                            ) : (
                                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[reg.paymentStatus]}`}>
                                                    {statusLabels[reg.paymentStatus]}
                                                </span>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                )}

                {/* ── RACES ────────────────────────────────────────────── */}
                {tab === 'races' && (
                    <div className="bg-white rounded-2xl border border-slate-200">
                        <div className="px-5 py-4 border-b border-slate-100">
                            <h2 className="font-semibold text-slate-800">Storico gare ({enrichedRegs.length})</h2>
                        </div>
                        {enrichedRegs.length === 0 ? (
                            <div className="px-5 py-12 text-center text-slate-400 text-sm">
                                Nessuna gara trovata.{' '}
                                <Link to="/gare" className="text-ocean-600 hover:underline">Sfoglia gli eventi</Link>
                            </div>
                        ) : (
                            <ul className="divide-y divide-slate-100">
                                {enrichedRegs.map(({ reg, info, myResult }) => (
                                    <li key={reg.id} className="px-5 py-4 flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                                            <Flag className="w-5 h-5 text-slate-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-slate-800">{info?.eventTitle ?? reg.eventId}</p>
                                            <p className="text-sm text-slate-500 mt-0.5">{info?.raceName}</p>
                                            <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500">
                                                {info?.date && (
                                                    <span className="flex items-center gap-1">
                                                        <Calendar className="w-3 h-3" />
                                                        {new Date(info.date).toLocaleDateString('it-IT')}
                                                    </span>
                                                )}
                                                {info?.city && (
                                                    <span className="flex items-center gap-1">
                                                        <MapPin className="w-3 h-3" /> {info.city}
                                                    </span>
                                                )}
                                                {info?.distanceKm ? (
                                                    <span className="flex items-center gap-1">
                                                        <TrendingUp className="w-3 h-3" /> {info.distanceKm} km
                                                    </span>
                                                ) : null}
                                            </div>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            {myResult ? (
                                                <>
                                                    <p className="font-bold text-slate-800 text-lg">
                                                        {myResult.position}°
                                                        {myResult.position <= 3 && <Star className="w-3.5 h-3.5 text-yellow-400 inline ml-0.5" />}
                                                    </p>
                                                    <p className="text-sm text-slate-500 flex items-center justify-end gap-1 mt-0.5">
                                                        <Clock className="w-3 h-3" /> {myResult.time}
                                                    </p>
                                                    {info?.distanceKm && timeToSeconds(myResult.time) > 0 && (
                                                        <p className="text-xs text-slate-400">
                                                            {(() => {
                                                                const spm = timeToSeconds(myResult.time) / info.distanceKm;
                                                                const m = Math.floor(spm / 60);
                                                                const s = Math.round(spm % 60);
                                                                return `${m}:${String(s).padStart(2,'0')} min/km`;
                                                            })()}
                                                        </p>
                                                    )}
                                                </>
                                            ) : (
                                                <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColors[reg.paymentStatus]}`}>
                                                    {statusLabels[reg.paymentStatus]}
                                                </span>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

                {/* ── SETTINGS ─────────────────────────────────────────── */}
                {tab === 'settings' && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-6">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="font-semibold text-slate-800">Dati personali</h2>
                            {!editing && (
                                <button onClick={() => setEditing(true)}
                                    className="flex items-center gap-1.5 text-sm text-ocean-600 hover:text-ocean-700 font-medium">
                                    <Edit3 className="w-4 h-4" /> Modifica
                                </button>
                            )}
                        </div>

                        {saveOk && (
                            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-green-700 text-sm mb-4">
                                <Check className="w-4 h-4" /> Profilo aggiornato con successo.
                            </div>
                        )}
                        {saveError && (
                            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-sm mb-4">
                                <AlertCircle className="w-4 h-4 shrink-0" /> {saveError}
                            </div>
                        )}

                        {editing ? (
                            <form onSubmit={handleSaveProfile} className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
                                        <input type="text" value={editForm.name} onChange={setField('name')}
                                            className={inputCls} required />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Cognome *</label>
                                        <input type="text" value={editForm.surname} onChange={setField('surname')}
                                            className={inputCls} required />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Telefono</label>
                                        <input type="tel" value={editForm.phone} onChange={setField('phone')}
                                            className={inputCls} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Società</label>
                                        <input type="text" value={editForm.club} onChange={setField('club')}
                                            className={inputCls} />
                                    </div>
                                </div>
                                <hr className="border-slate-100" />
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Tessera FIDAL</label>
                                        <input type="text" value={editForm.fidalTessera} onChange={setField('fidalTessera')}
                                            className={inputCls} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Tessera Runcard</label>
                                        <input type="text" value={editForm.runcardTessera} onChange={setField('runcardTessera')}
                                            className={inputCls} />
                                    </div>
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button type="submit"
                                        className="flex items-center gap-2 bg-ocean-600 hover:bg-ocean-700 text-white font-semibold rounded-lg px-4 py-2 text-sm transition-colors">
                                        <Check className="w-4 h-4" /> Salva modifiche
                                    </button>
                                    <button type="button" onClick={cancelEdit}
                                        className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg px-4 py-2 text-sm transition-colors">
                                        <X className="w-4 h-4" /> Annulla
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <dl className="space-y-3">
                                {[
                                    ['Email',       currentAthlete.email],
                                    ['Nome',        `${currentAthlete.name} ${currentAthlete.surname}`],
                                    ['Anno nascita', String(currentAthlete.birthYear)],
                                    ['Sesso',       currentAthlete.gender === 'M' ? 'Maschile' : 'Femminile'],
                                    ['Telefono',    currentAthlete.phone ?? '-'],
                                    ['Società',     currentAthlete.club ?? '-'],
                                    ['Tessera FIDAL',    currentAthlete.fidalTessera ?? '-'],
                                    ['Tessera Runcard',  currentAthlete.runcardTessera ?? '-'],
                                ].map(([label, val]) => (
                                    <div key={label} className="flex justify-between py-2 border-b border-slate-50 last:border-0">
                                        <dt className="text-sm text-slate-500">{label}</dt>
                                        <dd className="text-sm font-medium text-slate-800">{val}</dd>
                                    </div>
                                ))}
                            </dl>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
