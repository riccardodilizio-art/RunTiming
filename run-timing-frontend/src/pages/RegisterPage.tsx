import { useState, useMemo, useCallback } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import {
    ChevronLeft, ChevronRight, Check, Download, AlertCircle, Tag,
    CreditCard, X, Percent, Euro,
} from 'lucide-react';
import { useAdminStore, saveRegistration } from '../hooks/useAdminStore';
import DynamicForm from '../components/registration/DynamicForm';
import type { Race, FormField, PriceStep, DiscountCode } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getActivePrice(race: Race): { price: number; label: string } {
    const today = new Date().toISOString().slice(0, 10);
    const steps = (race.priceSteps ?? []).filter(s => s.deadline >= today);
    if (steps.length === 0) return { price: race.price, label: 'Prezzo base' };
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

function calcDiscount(basePrice: number, code: DiscountCode): number {
    if (code.type === 'fixed') return Math.min(code.value, basePrice);
    return Math.round((basePrice * code.value / 100) * 100) / 100;
}

// ─── Step indicators ──────────────────────────────────────────────────────────

const STEPS = ['Scelta gara', 'Dati iscrizione', 'Riepilogo', 'Pagamento', 'Conferma'];

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
                        <div className={`w-10 sm:w-16 h-0.5 mx-1 transition-colors ${idx < current ? 'bg-ocean-600' : 'bg-slate-200'}`} />
                    )}
                </div>
            ))}
        </div>
    );
}

// ─── Step 1 — Race picker ─────────────────────────────────────────────────────

function RacePicker({ races, selectedId, onSelect }: { races: Race[]; selectedId: string; onSelect: (id: string) => void }) {
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
                            selectedId === race.id ? 'border-ocean-500 bg-ocean-50 shadow-md' : 'border-slate-200 hover:border-slate-300 bg-white'
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
                        {(race.priceSteps?.length ?? 0) > 1 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {race.priceSteps!.map(step => {
                                    const today = new Date().toISOString().slice(0, 10);
                                    const active = step.deadline >= today;
                                    return (
                                        <span key={step.id} className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${active ? 'bg-ocean-100 text-ocean-700' : 'bg-slate-100 text-slate-400 line-through'}`}>
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

// ─── Step 3 — Summary + discount code ────────────────────────────────────────

function Summary({
    race, fields, data,
    appliedDiscount, onApplyDiscount, validateCode,
}: {
    race: Race;
    fields: FormField[];
    data: Record<string, string | boolean>;
    appliedDiscount: DiscountCode | null;
    onApplyDiscount: (code: DiscountCode | null) => void;
    validateCode: (code: string) => DiscountCode | null;
}) {
    const { price, label: priceLabel } = getActivePrice(race);
    const [codeInput, setCodeInput] = useState('');
    const [codeError, setCodeError] = useState('');

    function handleApplyCode() {
        const result = validateCode(codeInput.trim());
        if (!result) {
            setCodeError('Codice non valido, scaduto o esaurito.');
            return;
        }
        setCodeError('');
        onApplyDiscount(result);
        setCodeInput('');
    }

    const discountAmount = appliedDiscount ? calcDiscount(price, appliedDiscount) : 0;
    const finalPrice = Math.max(0, price - discountAmount);

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

            {/* Codice sconto */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Codice sconto</p>
                {appliedDiscount ? (
                    <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                            <Tag className="h-4 w-4 text-green-600" />
                            <span className="font-mono font-semibold text-green-800">{appliedDiscount.code}</span>
                            <span className="text-sm text-green-600">
                                {appliedDiscount.type === 'fixed'
                                    ? `− ${formatPrice(discountAmount)}`
                                    : `− ${appliedDiscount.value}% (${formatPrice(discountAmount)})`}
                            </span>
                        </div>
                        <button onClick={() => onApplyDiscount(null)} className="p-1 rounded hover:bg-green-100">
                            <X className="h-4 w-4 text-green-600" />
                        </button>
                    </div>
                ) : (
                    <div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={codeInput}
                                onChange={e => { setCodeInput(e.target.value.toUpperCase()); setCodeError(''); }}
                                onKeyDown={e => e.key === 'Enter' && handleApplyCode()}
                                placeholder="Inserisci codice promo"
                                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-ocean-500 uppercase"
                            />
                            <button
                                type="button"
                                onClick={handleApplyCode}
                                disabled={!codeInput.trim()}
                                className="px-4 py-2 rounded-lg bg-ocean-600 text-white text-sm font-medium hover:bg-ocean-700 disabled:opacity-40 transition-colors"
                            >
                                Applica
                            </button>
                        </div>
                        {codeError && <p className="text-xs text-red-500 mt-1">{codeError}</p>}
                    </div>
                )}
            </div>

            {/* Totale */}
            <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="bg-white divide-y divide-slate-100">
                    <div className="flex justify-between px-4 py-3 text-sm">
                        <span className="text-slate-500">Quota iscrizione</span>
                        <span className="font-medium text-slate-800">{formatPrice(price)}</span>
                    </div>
                    {discountAmount > 0 && (
                        <div className="flex justify-between px-4 py-3 text-sm">
                            <span className="text-green-600 flex items-center gap-1">
                                <Tag className="h-3.5 w-3.5" /> Sconto codice promo
                            </span>
                            <span className="font-medium text-green-600">− {formatPrice(discountAmount)}</span>
                        </div>
                    )}
                    <div className="flex justify-between px-4 py-3 bg-slate-50">
                        <span className="font-semibold text-slate-800">Totale</span>
                        <span className="font-bold text-ocean-700 text-lg">{formatPrice(finalPrice)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Step 4 — Payment ─────────────────────────────────────────────────────────

type PaymentMethod = 'paypal' | 'card' | 'free';

function PaymentStep({
    totalPrice,
    method,
    onMethodChange,
}: {
    totalPrice: number;
    method: PaymentMethod;
    onMethodChange: (m: PaymentMethod) => void;
}) {
    const isFree = totalPrice <= 0;

    return (
        <div className="space-y-5">
            {/* Amount due */}
            <div className="bg-ocean-50 rounded-xl p-4 border border-ocean-200 flex items-center justify-between">
                <span className="font-semibold text-slate-700">Importo da pagare</span>
                <span className="text-2xl font-bold text-ocean-700">
                    {isFree ? 'Gratuito' : formatPrice(totalPrice)}
                </span>
            </div>

            {isFree ? (
                <div className="text-center py-6 text-slate-500 text-sm">
                    <Check className="h-10 w-10 text-green-500 mx-auto mb-2" />
                    Nessun pagamento richiesto. Prosegui per confermare l'iscrizione.
                </div>
            ) : (
                <div className="space-y-3">
                    <p className="text-sm font-medium text-slate-700">Seleziona metodo di pagamento</p>

                    {/* PayPal */}
                    <button
                        type="button"
                        onClick={() => onMethodChange('paypal')}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
                            method === 'paypal' ? 'border-ocean-500 bg-ocean-50' : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                    >
                        <div className="w-10 h-10 bg-[#003087] rounded-lg flex items-center justify-center flex-shrink-0">
                            <span className="text-white font-bold text-sm">PP</span>
                        </div>
                        <div>
                            <p className="font-semibold text-slate-800">PayPal</p>
                            <p className="text-xs text-slate-400">Paga con il tuo account PayPal</p>
                        </div>
                        {method === 'paypal' && <Check className="h-5 w-5 text-ocean-600 ml-auto" />}
                    </button>

                    {/* Card */}
                    <button
                        type="button"
                        onClick={() => onMethodChange('card')}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
                            method === 'card' ? 'border-ocean-500 bg-ocean-50' : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                    >
                        <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0">
                            <CreditCard className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <p className="font-semibold text-slate-800">Carta di credito / debito</p>
                            <p className="text-xs text-slate-400">Visa, Mastercard, American Express</p>
                        </div>
                        {method === 'card' && <Check className="h-5 w-5 text-ocean-600 ml-auto" />}
                    </button>

                    {/* Card form (shown when card selected) */}
                    {method === 'card' && (
                        <div className="mt-2 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Numero carta</label>
                                <input
                                    type="text"
                                    maxLength={19}
                                    placeholder="1234 5678 9012 3456"
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ocean-500"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Scadenza</label>
                                    <input
                                        type="text"
                                        maxLength={5}
                                        placeholder="MM/AA"
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ocean-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">CVV</label>
                                    <input
                                        type="text"
                                        maxLength={4}
                                        placeholder="123"
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ocean-500"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Intestatario carta</label>
                                <input
                                    type="text"
                                    placeholder="MARIO ROSSI"
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-ocean-500"
                                />
                            </div>
                            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                ⚠️ Integrazione pagamento in fase di configurazione. La conferma avverrà senza addebito reale.
                            </p>
                        </div>
                    )}

                    {method === 'paypal' && (
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                ⚠️ Integrazione PayPal in fase di configurazione. La conferma avverrà senza addebito reale.
                            </p>
                        </div>
                    )}

                    {/* Commission info */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                        <Percent className="h-3.5 w-3.5" />
                        <Euro className="h-3.5 w-3.5" />
                        <span>Le commissioni di servizio sono già incluse nel totale mostrato.</span>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Step 5 — Confirmation ────────────────────────────────────────────────────

function Confirmation({ submissionId, raceName, eventTitle, pricePaid, paymentMethod }: {
    submissionId: string;
    raceName: string;
    eventTitle: string;
    pricePaid: number;
    paymentMethod: PaymentMethod;
}) {
    function downloadReceipt() {
        const content = [
            'RICEVUTA DI ISCRIZIONE',
            '======================',
            `N° iscrizione: ${submissionId}`,
            `Evento: ${eventTitle}`,
            `Distanza: ${raceName}`,
            `Importo: ${formatPrice(pricePaid)}`,
            `Metodo: ${paymentMethod === 'paypal' ? 'PayPal' : paymentMethod === 'card' ? 'Carta' : 'Gratuito'}`,
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
    const { getEvent, commission, validateDiscountCode, applyDiscountCode } = useAdminStore();

    const event = slug ? getEvent(slug) : undefined;
    const initialRaceId = searchParams.get('race') ?? event?.races[0]?.id ?? '';

    const [step, setStep] = useState(0);
    const [selectedRaceId, setSelectedRaceId] = useState(initialRaceId);
    const [formData, setFormData] = useState<Record<string, string | boolean>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [appliedDiscount, setAppliedDiscount] = useState<DiscountCode | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
    const [submissionId, setSubmissionId] = useState('');

    const selectedRace = useMemo(
        () => event?.races.find(r => r.id === selectedRaceId),
        [event, selectedRaceId]
    );
    const fields = useMemo(() => selectedRace?.formSchema ?? [], [selectedRace]);

    // Price calculation
    const basePrice = useMemo(() => selectedRace ? getActivePrice(selectedRace).price : 0, [selectedRace]);
    const discountAmount = useMemo(
        () => appliedDiscount ? calcDiscount(basePrice, appliedDiscount) : 0,
        [appliedDiscount, basePrice]
    );
    const commissionAmount = useMemo(() => {
        if (commission.appliedTo !== 'buyer') return 0;
        const afterDiscount = Math.max(0, basePrice - discountAmount);
        return Math.round((commission.fixedFee + afterDiscount * commission.percentFee / 100) * 100) / 100;
    }, [commission, basePrice, discountAmount]);
    const totalPrice = Math.max(0, basePrice - discountAmount + commissionAmount);
    const isFree = totalPrice <= 0;

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
        if (step === 1 && !validateForm()) return;
        if (step === 3) {
            // Payment confirmed — submit
            if (!selectedRace || !event) return;
            const id = `reg_${Date.now()}`;
            if (appliedDiscount) applyDiscountCode(appliedDiscount.id);
            saveRegistration({
                id,
                eventId: event.id,
                raceId: selectedRaceId,
                submittedAt: new Date().toISOString(),
                formData,
                pricePaid: totalPrice,
                discountCode: appliedDiscount?.code,
                discountAmount: discountAmount > 0 ? discountAmount : undefined,
                paymentMethod: isFree ? 'free' : paymentMethod,
            });
            setSubmissionId(id);
        }
        setStep(s => s + 1);
    }

    function handleBack() {
        if (step === 0) navigate(`/events/${slug}`);
        else setStep(s => s - 1);
    }

    const isLastStep = step === STEPS.length - 2; // step 3 = pagamento
    const nextLabel = isLastStep ? (isFree ? 'Conferma iscrizione' : 'Paga e conferma') : 'Continua';

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

                {step < STEPS.length - 1 && <StepBar current={step} />}

                {/* Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-7">
                    {step === 0 && (
                        <RacePicker races={event.races} selectedId={selectedRaceId} onSelect={setSelectedRaceId} />
                    )}

                    {step === 1 && selectedRace && (
                        <div>
                            <h2 className="font-semibold text-slate-700 text-base mb-4">{selectedRace.name}</h2>
                            {fields.length === 0 ? (
                                <p className="text-slate-400 text-sm italic">Nessun dato richiesto per questa gara.</p>
                            ) : (
                                <DynamicForm fields={fields} data={formData} onChange={handleFormChange} errors={errors} />
                            )}
                        </div>
                    )}

                    {step === 2 && selectedRace && (
                        <Summary
                            race={selectedRace}
                            fields={fields}
                            data={formData}
                            appliedDiscount={appliedDiscount}
                            onApplyDiscount={setAppliedDiscount}
                            validateCode={validateDiscountCode}
                        />
                    )}

                    {step === 3 && (
                        <PaymentStep
                            totalPrice={totalPrice}
                            method={paymentMethod}
                            onMethodChange={setPaymentMethod}
                        />
                    )}

                    {step === 4 && selectedRace && (
                        <Confirmation
                            submissionId={submissionId}
                            raceName={selectedRace.name}
                            eventTitle={event.title}
                            pricePaid={totalPrice}
                            paymentMethod={isFree ? 'free' : paymentMethod}
                        />
                    )}
                </div>

                {/* Nav buttons */}
                {step < STEPS.length - 1 && (
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
                            {nextLabel}
                            {!isLastStep && <ChevronRight className="h-4 w-4" />}
                        </button>
                    </div>
                )}
            </div>
        </main>
    );
}
