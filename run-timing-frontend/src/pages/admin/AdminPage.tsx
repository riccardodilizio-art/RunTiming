import { useState } from 'react';
import {
    Plus, ChevronLeft, Settings, ClipboardList, Trash2, Edit2, Check,
    Euro, Calendar, MapPin, Users, Image, Route,
} from 'lucide-react';
import { useAdminStore } from '../../hooks/useAdminStore';
import FormBuilder from '../../components/admin/FormBuilder';
import type { Event, Race, FormField, PriceStep, SportCategory, RouteInfo, ElevationPoint } from '../../types';

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

// ─── RaceEditor ───────────────────────────────────────────────────────────────

type RaceTab = 'info' | 'form' | 'prices';

function RaceEditor({
    race,
    onChange,
    onBack,
}: {
    race: Race;
    onChange: (r: Race) => void;
    onBack: () => void;
}) {
    const [tab, setTab] = useState<RaceTab>('info');

    function set<K extends keyof Race>(key: K, value: Race[K]) {
        onChange({ ...race, [key]: value });
    }

    const tabs: { key: RaceTab; label: string; icon: React.ReactNode }[] = [
        { key: 'info', label: 'Dettagli', icon: <Settings className="h-4 w-4" /> },
        { key: 'form', label: 'Modulo iscrizione', icon: <ClipboardList className="h-4 w-4" /> },
        { key: 'prices', label: 'Quote', icon: <Euro className="h-4 w-4" /> },
    ];

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

// ─── AdminPage ────────────────────────────────────────────────────────────────

export default function AdminPage() {
    const { events, saveEvent, deleteEvent } = useAdminStore();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    const editingEvent = editingId ? events.find(e => e.id === editingId) : null;

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
            <div className="bg-white border-b border-slate-200 px-4 sm:px-8 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Settings className="h-5 w-5 text-ocean-600" />
                    <span className="font-semibold text-slate-800 text-lg">Admin Panel</span>
                </div>
                {saved && (
                    <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                        <Check className="h-4 w-4" /> Salvato
                    </span>
                )}
            </div>

            <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8">
                {editingEvent ? (
                    <EventEditor
                        event={editingEvent}
                        onSave={handleSave}
                        onBack={() => setEditingId(null)}
                    />
                ) : (
                    <div>
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-800">Eventi</h1>
                                <p className="text-slate-500 text-sm mt-0.5">{events.length} eventi totali</p>
                            </div>
                            <button
                                type="button"
                                onClick={createEvent}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ocean-600 text-white text-sm font-medium hover:bg-ocean-700 transition-colors"
                            >
                                <Plus className="h-4 w-4" /> Nuovo evento
                            </button>
                        </div>

                        <div className="space-y-3">
                            {events.map(event => (
                                <div
                                    key={event.id}
                                    className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between gap-4 hover:border-slate-300 transition-colors"
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="font-medium text-slate-800 text-sm">{event.title}</p>
                                            {event.isFeatured && (
                                                <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">in evidenza</span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-400">
                                            <span className="flex items-center gap-1">
                                                <Calendar className="h-3.5 w-3.5" />
                                                {new Date(event.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <MapPin className="h-3.5 w-3.5" />
                                                {event.city || '—'}{event.province ? ` (${event.province})` : ''}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Users className="h-3.5 w-3.5" />
                                                {event.races.length} distanze
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => setEditingId(event.id)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-colors"
                                        >
                                            <Edit2 className="h-3.5 w-3.5" /> Modifica
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (confirm(`Eliminare "${event.title}"?`)) deleteEvent(event.id);
                                            }}
                                            className="p-1.5 rounded hover:bg-red-50 transition-colors"
                                        >
                                            <Trash2 className="h-4 w-4 text-red-400" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
