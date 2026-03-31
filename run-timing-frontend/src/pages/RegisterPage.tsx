import { useState, useMemo, useCallback } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Check, Download, AlertCircle, Tag } from 'lucide-react';
import { useAdminStore, saveRegistration } from '../hooks/useAdminStore';
import DynamicForm from '../components/registration/DynamicForm';
import type { Race, FormField, PriceStep } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getActivePrice(race: Race): { price: number; label: string } {
    const today = new Date().toISOString().slice(0, 10);
    const steps = (race.priceSteps ?? []).filter(s => s.deadline >= today);
    if (steps.length === 0) return { price: race.price, label: 'Prezzo base' };
    // Cheapest active step
    const best = steps.reduce<PriceStep>((a, b) => b.price < a.price ? b : a, steps[0]);
    return { price: best.price, label: best.label };
}

function formatPrice(n: number) {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('it-IT', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    });
}

// ─── Step indicators ──────────────────────────────────────────────────────────

const STEPS = ['Scelta gara', 'Dati iscrizione', 'Riepilogo', 'Conferma'];

function StepBar({ current }: { current: number }) {
    return (
        <div className="flex items-center justify-center gap-0 mb-8">
            {STEPS.map((label, idx) => (
                <div key={idx} className="flex items-center">
                    <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                            idx < current ? 'bg-ocean-600 text-white'
                            : idx === current ? 'bg-ocean-600 text-white ring-4 ring-ocean-100'
                            : 'bg-slate-200 text-slate-400'
                        }`}>
                            {idx < current ? <Check className="h-4 w-4" /> : idx + 1}
                        </div>
                        <span className={`mt-1.5 text-xs font-medium hidden sm:block ${
                            idx === current ? 'text-ocean-700' : 'text-slate-400'
                        }`}>{label}</span>
                    </div>
                    {idx < STEPS.length - 1 && (
                        <div className={`w-12 sm:w-20 h-0.5 mx-1 transition-colors ${idx < current ? 'bg-ocean-600' : 'bg-slate-200'}`} />
                    )}
                </div>
            ))}
        </div>
    );
}

// ─── Step 1 — Race picker ─────────────────────────────────────────────────────

function RacePicker({
    races,
    selectedId,
    onSelect,
}: {
    races: Race[];
    selectedId: string;
    onSelect: (id: string) => void;
}) {
    const openRaces = races.filter(r => r.isOpen);

    if (openRaces.length === 0) {
        return (
            <div className="text-center py-10">
                <AlertCircle className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500">Nessuna gara con iscrizioni aperte al momento.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {openRaces.map(race => {
                const { price, label: priceLabel } = getActivePrice(race);
                const spotsLeft = race.maxParticipants - race.participants;
                const pct = race.participants / race.maxParticipants;

                return (
                    <button
                        key={race.id}
                        type="button"
                        onClick={() => onSelect(race.id)}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                            selectedId === race.id
                                ? 'border-ocean-500 bg-ocean-50 shadow-md'
                                : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="font-semibold text-slate-800">{race.name}</p>
                                <p className="text-sm text-slate-500 mt-0.5">{race.distance}</p>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="font-bold text-ocean-700 text-lg">{formatPrice(price)}</p>
                                <p className="text-xs text-slate-400">{priceLabel}</p>
                            </div>
                        </div>
                        {/* Quota availability bar */}
                        <div className="mt-3">
                            <div className="flex justify-between text-xs text-slate-400 mb-1">
                                <span>{race.participants} iscritti</span>
                                <span>{spotsLeft} posti rimasti</span>
                            </div>
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all ${pct >= 0.9 ? 'bg-red-400' : pct >= 0.7 ? 'bg-amber-400' : 'bg-teal-500'}`}
                                    style={{ width: `${Math.min(pct * 100, 100)}%` }}
                                />
                            </div>
                        </div>
                        {/* Price steps */}
                        {(race.priceSteps?.length ?? 0) > 1 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {race.priceSteps!.map(step => {
                                    const today = new Date().toISOString().slice(0, 10);
                                    const active = step.deadline >= today;
                                    return (
                                        <span key={step.id} className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                                            active ? 'bg-ocean-100 text-ocean-700' : 'bg-slate-100 text-slate-400 line-through'
                                        }`}>
                                            <Tag className="h-3 w-3" />
                                            {step.label} — {formatPrice(step.price)}
                                            {active && <span className="ml-1 text-slate-400">scade {step.deadline}</span>}
                                        </span>
                                    );
                                })}
                            </div>
                        )}
                    </button>
                );
            })}
        </div>
    );
}

// ─── Step 3 — Summary ─────────────────────────────────────────────────────────

function Summary({
    race,
    fields,
    data,
}: {
    race: Race;
    fields: FormField[];
    data: Record<string, string | boolean>;
}) {
    const { price, label: priceLabel } = getActivePrice(race);

    return (
        <div className="space-y-5">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Distanza selezionata</p>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="font-semibold text-slate-800">{race.name}</p>
                        <p className="text-sm text-slate-500">{race.distance}</p>
                    </div>
                    <div className="text-right">
                        <p className="font-bold text-ocean-700 text-xl">{formatPrice(price)}</p>
                        <p className="text-xs text-slate-400">{priceLabel}</p>
                    </div>
                </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Dati inseriti</p>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                    {fields.filter(f => !f.readOnly).map(field => {
                        const val = data[field.id];
                        if (val === undefined || val === '' || val === false) return null;
                        return (
                            <div key={field.id} className="flex flex-col">
                                <dt className="text-xs text-slate-400">{field.label}</dt>
                                <dd className="text-sm font-medium text-slate-700">
                                    {typeof val === 'boolean' ? (val ? 'Sì' : 'No') : val}
                                </dd>
                            </div>
                        );
                    })}
                </dl>
            </div>
        </div>
    );
}

// ─── Step 4 — Confirmation ────────────────────────────────────────────────────

function Confirmation({ submissionId, raceName, eventTitle, pricePaid }: {
    submissionId: string;
    raceName: string;
    eventTitle: string;
    pricePaid: number;
}) {
    function downloadReceipt() {
        const content = [
            'RICEVUTA DI ISCRIZIONE',
            '======================',
            `N° iscrizione: ${submissionId}`,
            `Evento: ${eventTitle}`,
            `Distanza: ${raceName}`,
            `Importo: ${formatPrice(pricePaid)}`,
            `Data: ${new Date().toLocaleString('it-IT')}`,
            '',
            'Conserva questo documento come conferma di iscrizione.',
        ].join('\n');
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `iscrizione-${submissionId}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }

    return (
        <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Iscrizione confermata!</h2>
            <p className="text-slate-500 mb-1">La tua iscrizione è stata registrata con successo.</p>
            <p className="text-sm text-slate-400 mb-6">N° iscrizione: <span className="font-mono font-medium text-slate-600">{submissionId}</span></p>

            <div className="inline-flex flex-col sm:flex-row gap-3">
                <button
                    type="button"
                    onClick={downloadReceipt}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                    <Download className="h-4 w-4" /> Scarica ricevuta
                </button>
                <Link
                    to="/events"
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-ocean-600 text-white text-sm font-medium hover:bg-ocean-700 transition-colors"
                >
                    Torna agli eventi
                </Link>
            </div>
        </div>
    );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function RegisterPage() {
    const { slug } = useParams<{ slug: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { getEvent } = useAdminStore();

    const event = slug ? getEvent(slug) : undefined;

    const initialRaceId = searchParams.get('race') ?? event?.races[0]?.id ?? '';
    const [step, setStep] = useState(0);
    const [selectedRaceId, setSelectedRaceId] = useState(initialRaceId);
    const [formData, setFormData] = useState<Record<string, string | boolean>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [submissionId, setSubmissionId] = useState('');

    const selectedRace = useMemo(
        () => event?.races.find(r => r.id === selectedRaceId),
        [event, selectedRaceId]
    );
    const fields = useMemo(() => selectedRace?.formSchema ?? [], [selectedRace]);

    const handleFormChange = useCallback((data: Record<string, string | boolean>) => {
        setFormData(data);
    }, []);

    if (!event) {
        return (
            <main className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-slate-500 mb-4">Evento non trovato.</p>
                    <Link to="/events" className="text-ocean-600 hover:underline text-sm">← Torna agli eventi</Link>
                </div>
            </main>
        );
    }

    function validateForm(): boolean {
        const newErrors: Record<string, string> = {};
        for (const field of fields) {
            if (!field.required || field.readOnly) continue;
            const val = formData[field.id];
            if (field.type === 'checkbox') {
                if (!val) newErrors[field.id] = 'Campo obbligatorio';
            } else {
                if (!val || (val as string).trim() === '') {
                    newErrors[field.id] = 'Campo obbligatorio';
                }
            }
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }

    function handleNext() {
        if (step === 0 && !selectedRaceId) return;
        if (step === 1) {
            if (!validateForm()) return;
        }
        if (step === 2) {
            // Submit
            if (!selectedRace || !event) return;
            const { price } = getActivePrice(selectedRace);
            const id = `reg_${Date.now()}`;
            saveRegistration({
                id,
                eventId: event.id,
                raceId: selectedRaceId,
                submittedAt: new Date().toISOString(),
                formData,
                pricePaid: price,
            });
            setSubmissionId(id);
        }
        setStep(s => s + 1);
    }

    function handleBack() {
        if (step === 0) navigate(`/events/${slug}`);
        else setStep(s => s - 1);
    }

    return (
        <main className="min-h-screen bg-slate-50 py-8 px-4">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <Link
                        to={`/events/${slug}`}
                        className="flex items-center gap-1 text-sm text-slate-400 hover:text-ocean-600 transition-colors mb-2"
                    >
                        <ChevronLeft className="h-4 w-4" /> {event.title}
                    </Link>
                    <h1 className="text-2xl font-bold text-slate-800">Iscrizione</h1>
                    <p className="text-slate-500 text-sm mt-0.5">{formatDate(event.date)} · {event.city}</p>
                </div>

                {step < 3 && <StepBar current={step} />}

                {/* Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-7">
                    {step === 0 && (
                        <RacePicker
                            races={event.races}
                            selectedId={selectedRaceId}
                            onSelect={setSelectedRaceId}
                        />
                    )}

                    {step === 1 && selectedRace && (
                        <div>
                            <h2 className="font-semibold text-slate-700 text-base mb-4">{selectedRace.name}</h2>
                            {fields.length === 0 ? (
                                <p className="text-slate-400 text-sm italic">Nessun dato richiesto per questa gara.</p>
                            ) : (
                                <DynamicForm
                                    fields={fields}
                                    data={formData}
                                    onChange={handleFormChange}
                                    errors={errors}
                                />
                            )}
                        </div>
                    )}

                    {step === 2 && selectedRace && (
                        <Summary race={selectedRace} fields={fields} data={formData} />
                    )}

                    {step === 3 && selectedRace && (
                        <Confirmation
                            submissionId={submissionId}
                            raceName={selectedRace.name}
                            eventTitle={event.title}
                            pricePaid={getActivePrice(selectedRace).price}
                        />
                    )}
                </div>

                {/* Nav buttons */}
                {step < 3 && (
                    <div className="flex items-center justify-between mt-5">
                        <button
                            type="button"
                            onClick={handleBack}
                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-slate-300 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            {step === 0 ? 'Indietro' : 'Modifica'}
                        </button>
                        <button
                            type="button"
                            onClick={handleNext}
                            disabled={step === 0 && !selectedRaceId}
                            className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-ocean-600 text-white text-sm font-semibold hover:bg-ocean-700 disabled:opacity-40 transition-colors"
                        >
                            {step === 2 ? 'Conferma iscrizione' : 'Continua'}
                            {step < 2 && <ChevronRight className="h-4 w-4" />}
                        </button>
                    </div>
                )}
            </div>
        </main>
    );
}
