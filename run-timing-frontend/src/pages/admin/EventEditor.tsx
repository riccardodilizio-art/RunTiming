import { useState } from 'react';
import {
    Plus, ChevronLeft, Settings, Trash2, Edit2, Check,
    Euro, MapPin, Calendar, Image,
} from 'lucide-react';
import { newId, inputCls, formatPrice, categoryOptions } from './adminShared';
import { eventDays } from '../../utils/event';
import CommissionOverrideEditor from './CommissionOverrideEditor';
import RouteInfoEditor from './RouteInfoEditor';
import RaceEditor from './RaceEditor';
import type { Event, EventDay, Race, SportCategory } from '../../types';

export default function EventEditor({ event, onSave, onBack }: { event: Event; onSave: (e: Event) => void; onBack: () => void }) {
    // Normalizza alla struttura a giornate (canonica), eliminando i campi legacy.
    const [draft, setDraft] = useState<Event>(() => {
        const normalized: Event = { ...event, days: eventDays(event) };
        delete normalized.date;
        delete normalized.races;
        return normalized;
    });
    const [editingRaceId, setEditingRaceId] = useState<string | null>(null);
    const [dirty, setDirty] = useState(false);

    const days = draft.days ?? [];

    function updateDraft(next: Event) {
        setDraft(next);
        setDirty(true);
    }
    function set<K extends keyof Event>(key: K, value: Event[K]) {
        updateDraft({ ...draft, [key]: value });
    }
    function setDays(next: EventDay[]) {
        updateDraft({ ...draft, days: next });
    }

    // ── Giornate ──
    function addDay() {
        const base = days[days.length - 1]?.date || new Date().toISOString();
        setDays([...days, { id: `${draft.id}-day-${newId()}`, date: base, label: '', races: [] }]);
    }
    function updateDay<K extends keyof EventDay>(dayId: string, key: K, value: EventDay[K]) {
        setDays(days.map(d => d.id === dayId ? { ...d, [key]: value } : d));
    }
    function removeDay(dayId: string) {
        setDays(days.filter(d => d.id !== dayId));
    }

    // ── Gare (dentro una giornata) ──
    function addRace(dayId: string) {
        const newRace: Race = {
            id: `${draft.id}-${newId()}`,
            name: 'Nuova distanza',
            distance: '—',
            raceType: 'linear',
            ente: 'fidal',
            paymentMode: 'both',
            requiresMedicalCert: false,
            price: 0,
            maxParticipants: 100,
            participants: 0,
            isOpen: true,
            formSchema: [],
            priceSteps: [],
        };
        setDays(days.map(d => d.id === dayId ? { ...d, races: [...d.races, newRace] } : d));
        setEditingRaceId(newRace.id);
    }
    function updateRace(race: Race) {
        setDays(days.map(d => ({ ...d, races: d.races.map(r => r.id === race.id ? race : r) })));
    }
    function deleteRace(id: string) {
        setDays(days.map(d => ({ ...d, races: d.races.filter(r => r.id !== id) })));
    }

    const editingRace = editingRaceId
        ? days.flatMap(d => d.races).find(r => r.id === editingRaceId)
        : null;

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm text-brand-600 hover:text-brand-800">
                    <ChevronLeft className="h-4 w-4" /> Torna agli eventi
                </button>
                {dirty && (
                    <button
                        type="button"
                        onClick={() => { onSave(draft); setDirty(false); }}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
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
                            <Settings className="h-4 w-4 text-brand-600" /> Dettagli generali
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="sm:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Titolo</label>
                                <input type="text" value={draft.title} onChange={e => set('title', e.target.value)} className={inputCls} />
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
                                <input id="featured" type="checkbox" checked={draft.isFeatured} onChange={e => set('isFeatured', e.target.checked)} className="accent-brand-600 h-4 w-4" />
                                <label htmlFor="featured" className="text-sm text-slate-700">In evidenza</label>
                            </div>
                            <div className="flex items-center gap-2">
                                <input id="isLive" type="checkbox" checked={draft.isLive} onChange={e => set('isLive', e.target.checked)} className="accent-brand-600 h-4 w-4" />
                                <label htmlFor="isLive" className="text-sm text-slate-700">Live (in corso)</label>
                            </div>
                        </div>
                    </div>

                    {/* Luogo */}
                    <div className="bg-white rounded-xl border border-slate-200 p-5">
                        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-brand-600" /> Luogo
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
                                        className="text-brand-600 hover:underline"
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
                            <Image className="h-4 w-4 text-brand-600" /> Media &amp; Regolamento
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
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">URL volantino (PDF/immagine)</label>
                                <input
                                    type="url"
                                    value={draft.flyerUrl ?? ''}
                                    onChange={e => set('flyerUrl', e.target.value || undefined)}
                                    className={inputCls}
                                    placeholder="https://esempio.com/volantino.pdf"
                                />
                                <p className="text-xs text-slate-400 mt-1">
                                    Locandina della manifestazione, mostrata nella pagina pubblica dell'evento.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Commissione a livello di evento */}
                    <div className="bg-white rounded-xl border border-slate-200 p-5">
                        <h3 className="font-semibold text-slate-800 flex items-center gap-2 mb-3">
                            <Euro className="h-4 w-4 text-brand-600" /> Commissione evento
                        </h3>
                        <p className="text-sm text-slate-500 mb-3">
                            Si applica a tutte le gare di questo evento che non hanno una commissione specifica.
                            Puoi sovrascriverla per singola gara o per singolo step di quota.
                        </p>
                        <CommissionOverrideEditor
                            commission={draft.commission}
                            onChange={c => set('commission', c)}
                            inheritLabel="Usa la commissione globale (impostata in Sconti)"
                            examplePrice={20}
                        />
                    </div>

                    {/* Percorso altimetrico */}
                    <RouteInfoEditor
                        routeInfo={draft.routeInfo}
                        onChange={ri => set('routeInfo', ri)}
                    />

                    {/* Giornate e gare */}
                    <div className="bg-white rounded-xl border border-slate-200 p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-brand-600" /> Giornate e gare
                            </h3>
                            <button
                                type="button"
                                onClick={addDay}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand-200 text-brand-700 text-sm hover:bg-brand-50 transition-colors"
                            >
                                <Plus className="h-4 w-4" /> Aggiungi giornata
                            </button>
                        </div>
                        <p className="text-xs text-slate-400 mb-3">
                            Un evento può avere una o più giornate (es. gare su più giorni). Ogni giornata ha una data e le sue gare.
                        </p>

                        {days.length === 0 ? (
                            <p className="text-sm text-slate-400 italic">Nessuna giornata configurata.</p>
                        ) : (
                            <div className="space-y-5">
                                {days.map((day, di) => (
                                    <div key={day.id} className="rounded-xl border border-slate-200 p-4">
                                        {/* Intestazione giornata */}
                                        <div className="flex flex-wrap items-end gap-3 mb-3">
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 mb-1">Data e ora</label>
                                                <input
                                                    type="datetime-local"
                                                    value={(day.date || '').slice(0, 16)}
                                                    onChange={e => updateDay(day.id, 'date', e.target.value ? e.target.value + ':00' : '')}
                                                    className={inputCls}
                                                />
                                            </div>
                                            <div className="flex-1 min-w-[160px]">
                                                <label className="block text-xs font-medium text-slate-500 mb-1">Etichetta (opzionale)</label>
                                                <input
                                                    type="text"
                                                    value={day.label ?? ''}
                                                    placeholder={`Giornata ${di + 1}`}
                                                    onChange={e => updateDay(day.id, 'label', e.target.value)}
                                                    className={inputCls}
                                                />
                                            </div>
                                            {days.length > 1 && (
                                                <button type="button" onClick={() => removeDay(day.id)} className="p-2 rounded hover:bg-red-50" title="Elimina giornata">
                                                    <Trash2 className="h-4 w-4 text-red-400" />
                                                </button>
                                            )}
                                        </div>

                                        {/* Gare della giornata */}
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Gare ({day.races.length})</span>
                                            <button type="button" onClick={() => addRace(day.id)} className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800">
                                                <Plus className="h-3.5 w-3.5" /> Aggiungi gara
                                            </button>
                                        </div>
                                        {day.races.length === 0 ? (
                                            <p className="text-xs text-slate-400 italic">Nessuna gara in questa giornata.</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {day.races.map(race => (
                                                    <div key={race.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-100 hover:border-slate-200 bg-slate-50 transition-colors">
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-medium text-slate-700 truncate">{race.name}</p>
                                                            <div className="flex flex-wrap gap-2 mt-0.5">
                                                                <span className="text-xs text-slate-400">{race.distance}</span>
                                                                <span className="text-xs text-slate-400">{formatPrice(race.price)}</span>
                                                                {race.priceSteps?.length ? (
                                                                    <span className="text-xs text-brand-500">{race.priceSteps.length} quote</span>
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
                                                            <button type="button" onClick={() => setEditingRaceId(race.id)} className="p-1.5 rounded hover:bg-white transition-colors" title="Modifica">
                                                                <Edit2 className="h-4 w-4 text-slate-500" />
                                                            </button>
                                                            <button type="button" onClick={() => deleteRace(race.id)} className="p-1.5 rounded hover:bg-red-50 transition-colors" title="Elimina">
                                                                <Trash2 className="h-4 w-4 text-red-400" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
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
