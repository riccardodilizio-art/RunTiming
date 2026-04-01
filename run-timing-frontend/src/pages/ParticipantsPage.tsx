import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, Users, Eye, Search, X } from 'lucide-react';
import { useAdminStore, loadRegistrations } from '../hooks/useAdminStore';
import { categoryLabels, categoryColors } from '../data/mockEvents';
import type { FormField, RegistrationSubmission } from '../types';

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('it-IT', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    });
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

interface Filters {
    text: string;
    category: string;
    societa: string;
}

function FilterBar({
    filters,
    onChange,
    categoryOptions,
    societaOptions,
    total,
    filtered,
}: {
    filters: Filters;
    onChange: (f: Filters) => void;
    categoryOptions: string[];
    societaOptions: string[];
    total: number;
    filtered: number;
}) {
    const hasFilters = filters.text || filters.category || filters.societa;

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5"
             style={{ boxShadow: '2px 4px 6px 0 #eeeeee' }}>
            <div className="flex flex-wrap gap-3 items-end">
                {/* Testo libero */}
                <div className="flex-1 min-w-[180px]">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Cerca</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                        <input
                            type="text"
                            value={filters.text}
                            onChange={e => onChange({ ...filters, text: e.target.value })}
                            placeholder="Cognome, nome, città..."
                            className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-ocean-500"
                        />
                    </div>
                </div>

                {/* Categoria */}
                {categoryOptions.length > 0 && (
                    <div className="min-w-[160px]">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Categoria</label>
                        <select
                            value={filters.category}
                            onChange={e => onChange({ ...filters, category: e.target.value })}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ocean-500"
                        >
                            <option value="">Tutte le categorie</option>
                            {categoryOptions.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Società */}
                {societaOptions.length > 0 && (
                    <div className="min-w-[180px]">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Società</label>
                        <select
                            value={filters.societa}
                            onChange={e => onChange({ ...filters, societa: e.target.value })}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ocean-500"
                        >
                            <option value="">Tutte le società</option>
                            {societaOptions.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Reset */}
                {hasFilters && (
                    <button
                        onClick={() => onChange({ text: '', category: '', societa: '' })}
                        className="flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200 text-slate-500 text-sm hover:bg-slate-50 transition-colors"
                    >
                        <X className="h-3.5 w-3.5" /> Azzera
                    </button>
                )}

                <span className="text-xs text-slate-400 ml-auto self-end pb-2">
                    {filtered === total
                        ? `${total} iscritti`
                        : `${filtered} di ${total} iscritti`}
                </span>
            </div>
        </div>
    );
}

// ─── Per-race table ───────────────────────────────────────────────────────────

function RaceTable({
    visibleFields,
    registrations,
}: {
    visibleFields: FormField[];
    registrations: RegistrationSubmission[];
}) {
    const showCategory = registrations.some(r => r.assignedCategory);

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        <th className="px-4 py-3">#</th>
                        {visibleFields.map(f => (
                            <th key={f.id} className="px-4 py-3">{f.label}</th>
                        ))}
                        {showCategory && <th className="px-4 py-3">Categoria</th>}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {registrations.map((reg, idx) => (
                        <tr key={reg.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3 text-slate-400 font-medium">{idx + 1}</td>
                            {visibleFields.map(f => (
                                <td key={f.id} className="px-4 py-3 text-slate-700">
                                    {typeof reg.formData[f.id] === 'boolean'
                                        ? (reg.formData[f.id] ? 'Sì' : 'No')
                                        : (reg.formData[f.id] as string) || '—'}
                                </td>
                            ))}
                            {showCategory && (
                                <td className="px-4 py-3">
                                    {reg.assignedCategory ? (
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-ocean-100 text-ocean-700 font-medium">
                                            {reg.assignedCategory}
                                        </span>
                                    ) : '—'}
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ParticipantsPage() {
    const { slug } = useParams<{ slug: string }>();
    const { getEvent } = useAdminStore();
    const event = getEvent(slug ?? '');

    const [filters, setFilters] = useState<Filters>({ text: '', category: '', societa: '' });

    const allRegistrations = useMemo(
        () => loadRegistrations().filter(r => r.eventId === event?.id),
        [event?.id]
    );

    // Collect all unique categories and società across all races for the filter dropdowns
    const allCategories = useMemo(() => {
        const set = new Set<string>();
        allRegistrations.forEach(r => { if (r.assignedCategory) set.add(r.assignedCategory); });
        return Array.from(set).sort();
    }, [allRegistrations]);

    const allSocieta = useMemo(() => {
        if (!event) return [];
        const set = new Set<string>();
        allRegistrations.forEach(reg => {
            event.races.forEach(race => {
                const socField = (race.formSchema ?? []).find(f => f.catalogKey === 'societa');
                if (socField) {
                    const val = reg.formData[socField.id] as string | undefined;
                    if (val?.trim()) set.add(val.trim());
                }
            });
        });
        return Array.from(set).sort();
    }, [allRegistrations, event]);

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

    // Races with at least one public field
    const publicRaces = event.races.filter(r => r.publicFields && r.publicFields.length > 0);

    // Total across public races
    const totalPublicRegs = allRegistrations.filter(r =>
        publicRaces.some(pr => pr.id === r.raceId)
    ).length;

    return (
        <main className="min-h-screen bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200">
                <div className="max-w-5xl mx-auto px-4 py-5">
                    <Link
                        to={`/events/${event.slug}`}
                        className="inline-flex items-center gap-1 text-slate-400 hover:text-ocean-600 text-sm mb-3 transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" /> Torna all'evento
                    </Link>
                    <div className="flex items-start gap-3 flex-wrap">
                        <span className={`text-xs px-2.5 py-1 rounded border ${categoryColors[event.category]}`}>
                            {categoryLabels[event.category]}
                        </span>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800">{event.title}</h1>
                            <p className="text-slate-500 text-sm mt-0.5 capitalize">
                                {formatDate(event.date)} · {event.city} ({event.province})
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 py-8">

                {publicRaces.length === 0 ? (
                    <div className="text-center py-16 text-slate-400">
                        <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        <p className="text-base font-medium">Lista iscritti non disponibile</p>
                        <p className="text-sm mt-1">L'organizzatore non ha reso pubblici i dati degli iscritti.</p>
                        <Link to={`/events/${event.slug}`} className="mt-4 inline-block text-ocean-600 hover:underline text-sm">
                            ← Torna all'evento
                        </Link>
                    </div>
                ) : (
                    <>
                        {/* Filter bar — shared across all races */}
                        <FilterBar
                            filters={filters}
                            onChange={setFilters}
                            categoryOptions={allCategories}
                            societaOptions={allSocieta}
                            total={totalPublicRegs}
                            filtered={(() => {
                                // count filtered across all public races
                                return publicRaces.reduce((acc, race) => {
                                    const visibleFields = (race.formSchema ?? []).filter(
                                        f => !f.readOnly && (race.publicFields ?? []).includes(f.id)
                                    );
                                    const raceRegs = allRegistrations.filter(r => r.raceId === race.id);
                                    return acc + applyFilters(raceRegs, visibleFields, filters).length;
                                }, 0);
                            })()}
                        />

                        {/* Per-race sections */}
                        <div className="space-y-8">
                            {publicRaces.map(race => {
                                const raceRegs = allRegistrations.filter(r => r.raceId === race.id);
                                const visibleFields: FormField[] = (race.formSchema ?? []).filter(
                                    f => !f.readOnly && (race.publicFields ?? []).includes(f.id)
                                );
                                const filtered = applyFilters(raceRegs, visibleFields, filters);

                                return (
                                    <div key={race.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden"
                                        style={{ boxShadow: '2px 4px 6px 0 #eeeeee' }}>
                                        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                                            <div>
                                                <h2 className="font-semibold text-slate-800">{race.name}</h2>
                                                <p className="text-sm text-slate-400 mt-0.5">{race.distance}</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="flex items-center gap-1.5 text-sm text-slate-500">
                                                    <Users className="h-4 w-4" />
                                                    {filtered.length}
                                                    {filtered.length !== raceRegs.length && (
                                                        <span className="text-slate-400">/ {raceRegs.length}</span>
                                                    )}
                                                    <span className="text-slate-400">iscritti</span>
                                                </span>
                                                <span className="flex items-center gap-1 text-xs text-ocean-500">
                                                    <Eye className="h-3.5 w-3.5" />
                                                    {visibleFields.length} campi
                                                </span>
                                            </div>
                                        </div>

                                        {filtered.length === 0 ? (
                                            <div className="px-5 py-8 text-center text-slate-400 text-sm">
                                                {raceRegs.length === 0
                                                    ? 'Nessun iscritto per questa gara.'
                                                    : 'Nessun iscritto corrisponde ai filtri applicati.'}
                                            </div>
                                        ) : (
                                            <RaceTable
                                                visibleFields={visibleFields}
                                                registrations={filtered}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </main>
    );
}

// ─── Filter logic ─────────────────────────────────────────────────────────────

function applyFilters(
    regs: RegistrationSubmission[],
    visibleFields: FormField[],
    filters: Filters
): RegistrationSubmission[] {
    return regs.filter(reg => {
        // Category filter
        if (filters.category && reg.assignedCategory !== filters.category) return false;

        // Società filter — search in any field with catalogKey 'societa'
        if (filters.societa) {
            const socField = visibleFields.find(f => f.catalogKey === 'societa');
            if (!socField) return false;
            const val = (reg.formData[socField.id] as string | undefined) ?? '';
            if (!val.toLowerCase().includes(filters.societa.toLowerCase())) return false;
        }

        // Free text — search across all visible text fields
        if (filters.text) {
            const q = filters.text.toLowerCase();
            const matched = visibleFields.some(f => {
                const val = reg.formData[f.id];
                if (typeof val === 'string') return val.toLowerCase().includes(q);
                return false;
            });
            if (!matched) return false;
        }

        return true;
    });
}
