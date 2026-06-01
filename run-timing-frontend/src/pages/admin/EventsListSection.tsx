import { useState, useMemo } from 'react';
import {
    Plus, Edit2, Trash2, Calendar, MapPin, Image, Search,
    LayoutList, LayoutGrid, X, SlidersHorizontal, ChevronDown,
} from 'lucide-react';
import { categoryLabels, categoryColors } from '../../data/mockEvents';
import type { Event, SportCategory } from '../../types';

// ─── Admin event cards ────────────────────────────────────────────────────────

function AdminEventRow({
    event, onEdit, onDelete,
}: {
    event: Event;
    onEdit: () => void;
    onDelete?: () => void;
}) {
    const prices = event.races.map(r => r.price);
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const priceStr = prices.length === 0 ? '—' : minP === maxP ? `€${minP}` : `€${minP} – €${maxP}`;
    const hasOpenRaces = event.races.some(r => r.isOpen);
    const isPast = new Date(event.date) < new Date();

    return (
        <div className="group flex items-center gap-4 bg-white border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors"
             style={{ boxShadow: '2px 4px 6px 0 #eeeeee' }}>
            <div className="w-16 h-16 rounded-md overflow-hidden flex-shrink-0 bg-slate-100">
                {event.coverImage
                    ? <img src={event.coverImage} alt={event.title} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center bg-ocean-50">
                        <Image className="w-6 h-6 text-ocean-200" />
                      </div>
                }
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                    <span className="flex items-center gap-1 text-xs text-ocean-600 font-medium">
                        <Calendar className="w-3 h-3" />
                        {new Date(event.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                    {event.isLive && (
                        <span className="flex items-center gap-1 bg-red-50 text-red-500 text-xs font-bold px-2 py-0.5 rounded-full border border-red-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />LIVE
                        </span>
                    )}
                    {event.isFeatured && (
                        <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">In evidenza</span>
                    )}
                </div>
                <p className="font-semibold text-slate-800 text-sm leading-snug truncate">{event.title}</p>
                <div className="flex flex-wrap items-center gap-3 mt-0.5">
                    <span className="flex items-center gap-1 text-slate-400 text-xs">
                        <MapPin className="w-3 h-3" />{event.city}{event.province ? ` (${event.province})` : ''}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded border ${categoryColors[event.category]}`}>
                        {categoryLabels[event.category]}
                    </span>
                    <span className="text-slate-400 text-xs">{event.races.length} distanze</span>
                </div>
            </div>
            <div className="flex-shrink-0 flex flex-col items-end gap-2">
                <div className="text-right">
                    <span className="font-semibold text-ocean-700 text-sm">{priceStr}</span>
                    <div className="text-xs mt-0.5">
                        {isPast ? (
                            <span className="text-slate-400">Concluso</span>
                        ) : hasOpenRaces ? (
                            <span className="text-emerald-600 font-medium">Aperto</span>
                        ) : (
                            <span className="text-slate-400">Chiuso</span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={onEdit}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-ocean-600 text-white text-xs font-medium hover:bg-ocean-700 transition-colors"
                    >
                        <Edit2 className="h-3.5 w-3.5" /> Gestisci
                    </button>
                    {onDelete && (
                        <button
                            type="button"
                            onClick={onDelete}
                            className="p-1.5 rounded hover:bg-red-50 transition-colors"
                        >
                            <Trash2 className="h-4 w-4 text-red-400" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

function AdminEventGridCard({
    event, onEdit, onDelete,
}: {
    event: Event;
    onEdit: () => void;
    onDelete?: () => void;
}) {
    const prices = event.races.map(r => r.price);
    const minP = prices.length ? Math.min(...prices) : 0;
    const maxP = prices.length ? Math.max(...prices) : 0;
    const hasOpenRaces = event.races.some(r => r.isOpen);
    const isPast = new Date(event.date) < new Date();

    return (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 hover:shadow-md transition-all flex flex-col">
            <div className="relative aspect-video overflow-hidden bg-slate-100">
                {event.coverImage
                    ? <img src={event.coverImage} alt={event.title} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center">
                        <Image className="w-10 h-10 text-slate-200" />
                      </div>
                }
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
                <div className="absolute top-2 left-2 flex items-center gap-1.5">
                    <span className={`text-xs px-2 py-0.5 rounded border backdrop-blur-sm ${categoryColors[event.category]}`}>
                        {categoryLabels[event.category]}
                    </span>
                    {event.isLive && (
                        <span className="flex items-center gap-1 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />LIVE
                        </span>
                    )}
                </div>
                {event.isFeatured && (
                    <span className="absolute top-2 right-2 text-xs px-1.5 py-0.5 bg-amber-400 text-amber-900 rounded font-semibold">★</span>
                )}
            </div>
            <div className="p-4 flex flex-col flex-1">
                <p className="font-semibold text-slate-800 text-sm leading-snug line-clamp-2 mb-2">{event.title}</p>
                <div className="space-y-1 mb-3">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Calendar className="w-3 h-3 text-ocean-400 flex-shrink-0" />
                        {new Date(event.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <MapPin className="w-3 h-3 text-ocean-400 flex-shrink-0" />
                        {event.city}{event.province ? ` (${event.province})` : ''}
                    </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 mb-3">
                    <div>
                        <span className="font-semibold text-ocean-700 text-sm">
                            {prices.length === 0 ? '—' : minP === maxP ? `€${minP}` : `€${minP} – €${maxP}`}
                        </span>
                        <span className="text-slate-400 text-xs ml-1.5">{event.races.length} gare</span>
                    </div>
                    {isPast ? (
                        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">Concluso</span>
                    ) : hasOpenRaces ? (
                        <span className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg font-medium">Aperto</span>
                    ) : (
                        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">Chiuso</span>
                    )}
                </div>
                <div className="flex items-center gap-2 mt-auto">
                    <button
                        type="button"
                        onClick={onEdit}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-ocean-600 text-white text-xs font-medium hover:bg-ocean-700 transition-colors"
                    >
                        <Edit2 className="h-3.5 w-3.5" /> Gestisci
                    </button>
                    {onDelete && (
                        <button
                            type="button"
                            onClick={onDelete}
                            className="p-2 rounded-lg hover:bg-red-50 border border-slate-200 transition-colors"
                        >
                            <Trash2 className="h-4 w-4 text-red-400" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── EventsListSection ────────────────────────────────────────────────────────

type EventView = 'list' | 'grid';
type EventTab  = 'upcoming' | 'all' | 'past';
type EventSort = 'date-asc' | 'date-desc' | 'name-asc' | 'popular';

const EVENT_TABS: { value: EventTab; label: string }[] = [
    { value: 'upcoming', label: 'Prossimi' },
    { value: 'all',      label: 'Tutti' },
    { value: 'past',     label: 'Passati' },
];

const EVENT_SORT_OPTIONS: { value: EventSort; label: string }[] = [
    { value: 'date-asc',  label: 'Data (più vicina)' },
    { value: 'date-desc', label: 'Data (più lontana)' },
    { value: 'name-asc',  label: 'Nome A→Z' },
    { value: 'popular',   label: 'Più popolari' },
];

const EVENT_CATEGORIES: { value: SportCategory | 'all'; label: string }[] = [
    { value: 'all',       label: 'Tutti' },
    { value: 'running',   label: 'Running' },
    { value: 'cycling',   label: 'Ciclismo' },
    { value: 'triathlon', label: 'Triathlon' },
    { value: 'trail',     label: 'Trail' },
    { value: 'swimming',  label: 'Nuoto' },
    { value: 'other',     label: 'Altro' },
];

export default function EventsListSection({
    events,
    isAdmin,
    onEdit,
    onDelete,
    onCreate,
}: {
    events: Event[];
    isAdmin: boolean;
    onEdit: (id: string) => void;
    onDelete: (id: string) => void;
    onCreate: () => void;
}) {
    const [query,    setQuery]    = useState('');
    const [category, setCategory] = useState<SportCategory | 'all'>('all');
    const [tab,      setTab]      = useState<EventTab>('upcoming');
    const [sort,     setSort]     = useState<EventSort>('date-asc');
    const [onlyOpen, setOnlyOpen] = useState(false);
    const [view,     setView]     = useState<EventView>('list');

    const now = new Date();

    const filtered = useMemo(() => {
        return events
            .filter(e => {
                const q = query.toLowerCase();
                const matchesQuery = !q ||
                    e.title.toLowerCase().includes(q) ||
                    e.city.toLowerCase().includes(q) ||
                    e.organizer.toLowerCase().includes(q);
                const matchesCat  = category === 'all' || e.category === category;
                const matchesTab  = tab === 'all' ? true
                    : tab === 'upcoming' ? new Date(e.date) >= now
                    : new Date(e.date) < now;
                const matchesOpen = !onlyOpen || e.races.some(r => r.isOpen);
                return matchesQuery && matchesCat && matchesTab && matchesOpen;
            })
            .sort((a, b) => {
                switch (sort) {
                    case 'date-asc':  return new Date(a.date).getTime() - new Date(b.date).getTime();
                    case 'date-desc': return new Date(b.date).getTime() - new Date(a.date).getTime();
                    case 'name-asc':  return a.title.localeCompare(b.title, 'it');
                    case 'popular':   return b.races.reduce((s, r) => s + r.participants, 0)
                                           - a.races.reduce((s, r) => s + r.participants, 0);
                }
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [events, query, category, tab, sort, onlyOpen]);

    const countFor = (cat: SportCategory | 'all') =>
        events.filter(e => {
            const matchesTab = tab === 'all' ? true
                : tab === 'upcoming' ? new Date(e.date) >= now
                : new Date(e.date) < now;
            return matchesTab && (cat === 'all' || e.category === cat);
        }).length;

    const hasActiveFilters = category !== 'all' || onlyOpen || sort !== 'date-asc';

    function resetFilters() {
        setQuery('');
        setCategory('all');
        setOnlyOpen(false);
        setSort('date-asc');
    }

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Gare ed eventi</h1>
                    <p className="text-slate-500 text-sm mt-0.5">{events.length} eventi totali</p>
                </div>
                {isAdmin && (
                    <button
                        type="button"
                        onClick={onCreate}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ocean-600 text-white text-sm font-medium hover:bg-ocean-700 transition-colors"
                    >
                        <Plus className="h-4 w-4" /> Nuovo evento
                    </button>
                )}
            </div>

            {/* Search + sort + view toggle */}
            <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Cerca per nome, città, organizzatore..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        className="w-full bg-white border border-slate-300 focus:border-ocean-400 focus:outline-none rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 transition-colors"
                    />
                    {query && (
                        <button onClick={() => setQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
                <div className="relative">
                    <SlidersHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                    <select
                        value={sort}
                        onChange={e => setSort(e.target.value as EventSort)}
                        className="appearance-none bg-white border border-slate-300 rounded-lg pl-8 pr-8 py-2.5 text-sm text-slate-600 focus:outline-none focus:border-ocean-400 cursor-pointer"
                    >
                        {EVENT_SORT_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>
                </div>
                <div className="flex bg-white border border-slate-300 rounded-lg overflow-hidden">
                    <button
                        onClick={() => setView('list')}
                        className={`px-3 py-2.5 transition-colors ${view === 'list' ? 'bg-ocean-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}
                        title="Vista lista"
                    >
                        <LayoutList className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setView('grid')}
                        className={`px-3 py-2.5 border-l border-slate-200 transition-colors ${view === 'grid' ? 'bg-ocean-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}
                        title="Vista griglia"
                    >
                        <LayoutGrid className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Category pills */}
            <div className="flex flex-wrap gap-2 mb-4">
                {EVENT_CATEGORIES.map(c => {
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
                                category === c.value ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                            }`}>
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Tabs + only-open toggle */}
            <div className="flex items-center justify-between border-b border-slate-200 mb-4">
                <div className="flex">
                    {EVENT_TABS.map(t => (
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

            {/* Active filters + count */}
            <div className="flex items-center justify-between mb-4 min-h-[24px]">
                <div className="flex flex-wrap gap-1.5">
                    {category !== 'all' && (
                        <span className="flex items-center gap-1 bg-ocean-50 text-ocean-700 border border-ocean-200 text-xs px-2.5 py-1 rounded-full">
                            {categoryLabels[category as SportCategory]}
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
                    {hasActiveFilters && (
                        <button onClick={resetFilters}
                            className="text-xs text-slate-400 hover:text-slate-600 underline px-1">
                            Azzera filtri
                        </button>
                    )}
                </div>
                <p className="text-xs text-slate-400 flex-shrink-0">
                    {filtered.length} {filtered.length === 1 ? 'evento' : 'eventi'}
                </p>
            </div>

            {/* Results */}
            {filtered.length === 0 ? (
                <div className="text-center py-16 bg-white border border-slate-200 rounded-xl">
                    <Search className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-600 font-medium mb-1">Nessun evento trovato</p>
                    <p className="text-slate-400 text-sm mb-4">
                        {query ? `Nessun risultato per "${query}"` : 'Prova a modificare i filtri'}
                    </p>
                    <button onClick={resetFilters}
                        className="bg-ocean-600 hover:bg-ocean-700 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors">
                        Azzera filtri
                    </button>
                </div>
            ) : view === 'list' ? (
                <div className="space-y-3">
                    {filtered.map(e => (
                        <AdminEventRow
                            key={e.id}
                            event={e}
                            onEdit={() => onEdit(e.id)}
                            onDelete={isAdmin ? () => onDelete(e.id) : undefined}
                        />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map(e => (
                        <AdminEventGridCard
                            key={e.id}
                            event={e}
                            onEdit={() => onEdit(e.id)}
                            onDelete={isAdmin ? () => onDelete(e.id) : undefined}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
