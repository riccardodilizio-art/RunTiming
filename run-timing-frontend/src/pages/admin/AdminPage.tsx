import { useState, useMemo } from 'react';
import {
    Plus, ChevronLeft, Settings, ClipboardList, Trash2, Edit2, Check,
    Euro, Calendar, MapPin, Users, Image, Route, Tag, UserCheck, Eye, EyeOff,
    LogOut, CheckCircle2, XCircle, UserPlus, Search, LayoutList, LayoutGrid, X,
    SlidersHorizontal, ChevronDown,
} from 'lucide-react';
import { useAdminStore, saveRegistration } from '../../hooks/useAdminStore';
import { useAuth } from '../../context/AuthContext';
import FormBuilder from '../../components/admin/FormBuilder';
import AthletesSection from './AthletesSection';
import DiscountSection from './DiscountSection';
import UsersSection from './UsersSection';
import { categoryLabels, categoryColors } from '../../data/mockEvents';
import type {
    Event, Race, FormField, PriceStep, SportCategory, RouteInfo, ElevationPoint, RaceCategory,
    RegistrationSubmission, PaymentStatus,
} from '../../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function newId() {
    return `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

const categoryOptions: { value: SportCategory; label: string }[] = [
    { value: 'running', label: 'Running' },
    { value: 'cycling', label: 'Ciclismo' },
    { value: 'triathlon', label: 'Triathlon' },
    { value: 'swimming', label: 'Nuoto' },
    { value: 'trail', label: 'Trail' },
    { value: 'other', label: 'Altro' },
];

function formatPrice(n: number) {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
}

const inputCls =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ocean-500 focus:border-ocean-500';

// ─── PriceStepEditor ──────────────────────────────────────────────────────────

function PriceStepEditor({ steps, onChange }: { steps: PriceStep[]; onChange: (s: PriceStep[]) => void }) {
    function add() {
        onChange([...steps, { id: newId(), label: 'Nuova quota', price: 0, deadline: '' }]);
    }
    function remove(id: string) { onChange(steps.filter(s => s.id !== id)); }
    function update<K extends keyof PriceStep>(id: string, key: K, value: PriceStep[K]) {
        onChange(steps.map(s => s.id === id ? { ...s, [key]: value } : s));
    }

    return (
        <div className="space-y-3">
            {steps.map((step, idx) => (
                <div key={step.id} className="grid grid-cols-12 gap-2 items-start">
                    <div className="col-span-4">
                        {idx === 0 && <label className="block text-xs text-slate-500 mb-1">Etichetta</label>}
                        <input
                            type="text"
                            value={step.label}
                            onChange={e => update(step.id, 'label', e.target.value)}
                            className={inputCls}
                            placeholder="es. Early Bird"
                        />
                    </div>
                    <div className="col-span-3">
                        {idx === 0 && <label className="block text-xs text-slate-500 mb-1">Prezzo (€)</label>}
                        <input
                            type="number"
                            min={0}
                            step={0.5}
                            value={step.price}
                            onChange={e => update(step.id, 'price', parseFloat(e.target.value) || 0)}
                            className={inputCls}
                        />
                    </div>
                    <div className="col-span-4">
                        {idx === 0 && <label className="block text-xs text-slate-500 mb-1">Scadenza</label>}
                        <input
                            type="date"
                            value={step.deadline}
                            onChange={e => update(step.id, 'deadline', e.target.value)}
                            className={inputCls}
                        />
                    </div>
                    <div className="col-span-1 flex items-end pb-0.5">
                        {idx === 0 && <div className="h-5 mb-1" />}
                        <button type="button" onClick={() => remove(step.id)} className="p-1.5 rounded hover:bg-red-50">
                            <Trash2 className="h-4 w-4 text-red-400" />
                        </button>
                    </div>
                </div>
            ))}
            <button
                type="button"
                onClick={add}
                className="flex items-center gap-1.5 text-sm text-ocean-600 hover:text-ocean-800 transition-colors"
            >
                <Plus className="h-4 w-4" /> Aggiungi quota
            </button>
        </div>
    );
}

// ─── CategoryEditor ───────────────────────────────────────────────────────────

function CategoryEditor({
    categories,
    onChange,
}: {
    categories: RaceCategory[];
    onChange: (cats: RaceCategory[]) => void;
}) {
    function add() {
        onChange([...categories, { id: newId(), name: '', gender: undefined, minAge: undefined, maxAge: undefined }]);
    }
    function remove(id: string) { onChange(categories.filter(c => c.id !== id)); }
    function update<K extends keyof RaceCategory>(id: string, key: K, value: RaceCategory[K]) {
        onChange(categories.map(c => c.id === id ? { ...c, [key]: value } : c));
    }

    return (
        <div className="mt-6 pt-5 border-t border-slate-200">
            <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-slate-700">Categorie agonistiche</h4>
                <button type="button" onClick={add} className="flex items-center gap-1 text-xs text-ocean-600 hover:text-ocean-800 transition-colors">
                    <Plus className="h-3.5 w-3.5" /> Aggiungi categoria
                </button>
            </div>
            <p className="text-xs text-slate-400 mb-3">
                Definisci le categorie (es. Senior M, Master 40 F, Junior). Il sistema assegnerà automaticamente
                l'atleta in base a età e sesso dichiarati al momento dell'iscrizione.
            </p>
            {categories.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Nessuna categoria configurata.</p>
            ) : (
                <div className="space-y-2">
                    {categories.map((cat, idx) => (
                        <div key={cat.id} className="grid grid-cols-12 gap-2 items-start">
                            {/* Nome */}
                            <div className="col-span-4">
                                {idx === 0 && <label className="block text-xs text-slate-400 mb-1">Nome categoria</label>}
                                <input
                                    type="text"
                                    value={cat.name}
                                    onChange={e => update(cat.id, 'name', e.target.value)}
                                    className={inputCls}
                                    placeholder="es. Senior M"
                                />
                            </div>
                            {/* Sesso */}
                            <div className="col-span-2">
                                {idx === 0 && <label className="block text-xs text-slate-400 mb-1">Sesso</label>}
                                <select
                                    value={cat.gender ?? ''}
                                    onChange={e => update(cat.id, 'gender', (e.target.value as RaceCategory['gender']) || undefined)}
                                    className={inputCls}
                                >
                                    <option value="">Tutti</option>
                                    <option value="M">M</option>
                                    <option value="F">F</option>
                                </select>
                            </div>
                            {/* Età min */}
                            <div className="col-span-2">
                                {idx === 0 && <label className="block text-xs text-slate-400 mb-1">Età min</label>}
                                <input
                                    type="number" min={0}
                                    value={cat.minAge ?? ''}
                                    onChange={e => update(cat.id, 'minAge', e.target.value ? parseInt(e.target.value) : undefined)}
                                    className={inputCls}
                                    placeholder="—"
                                />
                            </div>
                            {/* Età max */}
                            <div className="col-span-2">
                                {idx === 0 && <label className="block text-xs text-slate-400 mb-1">Età max</label>}
                                <input
                                    type="number" min={0}
                                    value={cat.maxAge ?? ''}
                                    onChange={e => update(cat.id, 'maxAge', e.target.value ? parseInt(e.target.value) : undefined)}
                                    className={inputCls}
                                    placeholder="—"
                                />
                            </div>
                            {/* Delete */}
                            <div className="col-span-2 flex items-end pb-0.5">
                                {idx === 0 && <div className="h-5 mb-1" />}
                                <button type="button" onClick={() => remove(cat.id)} className="p-1.5 rounded hover:bg-red-50">
                                    <Trash2 className="h-4 w-4 text-red-400" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── RaceEditor ───────────────────────────────────────────────────────────────

type RaceTab = 'info' | 'form' | 'prices' | 'partecipanti';

function RaceEditor({
    race,
    eventId,
    onChange,
    onBack,
}: {
    race: Race;
    eventId: string;
    onChange: (r: Race) => void;
    onBack: () => void;
}) {
    const [tab, setTab] = useState<RaceTab>('info');
    const [regKey, setRegKey] = useState(0);
    const [showManualReg, setShowManualReg] = useState(false);
    const { getRegistrationsByRace, updatePaymentStatus, deleteRegistration } = useAdminStore();

    function set<K extends keyof Race>(key: K, value: Race[K]) {
        onChange({ ...race, [key]: value });
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const registrations = useMemo(() =>
        tab === 'partecipanti' ? getRegistrationsByRace(race.id) : [],
        // regKey triggers a re-read from localStorage after mutations
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [tab, race.id, regKey]
    );

    function handlePaymentStatus(regId: string, status: PaymentStatus) {
        updatePaymentStatus(regId, status);
        setRegKey(k => k + 1);
    }

    function handleDeleteReg(regId: string) {
        deleteRegistration(regId);
        setRegKey(k => k + 1);
    }
    const formFields = race.formSchema ?? [];

    function togglePublicField(fieldId: string) {
        const current = race.publicFields ?? [];
        const next = current.includes(fieldId)
            ? current.filter(f => f !== fieldId)
            : [...current, fieldId];
        set('publicFields', next);
    }

    const tabs: { key: RaceTab; label: string; icon: React.ReactNode }[] = [
        { key: 'info', label: 'Dettagli', icon: <Settings className="h-4 w-4" /> },
        { key: 'form', label: 'Modulo iscrizione', icon: <ClipboardList className="h-4 w-4" /> },
        { key: 'prices', label: 'Quote', icon: <Euro className="h-4 w-4" /> },
        { key: 'partecipanti', label: 'Iscritti', icon: <UserCheck className="h-4 w-4" /> },
    ];
    void eventId;

    return (
        <div>
            <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm text-ocean-600 hover:text-ocean-800 mb-4">
                <ChevronLeft className="h-4 w-4" /> Torna alle distanze
            </button>
            <h3 className="font-semibold text-slate-800 text-lg mb-4">{race.name}</h3>

            {/* Tab bar */}
            <div className="flex gap-1 mb-6 border-b border-slate-200">
                {tabs.map(t => (
                    <button
                        key={t.key}
                        type="button"
                        onClick={() => setTab(t.key)}
                        className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                            tab === t.key
                                ? 'border-ocean-600 text-ocean-700'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            {tab === 'info' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nome distanza</label>
                        <input type="text" value={race.name} onChange={e => set('name', e.target.value)} className={inputCls} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Distanza (es. 21 km)</label>
                        <input type="text" value={race.distance} onChange={e => set('distance', e.target.value)} className={inputCls} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Tipo gara</label>
                        <select value={race.raceType} onChange={e => set('raceType', e.target.value as Race['raceType'])} className={inputCls}>
                            <option value="linear">Lineare (percorso)</option>
                            <option value="laps_fixed">Giri fissi</option>
                            <option value="laps_timed">Giri a tempo</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Prezzo base (€)</label>
                        <input type="number" min={0} step={0.5} value={race.price} onChange={e => set('price', parseFloat(e.target.value) || 0)} className={inputCls} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Max partecipanti</label>
                        <input type="number" min={1} value={race.maxParticipants} onChange={e => set('maxParticipants', parseInt(e.target.value) || 0)} className={inputCls} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Età min</label>
                        <input type="number" min={0} value={race.minAge ?? ''} onChange={e => set('minAge', e.target.value ? parseInt(e.target.value) : undefined)} className={inputCls} placeholder="—" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Età max</label>
                        <input type="number" min={0} value={race.maxAge ?? ''} onChange={e => set('maxAge', e.target.value ? parseInt(e.target.value) : undefined)} className={inputCls} placeholder="—" />
                    </div>
                    <div className="flex items-center gap-2 pt-5">
                        <input
                            id="requiresMedicalCert"
                            type="checkbox"
                            checked={race.requiresMedicalCert}
                            onChange={e => set('requiresMedicalCert', e.target.checked)}
                            className="accent-ocean-600 h-4 w-4"
                        />
                        <label htmlFor="requiresMedicalCert" className="text-sm text-slate-700">Certificato agonistico richiesto</label>
                    </div>
                    <div className="flex items-center gap-2 pt-5">
                        <input
                            id="isOpen"
                            type="checkbox"
                            checked={race.isOpen}
                            onChange={e => set('isOpen', e.target.checked)}
                            className="accent-ocean-600 h-4 w-4"
                        />
                        <label htmlFor="isOpen" className="text-sm text-slate-700">Iscrizioni aperte</label>
                    </div>
                    <CategoryEditor
                        categories={race.categories ?? []}
                        onChange={cats => set('categories', cats)}
                    />
                </div>
            )}

            {tab === 'form' && (
                <FormBuilder
                    schema={race.formSchema ?? []}
                    onChange={(schema: FormField[]) => set('formSchema', schema)}
                />
            )}

            {tab === 'prices' && (
                <div className="max-w-2xl">
                    <p className="text-sm text-slate-500 mb-4">
                        Definisci le quote per scaglioni temporali. Il prezzo attivo sarà quello con scadenza più vicina non ancora passata.
                        Se non ci sono quote attive si usa il prezzo base ({formatPrice(race.price)}).
                    </p>
                    <PriceStepEditor
                        steps={race.priceSteps ?? []}
                        onChange={(steps: PriceStep[]) => set('priceSteps', steps)}
                    />
                </div>
            )}

            {tab === 'partecipanti' && (
                <div className="space-y-5">
                    {/* Visibilità pubblica campi */}
                    <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                        <h4 className="text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2">
                            <Eye className="h-4 w-4 text-ocean-500" /> Campi visibili pubblicamente
                        </h4>
                        <p className="text-xs text-slate-400 mb-3">
                            Seleziona quali informazioni degli iscritti sono visibili nella pagina pubblica della manifestazione.
                        </p>
                        {formFields.length === 0 ? (
                            <p className="text-sm text-slate-400 italic">Nessun campo nel modulo. Configura prima il modulo iscrizione.</p>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {formFields.filter(f => !f.readOnly).map(f => {
                                    const isPublic = (race.publicFields ?? []).includes(f.id);
                                    return (
                                        <label key={f.id} className="flex items-center gap-2 cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                checked={isPublic}
                                                onChange={() => togglePublicField(f.id)}
                                                className="accent-ocean-600 h-4 w-4"
                                            />
                                            <span className="text-sm text-slate-700 group-hover:text-ocean-700 flex items-center gap-1">
                                                {isPublic
                                                    ? <Eye className="h-3.5 w-3.5 text-ocean-500" />
                                                    : <EyeOff className="h-3.5 w-3.5 text-slate-300" />
                                                }
                                                {f.label}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Lista iscrizioni */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                <Users className="h-4 w-4 text-ocean-500" /> Iscritti ({registrations.length})
                            </h4>
                            <button
                                type="button"
                                onClick={() => setShowManualReg(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ocean-600 text-white text-xs font-medium hover:bg-ocean-700 transition-colors"
                            >
                                <UserPlus className="h-3.5 w-3.5" /> Iscrivi manualmente
                            </button>
                        </div>
                        {registrations.length === 0 ? (
                            <p className="text-sm text-slate-400 italic">Nessuna iscrizione ricevuta per questa gara.</p>
                        ) : (
                            <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                            <th className="px-3 py-2">N°</th>
                                            {formFields.filter(f => !f.readOnly).map(f => (
                                                <th key={f.id} className="px-3 py-2">
                                                    {f.label}
                                                    {(race.publicFields ?? []).includes(f.id) && (
                                                        <Eye className="inline h-3 w-3 ml-1 text-ocean-400" />
                                                    )}
                                                </th>
                                            ))}
                                            <th className="px-3 py-2">Quota</th>
                                            <th className="px-3 py-2">Pagamento</th>
                                            <th className="px-3 py-2">Data</th>
                                            <th className="px-3 py-2" />
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {registrations.map((reg, idx) => (
                                            <tr key={reg.id} className="hover:bg-slate-50/50">
                                                <td className="px-3 py-2 text-slate-400">{idx + 1}</td>
                                                {formFields.filter(f => !f.readOnly).map(f => (
                                                    <td key={f.id} className="px-3 py-2 text-slate-700">
                                                        {typeof reg.formData[f.id] === 'boolean'
                                                            ? (reg.formData[f.id] ? '✓' : '—')
                                                            : (reg.formData[f.id] as string) || '—'}
                                                    </td>
                                                ))}
                                                <td className="px-3 py-2 font-medium text-ocean-700">{formatPrice(reg.pricePaid)}</td>
                                                <td className="px-3 py-2">
                                                    <PaymentBadge
                                                        status={reg.paymentStatus ?? 'pending'}
                                                        onConfirm={() => handlePaymentStatus(reg.id, 'confirmed')}
                                                        onReject={() => handlePaymentStatus(reg.id, 'rejected')}
                                                        onReset={() => handlePaymentStatus(reg.id, 'pending')}
                                                    />
                                                </td>
                                                <td className="px-3 py-2 text-slate-400">
                                                    {new Date(reg.submittedAt).toLocaleDateString('it-IT')}
                                                    {reg.addedByOrganizer && (
                                                        <span className="ml-1 text-ocean-500" title="Iscrizione manuale">M</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => { if (confirm('Eliminare questa iscrizione?')) handleDeleteReg(reg.id); }}
                                                        className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"
                                                        title="Elimina iscrizione"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {showManualReg && (
                        <ManualRegModal
                            race={race}
                            eventId={eventId}
                            onClose={() => setShowManualReg(false)}
                            onSaved={() => setRegKey(k => k + 1)}
                        />
                    )}
                </div>
            )}
        </div>
    );
}

// ─── PaymentBadge ─────────────────────────────────────────────────────────────

function PaymentBadge({
    status,
    onConfirm,
    onReject,
    onReset,
}: {
    status: PaymentStatus;
    onConfirm: () => void;
    onReject: () => void;
    onReset: () => void;
}) {
    if (status === 'confirmed') {
        return (
            <button
                type="button"
                onClick={onReset}
                title="Clicca per annullare conferma"
                className="flex items-center gap-1 text-emerald-600 font-medium hover:text-emerald-800"
            >
                <CheckCircle2 className="h-3.5 w-3.5" /> Confermato
            </button>
        );
    }
    if (status === 'rejected') {
        return (
            <button
                type="button"
                onClick={onReset}
                title="Clicca per riportare in attesa"
                className="flex items-center gap-1 text-red-500 font-medium hover:text-red-700"
            >
                <XCircle className="h-3.5 w-3.5" /> Rifiutato
            </button>
        );
    }
    return (
        <div className="flex items-center gap-1">
            <span className="text-amber-600 font-medium">In attesa</span>
            <button
                type="button"
                onClick={onConfirm}
                title="Conferma pagamento"
                className="ml-1 p-0.5 rounded hover:bg-emerald-50 text-slate-400 hover:text-emerald-600"
            >
                <CheckCircle2 className="h-3.5 w-3.5" />
            </button>
            <button
                type="button"
                onClick={onReject}
                title="Rifiuta pagamento"
                className="p-0.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"
            >
                <XCircle className="h-3.5 w-3.5" />
            </button>
        </div>
    );
}

// ─── ManualRegModal ───────────────────────────────────────────────────────────

function ManualRegModal({
    race,
    eventId,
    onClose,
    onSaved,
}: {
    race: Race;
    eventId: string;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [formData, setFormData] = useState<Record<string, string | boolean>>({});
    const [price, setPrice] = useState(race.price);
    const [paymentMethod, setPaymentMethod] = useState<'manual' | 'free'>('manual');

    const fields = (race.formSchema ?? []).filter(f => !f.readOnly && f.type !== 'file');

    function setField(id: string, val: string | boolean) {
        setFormData(d => ({ ...d, [id]: val }));
    }

    function handleSave() {
        const sub: RegistrationSubmission = {
            id: `reg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            eventId,
            raceId: race.id,
            submittedAt: new Date().toISOString(),
            formData,
            pricePaid: price,
            paymentMethod,
            paymentStatus: 'confirmed',
            addedByOrganizer: true,
        };
        saveRegistration(sub);
        onSaved();
        onClose();
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                    <h3 className="font-semibold text-slate-800">Iscrizione manuale — {race.name}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <XCircle className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-5 space-y-3">
                    {fields.length === 0 && (
                        <p className="text-sm text-slate-400 italic">Nessun campo nel modulo. Compila i dati base.</p>
                    )}
                    {fields.map(f => (
                        <div key={f.id}>
                            <label className="block text-xs font-medium text-slate-600 mb-1">
                                {f.label}{f.required && ' *'}
                            </label>
                            {f.type === 'select' ? (
                                <select
                                    value={(formData[f.id] as string) ?? ''}
                                    onChange={e => setField(f.id, e.target.value)}
                                    className={inputCls}
                                >
                                    <option value="">— seleziona —</option>
                                    {f.options?.map(o => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                            ) : f.type === 'checkbox' ? (
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={(formData[f.id] as boolean) ?? false}
                                        onChange={e => setField(f.id, e.target.checked)}
                                        className="accent-ocean-600"
                                    />
                                    <span className="text-sm text-slate-700">{f.helperText ?? f.label}</span>
                                </label>
                            ) : f.type === 'textarea' ? (
                                <textarea
                                    rows={3}
                                    value={(formData[f.id] as string) ?? ''}
                                    onChange={e => setField(f.id, e.target.value)}
                                    className={inputCls}
                                    placeholder={f.placeholder}
                                />
                            ) : (
                                <input
                                    type={f.type}
                                    value={(formData[f.id] as string) ?? ''}
                                    onChange={e => setField(f.id, e.target.value)}
                                    className={inputCls}
                                    placeholder={f.placeholder}
                                />
                            )}
                        </div>
                    ))}

                    <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Quota pagata (€)</label>
                            <input
                                type="number" min={0} step={0.5}
                                value={price}
                                onChange={e => setPrice(parseFloat(e.target.value) || 0)}
                                className={inputCls}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Metodo pagamento</label>
                            <select
                                value={paymentMethod}
                                onChange={e => setPaymentMethod(e.target.value as 'manual' | 'free')}
                                className={inputCls}
                            >
                                <option value="manual">Manuale (contanti/bonifico)</option>
                                <option value="free">Gratuito / esenzione</option>
                            </select>
                        </div>
                    </div>
                    <p className="text-xs text-slate-400">
                        L'iscrizione sarà marcata come <strong>confermata</strong> automaticamente.
                    </p>
                </div>
                <div className="flex justify-end gap-2 px-5 pb-5">
                    <button onClick={onClose}
                        className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50">
                        Annulla
                    </button>
                    <button onClick={handleSave}
                        className="px-4 py-2 rounded-lg bg-ocean-600 text-white text-sm font-medium hover:bg-ocean-700 flex items-center gap-1.5">
                        <Check className="w-4 h-4" /> Salva iscrizione
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── RouteInfoEditor ──────────────────────────────────────────────────────────

function parseProfile(raw: string): ElevationPoint[] {
    return raw
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => {
            const [km, elev] = line.split(',').map(s => parseFloat(s.trim()));
            return { km, elev };
        })
        .filter(p => !isNaN(p.km) && !isNaN(p.elev));
}

function serializeProfile(profile: ElevationPoint[]): string {
    return profile.map(p => `${p.km},${p.elev}`).join('\n');
}

function RouteInfoEditor({
    routeInfo,
    onChange,
}: {
    routeInfo?: RouteInfo;
    onChange: (ri: RouteInfo | undefined) => void;
}) {
    const enabled = routeInfo !== undefined;
    const ri = routeInfo ?? { elevationGainM: 0, maxElevationM: 0, minElevationM: 0, terrain: '', profile: [] };

    function update<K extends keyof RouteInfo>(key: K, value: RouteInfo[K]) {
        onChange({ ...ri, [key]: value });
    }

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                    <Route className="h-4 w-4 text-ocean-600" /> Percorso altimetrico
                </h3>
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={enabled}
                        onChange={e => onChange(e.target.checked ? ri : undefined)}
                        className="accent-ocean-600 h-4 w-4"
                    />
                    <span className="text-sm text-slate-600">Includi dati altimetrici</span>
                </label>
            </div>

            {enabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Dislivello positivo (m)</label>
                        <input
                            type="number"
                            min={0}
                            value={ri.elevationGainM}
                            onChange={e => update('elevationGainM', parseInt(e.target.value) || 0)}
                            className={inputCls}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Quota massima (m s.l.m.)</label>
                        <input
                            type="number"
                            min={0}
                            value={ri.maxElevationM}
                            onChange={e => update('maxElevationM', parseInt(e.target.value) || 0)}
                            className={inputCls}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Quota minima (m s.l.m.)</label>
                        <input
                            type="number"
                            min={0}
                            value={ri.minElevationM}
                            onChange={e => update('minElevationM', parseInt(e.target.value) || 0)}
                            className={inputCls}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Tipo di terreno</label>
                        <input
                            type="text"
                            value={ri.terrain}
                            onChange={e => update('terrain', e.target.value)}
                            className={inputCls}
                            placeholder="es. Asfalto, Sterrato, Misto"
                        />
                    </div>
                    <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Profilo altimetrico{' '}
                            <span className="font-normal text-slate-400">(una riga per punto: km,quota)</span>
                        </label>
                        <textarea
                            rows={6}
                            value={serializeProfile(ri.profile)}
                            onChange={e => update('profile', parseProfile(e.target.value))}
                            className={`${inputCls} font-mono text-xs`}
                            placeholder={'0,150\n5,210\n10,380\n15,420\n20,150'}
                        />
                        <p className="text-xs text-slate-400 mt-1">
                            Formato: <code>km,quota</code> — una riga per ogni punto. Es: <code>0,150</code>
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── EventEditor ──────────────────────────────────────────────────────────────

function EventEditor({ event, onSave, onBack }: { event: Event; onSave: (e: Event) => void; onBack: () => void }) {
    const [draft, setDraft] = useState<Event>(event);
    const [editingRaceId, setEditingRaceId] = useState<string | null>(null);
    const [dirty, setDirty] = useState(false);

    function updateDraft(next: Event) {
        setDraft(next);
        setDirty(true);
    }

    function set<K extends keyof Event>(key: K, value: Event[K]) {
        updateDraft({ ...draft, [key]: value });
    }

    function addRace() {
        const newRace: Race = {
            id: `${draft.id}-${newId()}`,
            name: 'Nuova distanza',
            distance: '—',
            raceType: 'linear',
            requiresMedicalCert: false,
            price: 0,
            maxParticipants: 100,
            participants: 0,
            isOpen: true,
            formSchema: [],
            priceSteps: [],
        };
        updateDraft({ ...draft, races: [...draft.races, newRace] });
        setEditingRaceId(newRace.id);
    }

    function updateRace(race: Race) {
        updateDraft({ ...draft, races: draft.races.map(r => r.id === race.id ? race : r) });
    }

    function deleteRace(id: string) {
        updateDraft({ ...draft, races: draft.races.filter(r => r.id !== id) });
    }

    const editingRace = editingRaceId ? draft.races.find(r => r.id === editingRaceId) : null;

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm text-ocean-600 hover:text-ocean-800">
                    <ChevronLeft className="h-4 w-4" /> Torna agli eventi
                </button>
                {dirty && (
                    <button
                        type="button"
                        onClick={() => { onSave(draft); setDirty(false); }}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-ocean-600 text-white text-sm font-medium hover:bg-ocean-700 transition-colors"
                    >
                        <Check className="h-4 w-4" /> Salva modifiche
                    </button>
                )}
            </div>

            {editingRace ? (
                <RaceEditor
                    race={editingRace}
                    eventId={draft.id}
                    onChange={updateRace}
                    onBack={() => setEditingRaceId(null)}
                />
            ) : (
                <div className="space-y-6">
                    {/* Generale */}
                    <div className="bg-white rounded-xl border border-slate-200 p-5">
                        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                            <Settings className="h-4 w-4 text-ocean-600" /> Dettagli generali
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="sm:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Titolo</label>
                                <input type="text" value={draft.title} onChange={e => set('title', e.target.value)} className={inputCls} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Data e ora</label>
                                <input type="datetime-local" value={draft.date.slice(0, 16)} onChange={e => set('date', e.target.value + ':00')} className={inputCls} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
                                <select value={draft.category} onChange={e => set('category', e.target.value as SportCategory)} className={inputCls}>
                                    {categoryOptions.map(o => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="sm:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Organizzatore</label>
                                <input type="text" value={draft.organizer} onChange={e => set('organizer', e.target.value)} className={inputCls} />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Descrizione evento</label>
                                <textarea
                                    rows={4}
                                    value={draft.description ?? ''}
                                    onChange={e => set('description', e.target.value || undefined)}
                                    className={inputCls}
                                    placeholder="Descrizione dell'evento, informazioni generali, storia della manifestazione..."
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <input id="featured" type="checkbox" checked={draft.isFeatured} onChange={e => set('isFeatured', e.target.checked)} className="accent-ocean-600 h-4 w-4" />
                                <label htmlFor="featured" className="text-sm text-slate-700">In evidenza</label>
                            </div>
                            <div className="flex items-center gap-2">
                                <input id="isLive" type="checkbox" checked={draft.isLive} onChange={e => set('isLive', e.target.checked)} className="accent-ocean-600 h-4 w-4" />
                                <label htmlFor="isLive" className="text-sm text-slate-700">Live (in corso)</label>
                            </div>
                        </div>
                    </div>

                    {/* Luogo */}
                    <div className="bg-white rounded-xl border border-slate-200 p-5">
                        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-ocean-600" /> Luogo
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="sm:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Luogo / indirizzo di partenza</label>
                                <input type="text" value={draft.location} onChange={e => set('location', e.target.value)} className={inputCls} placeholder="es. Piazza del Comune, 1 – Via Roma" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Città</label>
                                <input type="text" value={draft.city} onChange={e => set('city', e.target.value)} className={inputCls} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Provincia</label>
                                <input type="text" value={draft.province} onChange={e => set('province', e.target.value)} className={inputCls} placeholder="es. MI" maxLength={2} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Latitudine</label>
                                <input
                                    type="number"
                                    step="0.000001"
                                    value={draft.lat}
                                    onChange={e => set('lat', parseFloat(e.target.value) || 0)}
                                    className={inputCls}
                                    placeholder="es. 45.4654"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Longitudine</label>
                                <input
                                    type="number"
                                    step="0.000001"
                                    value={draft.lng}
                                    onChange={e => set('lng', parseFloat(e.target.value) || 0)}
                                    className={inputCls}
                                    placeholder="es. 9.1859"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <p className="text-xs text-slate-400">
                                    Puoi trovare le coordinate su{' '}
                                    <a
                                        href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(draft.city || 'Italia')}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-ocean-600 hover:underline"
                                    >
                                        OpenStreetMap
                                    </a>{' '}
                                    (tasto destro → &quot;Mostra indirizzo&quot;).
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Media & Regolamento */}
                    <div className="bg-white rounded-xl border border-slate-200 p-5">
                        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                            <Image className="h-4 w-4 text-ocean-600" /> Media &amp; Regolamento
                        </h3>
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">URL immagine di copertina</label>
                                <input
                                    type="url"
                                    value={draft.coverImage}
                                    onChange={e => set('coverImage', e.target.value)}
                                    className={inputCls}
                                    placeholder="https://esempio.com/immagine.jpg"
                                />
                                {draft.coverImage && (
                                    <img
                                        src={draft.coverImage}
                                        alt="Anteprima copertina"
                                        className="mt-2 h-24 w-full object-cover rounded-lg border border-slate-200"
                                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                    />
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">URL regolamento (PDF)</label>
                                <input
                                    type="url"
                                    value={draft.regulationUrl ?? ''}
                                    onChange={e => set('regulationUrl', e.target.value || undefined)}
                                    className={inputCls}
                                    placeholder="https://esempio.com/regolamento.pdf"
                                />
                                <p className="text-xs text-slate-400 mt-1">
                                    Se presente, il pulsante &quot;Scarica regolamento&quot; punterà a questo file.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Percorso altimetrico */}
                    <RouteInfoEditor
                        routeInfo={draft.routeInfo}
                        onChange={ri => set('routeInfo', ri)}
                    />

                    {/* Races list */}
                    <div className="bg-white rounded-xl border border-slate-200 p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                                <Users className="h-4 w-4 text-ocean-600" /> Distanze ({draft.races.length})
                            </h3>
                            <button
                                type="button"
                                onClick={addRace}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-ocean-200 text-ocean-700 text-sm hover:bg-ocean-50 transition-colors"
                            >
                                <Plus className="h-4 w-4" /> Aggiungi distanza
                            </button>
                        </div>
                        {draft.races.length === 0 ? (
                            <p className="text-sm text-slate-400 italic">Nessuna distanza configurata.</p>
                        ) : (
                            <div className="space-y-2">
                                {draft.races.map(race => (
                                    <div key={race.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-100 hover:border-slate-200 bg-slate-50 transition-colors">
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-slate-700 truncate">{race.name}</p>
                                            <div className="flex flex-wrap gap-2 mt-0.5">
                                                <span className="text-xs text-slate-400">{race.distance}</span>
                                                <span className="text-xs text-slate-400">{formatPrice(race.price)}</span>
                                                {race.priceSteps?.length ? (
                                                    <span className="text-xs text-ocean-500">{race.priceSteps.length} quote</span>
                                                ) : null}
                                                {race.formSchema?.length ? (
                                                    <span className="text-xs text-teal-600">{race.formSchema.length} campi</span>
                                                ) : null}
                                                <span className={`text-xs ${race.isOpen ? 'text-green-600' : 'text-red-500'}`}>
                                                    {race.isOpen ? 'Aperta' : 'Chiusa'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => setEditingRaceId(race.id)}
                                                className="p-1.5 rounded hover:bg-white transition-colors"
                                                title="Modifica"
                                            >
                                                <Edit2 className="h-4 w-4 text-slate-500" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => deleteRace(race.id)}
                                                className="p-1.5 rounded hover:bg-red-50 transition-colors"
                                                title="Elimina"
                                            >
                                                <Trash2 className="h-4 w-4 text-red-400" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

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

function EventsListSection({
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

// ─── AdminPage ────────────────────────────────────────────────────────────────

type AdminSection = 'gare' | 'atleti' | 'sconti' | 'utenti';

export default function AdminPage() {
    const { events, saveEvent, deleteEvent } = useAdminStore();
    const { currentUser, isAdmin, logout, canManageEvent } = useAuth();
    const [section, setSection] = useState<AdminSection>('gare');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    // Organizer sees only their assigned events
    const visibleEvents = isAdmin
        ? events
        : events.filter(e => canManageEvent(e.id));

    const editingEvent = editingId ? events.find(e => e.id === editingId) : null;

    const NAV_ITEMS: { key: AdminSection; label: string; icon: React.ReactNode }[] = [
        { key: 'gare',   label: 'Gare',    icon: <Calendar className="h-4 w-4" /> },
        ...(isAdmin ? [
            { key: 'atleti' as AdminSection,  label: 'Atleti',        icon: <Users className="h-4 w-4" /> },
            { key: 'sconti' as AdminSection,  label: 'Sconti',        icon: <Tag className="h-4 w-4" /> },
            { key: 'utenti' as AdminSection,  label: 'Organizzatori', icon: <UserCheck className="h-4 w-4" /> },
        ] : []),
    ];

    function createEvent() {
        const id = `ev_${newId()}`;
        const slug = `nuovo-evento-${id.slice(-5)}`;
        const newEvent: Event = {
            id,
            title: 'Nuovo evento',
            slug,
            category: 'running',
            date: new Date(Date.now() + 30 * 864e5).toISOString(),
            location: '',
            city: '',
            province: '',
            lat: 41.9028,
            lng: 12.4964,
            coverImage: '',
            races: [],
            isFeatured: false,
            isLive: false,
            organizer: '',
        };
        saveEvent(newEvent);
        setEditingId(id);
    }

    function handleSave(event: Event) {
        saveEvent(event);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    }

    return (
        <main className="min-h-screen bg-slate-50">
            {/* Top bar */}
            <div className="bg-white border-b border-slate-200 px-4 sm:px-8 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Settings className="h-5 w-5 text-ocean-600" />
                    <span className="font-semibold text-slate-800 text-lg">
                        {isAdmin ? 'Admin Panel' : 'Pannello Organizzatore'}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    {saved && (
                        <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                            <Check className="h-4 w-4" /> Salvato
                        </span>
                    )}
                    <span className="hidden sm:block text-sm text-slate-500">
                        {currentUser?.displayName}
                    </span>
                    <button
                        type="button"
                        onClick={logout}
                        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors"
                    >
                        <LogOut className="h-4 w-4" /> Esci
                    </button>
                </div>
            </div>

            {/* Navigation tabs */}
            {!editingEvent && (
                <div className="bg-white border-b border-slate-200 px-4 sm:px-8">
                    <div className="flex gap-1 max-w-5xl mx-auto">
                        {NAV_ITEMS.map(item => (
                            <button
                                key={item.key}
                                type="button"
                                onClick={() => setSection(item.key)}
                                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                                    section === item.key
                                        ? 'border-ocean-600 text-ocean-700'
                                        : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                {item.icon} {item.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8">
                {editingEvent ? (
                    <EventEditor
                        event={editingEvent}
                        onSave={handleSave}
                        onBack={() => setEditingId(null)}
                    />
                ) : section === 'atleti' ? (
                    <AthletesSection />
                ) : section === 'sconti' ? (
                    <DiscountSection />
                ) : section === 'utenti' ? (
                    <UsersSection />
                ) : (
                    <EventsListSection
                        events={visibleEvents}
                        isAdmin={isAdmin}
                        onEdit={id => setEditingId(id)}
                        onDelete={id => { if (confirm(`Eliminare questo evento?`)) deleteEvent(id); }}
                        onCreate={createEvent}
                    />
                )}
            </div>
        </main>
    );
}
