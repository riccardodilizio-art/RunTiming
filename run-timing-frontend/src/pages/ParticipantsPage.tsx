import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, Users, Eye } from 'lucide-react';
import { useAdminStore, loadRegistrations } from '../hooks/useAdminStore';
import { categoryLabels, categoryColors } from '../data/mockEvents';
import type { FormField } from '../types';

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('it-IT', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    });
}

export default function ParticipantsPage() {
    const { slug } = useParams<{ slug: string }>();
    const { getEvent } = useAdminStore();
    const event = getEvent(slug ?? '');

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

    const allRegistrations = loadRegistrations().filter(r => r.eventId === event.id);

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

            <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
                {event.races.map(race => {
                    const raceRegs = allRegistrations.filter(r => r.raceId === race.id);
                    const publicFieldIds = race.publicFields ?? [];
                    const visibleFields: FormField[] = (race.formSchema ?? []).filter(
                        f => !f.readOnly && publicFieldIds.includes(f.id)
                    );

                    // Se non ci sono campi pubblici configurati, non mostrare la sezione
                    if (publicFieldIds.length === 0) return null;

                    return (
                        <div key={race.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden"
                            style={{ boxShadow: '2px 4px 6px 0 #eeeeee' }}>
                            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                                <div>
                                    <h2 className="font-semibold text-slate-800">{race.name}</h2>
                                    <p className="text-sm text-slate-400 mt-0.5">{race.distance}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="flex items-center gap-1.5 text-sm text-slate-500">
                                        <Users className="h-4 w-4" />
                                        {raceRegs.length} iscritti
                                    </span>
                                    <span className="flex items-center gap-1 text-xs text-ocean-500">
                                        <Eye className="h-3.5 w-3.5" />
                                        {visibleFields.length} campi visibili
                                    </span>
                                </div>
                            </div>

                            {raceRegs.length === 0 ? (
                                <div className="px-5 py-8 text-center text-slate-400 text-sm">
                                    Nessun iscritto per questa gara.
                                </div>
                            ) : visibleFields.length === 0 ? (
                                <div className="px-5 py-8 text-center text-slate-400 text-sm">
                                    {raceRegs.length} iscritti — nessuna informazione pubblica configurata.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-100 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                                <th className="px-4 py-3">#</th>
                                                {visibleFields.map(f => (
                                                    <th key={f.id} className="px-4 py-3">{f.label}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {raceRegs.map((reg, idx) => (
                                                <tr key={reg.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-4 py-3 text-slate-400 font-medium">{idx + 1}</td>
                                                    {visibleFields.map(f => (
                                                        <td key={f.id} className="px-4 py-3 text-slate-700">
                                                            {typeof reg.formData[f.id] === 'boolean'
                                                                ? (reg.formData[f.id] ? 'Sì' : 'No')
                                                                : (reg.formData[f.id] as string) || '—'}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Se tutte le gare non hanno campi pubblici */}
                {event.races.every(r => !r.publicFields?.length) && (
                    <div className="text-center py-16 text-slate-400">
                        <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        <p className="text-base font-medium">Lista iscritti non disponibile</p>
                        <p className="text-sm mt-1">L'organizzatore non ha reso pubblici i dati degli iscritti.</p>
                        <Link to={`/events/${event.slug}`} className="mt-4 inline-block text-ocean-600 hover:underline text-sm">
                            ← Torna all'evento
                        </Link>
                    </div>
                )}
            </div>
        </main>
    );
}
