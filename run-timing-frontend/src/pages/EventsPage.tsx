import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Search, LayoutList, LayoutGrid, X, SlidersHorizontal, ChevronDown,
    ChevronLeft, ChevronRight, Calendar, Map,
} from 'lucide-react';
import { mockEvents, categoryLabels, categoryColors } from '../data/mockEvents';
import type { Event, SportCategory } from '../types';
import EventRow from '../components/ui/EventRow';
import EventGridCard from '../components/ui/EventGridCard';
import EventsMap from '../components/map/EventsMap';

type Tab  = 'upcoming' | 'all' | 'past';
type Sort = 'date-asc' | 'date-desc' | 'price-asc' | 'price-desc' | 'popular';
type View = 'list' | 'grid' | 'calendar' | 'map';

const CATEGORIES: Array<{ value: SportCategory | 'all'; label: string }> = [
    { value: 'all',       label: 'Tutti' },
    { value: 'running',   label: 'Running' },
    { value: 'cycling',   label: 'Ciclismo' },
    { value: 'triathlon', label: 'Triathlon' },
    { value: 'trail',     label: 'Trail' },
    { value: 'swimming',  label: 'Nuoto' },
];

const SORT_OPTIONS: Array<{ value: Sort; label: string }> = [
    { value: 'date-asc',   label: 'Data (più vicina)' },
    { value: 'date-desc',  label: 'Data (più lontana)' },
    { value: 'price-asc',  label: 'Prezzo (crescente)' },
    { value: 'price-desc', label: 'Prezzo (decrescente)' },
    { value: 'popular',    label: 'Più popolari' },
];

const TABS: Array<{ value: Tab; label: string }> = [
    { value: 'upcoming', label: 'Prossimi' },
    { value: 'all',      label: 'Tutti' },
    { value: 'past',     label: 'Passati' },
];

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

function minPrice(event: (typeof mockEvents)[number]) {
    return Math.min(...event.races.map(r => r.price));
}

function totalParticipants(event: (typeof mockEvents)[number]) {
    return event.races.reduce((s, r) => s + r.participants, 0);
}

// ─── Calendar view ──────────────────────────────────────────────────────────

function EventCalendar({ events }: { events: Event[] }) {
    const [month, setMonth] = useState<Date>(() => {
        const upcoming = [...mockEvents]
            .filter(e => new Date(e.date) >= new Date())
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        if (upcoming.length) {
            const d = new Date(upcoming[0].date);
            return new Date(d.getFullYear(), d.getMonth(), 1);
        }
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });
    const [selectedDay, setSelectedDay] = useState<number | null>(null);

    const year = month.getFullYear();
    const mon  = month.getMonth();

    const daysInMonth = new Date(year, mon + 1, 0).getDate();
    // Monday-first offset (0 = Mon … 6 = Sun)
    const firstOffset = (new Date(year, mon, 1).getDay() + 6) % 7;

    const cells: (number | null)[] = [
        ...Array<null>(firstOffset).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);

    // Build day → events map for the current month
    const eventsByDay: Record<number, Event[]> = {};
    events.forEach(e => {
        const d = new Date(e.date);
        if (d.getFullYear() === year && d.getMonth() === mon) {
            const day = d.getDate();
            if (!eventsByDay[day]) eventsByDay[day] = [];
            eventsByDay[day].push(e);
        }
    });

    const monthHasEvents = Object.keys(eventsByDay).length > 0;
    const selectedEvents = selectedDay ? (eventsByDay[selectedDay] ?? []) : [];

    const monthLabel = month.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

    function prevMonth() { setMonth(new Date(year, mon - 1, 1)); setSelectedDay(null); }
    function nextMonth() { setMonth(new Date(year, mon + 1, 1)); setSelectedDay(null); }

    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === mon;

    return (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden"
             style={{ boxShadow: '2px 4px 6px 0 #eeeeee' }}>

            {/* Month navigation */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <button onClick={prevMonth}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <h3 className="font-display font-700 text-slate-800 capitalize text-base">
                    {monthLabel}
                </h3>
                <button onClick={nextMonth}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
                {WEEKDAYS.map(d => (
                    <div key={d}
                         className="text-center text-[10px] font-semibold text-slate-400 uppercase tracking-wide py-2">
                        {d}
                    </div>
                ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 divide-x divide-slate-100">
                {cells.map((day, i) => {
                    if (!day) {
                        return (
                            <div key={`empty-${i}`}
                                 className={`h-16 bg-slate-50/50 ${i % 7 !== 0 ? '' : ''}`} />
                        );
                    }

                    const dayEvents = eventsByDay[day] ?? [];
                    const isToday   = isCurrentMonth && today.getDate() === day;
                    const isSelected = selectedDay === day && dayEvents.length > 0;
                    const isLastRow = i >= cells.length - 7;

                    return (
                        <div key={day}
                            onClick={() => dayEvents.length ? setSelectedDay(isSelected ? null : day) : null}
                            className={`h-16 p-1.5 flex flex-col border-b border-slate-100 transition-colors
                                ${isLastRow ? 'border-b-0' : ''}
                                ${dayEvents.length ? 'cursor-pointer hover:bg-ocean-50/40' : ''}
                                ${isSelected ? 'bg-ocean-50' : ''}`}
                        >
                            {/* Day number */}
                            <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full flex-shrink-0
                                ${isToday ? 'bg-ocean-600 text-white font-semibold' : 'text-slate-600'}`}>
                                {day}
                            </span>

                            {/* Event dots / labels */}
                            <div className="flex flex-col gap-0.5 mt-0.5 overflow-hidden">
                                {dayEvents.slice(0, 2).map(e => (
                                    <span key={e.id}
                                        className="text-[9px] leading-tight bg-ocean-100 text-ocean-700 px-1 rounded truncate font-medium">
                                        {e.title}
                                    </span>
                                ))}
                                {dayEvents.length > 2 && (
                                    <span className="text-[9px] text-slate-400 px-1">
                                        +{dayEvents.length - 2} altri
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* No events notice */}
            {!monthHasEvents && (
                <div className="text-center py-6 text-slate-400 text-sm border-t border-slate-100 bg-slate-50/50">
                    Nessun evento trovato in questo mese
                </div>
            )}

            {/* Selected day panel */}
            {selectedDay !== null && selectedEvents.length > 0 && (
                <div className="border-t border-slate-200 p-4 bg-slate-50">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                        {selectedDay} {month.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
                    </p>
                    <div className="space-y-2">
                        {selectedEvents.map(e => (
                            <Link key={e.id} to={`/events/${e.slug}`}
                                className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg p-3 hover:border-ocean-300 transition-colors group">
                                <img src={e.coverImage} alt={e.title}
                                     className="w-10 h-10 rounded-md object-cover flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-slate-800 group-hover:text-ocean-600 truncate">
                                        {e.title}
                                    </p>
                                    <p className="text-xs text-slate-400 truncate">
                                        {e.city} ({e.province}) ·{' '}
                                        {new Date(e.date).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                                <div className="flex-shrink-0 flex flex-col items-end gap-1">
                                    <span className={`text-xs px-2 py-0.5 rounded border ${categoryColors[e.category]}`}>
                                        {categoryLabels[e.category]}
                                    </span>
                                    <span className="text-xs text-slate-400">{e.races.length} gare</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Main page ──────────────────────────────────────────────────────────────

export default function EventsPage() {
    const [query,     setQuery]     = useState('');
    const [category,  setCategory]  = useState<SportCategory | 'all'>('all');
    const [tab,       setTab]       = useState<Tab>('upcoming');
    const [sort,      setSort]      = useState<Sort>('date-asc');
    const [onlyOpen,  setOnlyOpen]  = useState(false);
    const [view,      setView]      = useState<View>('list');

    const now = new Date();

    const countFor = (cat: SportCategory | 'all') =>
        mockEvents.filter(e => {
            const matchesTab = tab === 'all' ? true : tab === 'upcoming'
                ? new Date(e.date) >= now : new Date(e.date) < now;
            const matchesCat = cat === 'all' || e.category === cat;
            return matchesTab && matchesCat;
        }).length;

    const filtered = mockEvents
        .filter(e => {
            const q = query.toLowerCase();
            const matchesQuery    = !q ||
                e.title.toLowerCase().includes(q) ||
                e.city.toLowerCase().includes(q) ||
                e.organizer.toLowerCase().includes(q);
            const matchesCategory = category === 'all' || e.category === category;
            const matchesTab      = tab === 'all' ? true : tab === 'upcoming'
                ? new Date(e.date) >= now : new Date(e.date) < now;
            const matchesOpen     = !onlyOpen || e.races.some(r => r.isOpen);
            return matchesQuery && matchesCategory && matchesTab && matchesOpen;
        })
        .sort((a, b) => {
            switch (sort) {
                case 'date-asc':   return new Date(a.date).getTime() - new Date(b.date).getTime();
                case 'date-desc':  return new Date(b.date).getTime() - new Date(a.date).getTime();
                case 'price-asc':  return minPrice(a) - minPrice(b);
                case 'price-desc': return minPrice(b) - minPrice(a);
                case 'popular':    return totalParticipants(b) - totalParticipants(a);
            }
        });

    const hasActiveFilters = category !== 'all' || onlyOpen || sort !== 'date-asc';

    function resetFilters() {
        setQuery('');
        setCategory('all');
        setOnlyOpen(false);
        setSort('date-asc');
    }

    return (
        <main className="min-h-screen bg-slate-50">

            {/* Header */}
            <div className="py-8 px-4 text-center" style={{ background: 'linear-gradient(135deg, #0a3c6e 0%, #0168c8 100%)' }}>
                <h1 className="font-display font-800 text-3xl md:text-4xl text-white mb-1">
                    Tutti gli eventi
                </h1>
                <p className="text-sky-200 text-sm">
                    Cerca e iscriviti alle gare sportive in tutta Italia
                </p>
            </div>

            <div className="max-w-5xl mx-auto px-4 py-6">

                {/* Search + sort + view toggle */}
                <div className="flex gap-2 mb-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Cerca per nome, città o organizzatore..."
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            className="w-full bg-white border border-slate-300 focus:border-ocean-400 focus:outline-none rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 transition-colors"
                        />
                        {query && (
                            <button
                                onClick={() => setQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Sort — hidden in calendar/map view */}
                    {view !== 'calendar' && view !== 'map' && (
                        <div className="relative">
                            <SlidersHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                            <select
                                value={sort}
                                onChange={e => setSort(e.target.value as Sort)}
                                className="appearance-none bg-white border border-slate-300 rounded-lg pl-8 pr-8 py-2.5 text-sm text-slate-600 focus:outline-none focus:border-ocean-400 cursor-pointer"
                            >
                                {SORT_OPTIONS.map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* View toggle: list / grid / calendar */}
                    <div className="flex bg-white border border-slate-300 rounded-lg overflow-hidden">
                        <button
                            onClick={() => setView('list')}
                            className={`px-3 py-2.5 transition-colors ${view === 'list' ? 'bg-ocean-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}
                            aria-label="Vista lista"
                        >
                            <LayoutList className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setView('grid')}
                            className={`px-3 py-2.5 border-l border-slate-200 transition-colors ${view === 'grid' ? 'bg-ocean-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}
                            aria-label="Vista griglia"
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setView('calendar')}
                            className={`px-3 py-2.5 border-l border-slate-200 transition-colors ${view === 'calendar' ? 'bg-ocean-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}
                            aria-label="Vista calendario"
                        >
                            <Calendar className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setView('map')}
                            className={`px-3 py-2.5 border-l border-slate-200 transition-colors ${view === 'map' ? 'bg-ocean-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}
                            aria-label="Vista mappa"
                        >
                            <Map className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Category pills with counts */}
                <div className="flex flex-wrap gap-2 mb-4">
                    {CATEGORIES.map(c => {
                        const count = countFor(c.value);
                        return (
                            <button
                                key={c.value}
                                onClick={() => setCategory(c.value)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                    category === c.value
                                        ? 'bg-ocean-600 text-white'
                                        : 'bg-white border border-slate-200 text-slate-600 hover:border-ocean-300 hover:text-ocean-600'
                                }`}
                            >
                                {c.label}
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                                    category === c.value
                                        ? 'bg-white/20 text-white'
                                        : 'bg-slate-100 text-slate-500'
                                }`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Tabs + quick filter */}
                <div className="flex items-center justify-between border-b border-slate-200 mb-5">
                    <div className="flex">
                        {TABS.map(t => (
                            <button
                                key={t.value}
                                onClick={() => setTab(t.value)}
                                className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                                    tab === t.value
                                        ? 'border-ocean-600 text-ocean-600'
                                        : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => setOnlyOpen(v => !v)}
                        className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors mb-1 ${
                            onlyOpen
                                ? 'bg-ocean-600 text-white border-ocean-600'
                                : 'bg-white border-slate-300 text-slate-500 hover:border-ocean-300 hover:text-ocean-600'
                        }`}
                    >
                        {onlyOpen && <X className="w-3 h-3" />}
                        Solo iscrizioni aperte
                    </button>
                </div>

                {/* Active filter chips + results count — hidden in calendar/map view */}
                {view !== 'calendar' && view !== 'map' && (
                    <div className="flex items-center justify-between mb-4 min-h-[24px]">
                        <div className="flex flex-wrap gap-1.5">
                            {category !== 'all' && (
                                <span className="flex items-center gap-1 bg-ocean-50 text-ocean-700 border border-ocean-200 text-xs px-2.5 py-1 rounded-full">
                                    {categoryLabels[category]}
                                    <button onClick={() => setCategory('all')} className="hover:text-ocean-900">
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            )}
                            {onlyOpen && (
                                <span className="flex items-center gap-1 bg-ocean-50 text-ocean-700 border border-ocean-200 text-xs px-2.5 py-1 rounded-full">
                                    Solo aperte
                                    <button onClick={() => setOnlyOpen(false)} className="hover:text-ocean-900">
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            )}
                            {sort !== 'date-asc' && (
                                <span className="flex items-center gap-1 bg-ocean-50 text-ocean-700 border border-ocean-200 text-xs px-2.5 py-1 rounded-full">
                                    {SORT_OPTIONS.find(o => o.value === sort)?.label}
                                    <button onClick={() => setSort('date-asc')} className="hover:text-ocean-900">
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            )}
                            {hasActiveFilters && (
                                <button
                                    onClick={resetFilters}
                                    className="text-xs text-slate-400 hover:text-slate-600 underline px-1"
                                >
                                    Azzera filtri
                                </button>
                            )}
                        </div>
                        <p className="text-xs text-slate-400 flex-shrink-0">
                            {filtered.length} {filtered.length === 1 ? 'evento' : 'eventi'} trovati
                        </p>
                    </div>
                )}

                {/* ── Calendar view ── */}
                {view === 'calendar' && (
                    <EventCalendar events={filtered} />
                )}

                {/* ── Map view ── */}
                {view === 'map' && (
                    <EventsMap events={filtered} />
                )}

                {/* ── List / Grid view ── */}
                {view !== 'calendar' && view !== 'map' && (
                    filtered.length > 0 ? (
                        view === 'list' ? (
                            <div className="space-y-3">
                                {filtered.map(e => <EventRow key={e.id} event={e} />)}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filtered.map(e => <EventGridCard key={e.id} event={e} />)}
                            </div>
                        )
                    ) : (
                        <div className="text-center py-20 bg-white border border-slate-200 rounded-xl"
                             style={{ boxShadow: '2px 4px 6px 0 #eeeeee' }}>
                            <Search className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                            <p className="text-slate-600 font-medium mb-1">Nessun evento trovato</p>
                            <p className="text-slate-400 text-sm mb-5">
                                {query
                                    ? `Nessun risultato per "${query}"`
                                    : 'Prova a modificare i filtri di ricerca'}
                            </p>
                            <button
                                onClick={resetFilters}
                                className="bg-ocean-600 hover:bg-ocean-700 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
                            >
                                Azzera filtri
                            </button>
                        </div>
                    )
                )}

            </div>
        </main>
    );
}
