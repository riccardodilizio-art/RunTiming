import { useState, useMemo, useCallback, useEffect } from 'react';
import { ammessiGara, ammesso, descriviAmmessi, tesseramentoDaEnte } from '../lib/tesseramenti';
import { allRaces, eventStartDate } from '../utils/event';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import {
    ChevronLeft, ChevronRight, Check, Download, AlertCircle, Tag,
    CreditCard, X, Percent, Euro, Search, ShieldCheck, UserCheck, User,
} from 'lucide-react';
import { useAdminStore, saveRegistration, loadRegistrations, checkDiscountApi } from '../hooks/useAdminStore';
import { USE_API, api, tokenRole } from '../lib/api';
import { takeCaptchaToken } from '../lib/captcha';
import { Captcha } from '../components/Captcha';
import { resolveCommission, calcCommissionAmount } from '../utils/commission';
import { useAthleteAuth } from '../context/useAthleteAuth';
import { useAuth } from '../context/useAuth';
import { useSocietyAuth } from '../context/useSocietyAuth';
import DynamicForm from '../components/registration/DynamicForm';
import { affiliationsFromLegacy } from '../components/athlete/affiliations';
import { verifyTessera, searchByName, FIDAL_SEARCH_ROLES } from '../data/fidalLookup';
import { certExpiresBeforeEvent } from '../utils/cert';
import type { FidalAthlete } from '../data/mockFidal';
import type { Race, FormField, PriceStep, DiscountCode, RaceCategory, CatalogKey, Combinata } from '../types';
import { assignCategory } from '../types';

// Catalog keys che provengono dal PROFILO atleta: auto-compilati e nascosti
// quando l'atleta è loggato (form gara = solo campi extra + consensi).
const PROFILE_CATALOG_KEYS = new Set<CatalogKey>([
    'nome', 'cognome', 'data_nascita', 'anno_nascita', 'sesso', 'email', 'telefono', 'codice_fiscale',
    'societa', 'codice_societa',
    'tessera_fidal', 'tessera_runcard', 'tessera_fci', 'tessera_csi', 'tessera_uisp', 'tessera_fitri', 'tessera_fin',
    'tipo_certificato', 'num_certificato', 'scadenza_certificato', 'gruppo_sanguigno',
    'upload_cert_medico', 'upload_tessera',
]);
function isExtraRegField(f: FormField): boolean {
    return !f.catalogKey || !PROFILE_CATALOG_KEYS.has(f.catalogKey);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getActivePrice(race: Race): { price: number; label: string; step: PriceStep | undefined } {
    const today = new Date().toISOString().slice(0, 10);
    const steps = (race.priceSteps ?? []).filter(s => s.deadline >= today);
    if (steps.length === 0) return { price: race.price, label: 'Prezzo base', step: undefined };
    const best = steps.reduce<PriceStep>((a, b) => b.price < a.price ? b : a, steps[0]);
    return { price: best.price, label: best.label, step: best };
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
                            idx < current ? 'bg-brand-600 text-white'
                            : idx === current ? 'bg-brand-600 text-white ring-4 ring-brand-100'
                            : 'bg-slate-200 text-slate-400'
                        }`}>
                            {idx < current ? <Check className="h-4 w-4" /> : idx + 1}
                        </div>
                        <span className={`mt-1.5 text-xs font-medium hidden sm:block ${
                            idx === current ? 'text-brand-700' : 'text-slate-400'
                        }`}>{label}</span>
                    </div>
                    {idx < STEPS.length - 1 && (
                        <div className={`w-10 sm:w-16 h-0.5 mx-1 transition-colors ${idx < current ? 'bg-brand-600' : 'bg-slate-200'}`} />
                    )}
                </div>
            ))}
        </div>
    );
}

// ─── Step 1 — Race picker ─────────────────────────────────────────────────────

/** Combinate disponibili: tutte le gare incluse con iscrizioni aperte. */
function openCombinate(event: { combinate?: Combinata[] } | undefined, races: Race[]): Combinata[] {
    return (event?.combinate ?? []).filter(c => c.raceIds.length >= 2 && c.raceIds.every(id => races.some(r => r.id === id && r.isOpen)));
}

function RacePicker({ races, selectedId, onSelect, combinate = [], comboId = '', onSelectCombo }: {
    races: Race[]; selectedId: string; onSelect: (id: string) => void;
    combinate?: Combinata[]; comboId?: string; onSelectCombo?: (c: Combinata) => void;
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
            {combinate.map(c => {
                const nomi = c.raceIds.map(id => races.find(r => r.id === id)?.name).filter(Boolean);
                const separate = c.raceIds.reduce((t, id) => { const r = races.find(x => x.id === id); return t + (r ? getActivePrice(r).price : 0); }, 0);
                return (
                    <button key={c.id} type="button" onClick={() => onSelectCombo?.(c)}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all ${comboId === c.id ? 'border-brand-500 bg-brand-50 shadow-md' : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                                    <span className="text-[10px] font-bold uppercase tracking-wide bg-brand-600 text-white rounded px-1.5 py-0.5">Combinata</span> {c.nome}
                                </p>
                                <p className="text-sm text-slate-500 mt-0.5">{nomi.join(' + ')}</p>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="font-bold text-brand-700 text-lg">{formatPrice(c.prezzo)}</p>
                                {separate > c.prezzo && <p className="text-xs text-slate-400 line-through">{formatPrice(separate)}</p>}
                            </div>
                        </div>
                        <p className="text-xs text-slate-500 mt-2">Un'iscrizione e un pagamento per tutte le gare. Già iscritto a una di queste gare? Paghi solo la differenza.</p>
                    </button>
                );
            })}
            {openRaces.map(race => {
                const { price, label: priceLabel } = getActivePrice(race);
                const unlimited = !race.maxParticipants; // 0 = senza limite
                const spotsLeft = race.maxParticipants - race.participants;
                const pct = unlimited ? 0 : race.participants / race.maxParticipants;
                return (
                    <button
                        key={race.id}
                        type="button"
                        onClick={() => onSelect(race.id)}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                            selectedId === race.id && !comboId ? 'border-brand-500 bg-brand-50 shadow-md' : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="font-semibold text-slate-800">{race.name}</p>
                                <p className="text-sm text-slate-500 mt-0.5">{race.distance}</p>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="font-bold text-brand-700 text-lg">{formatPrice(price)}</p>
                                <p className="text-xs text-slate-400">{priceLabel}</p>
                            </div>
                        </div>
                        <div className="mt-3">
                            <div className="flex justify-between text-xs text-slate-400 mb-1">
                                <span>{race.participants} iscritti</span>
                                <span>{unlimited ? 'posti disponibili' : `${spotsLeft} posti rimasti`}</span>
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
                                        <span key={step.id} className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${active ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-400 line-through'}`}>
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

// ─── FIDAL Lookup widget ──────────────────────────────────────────────────────

function FidalLookup({
    onPrefill,
    raceId,
}: {
    onPrefill: (athlete: FidalAthlete) => void;
    raceId?: string;
}) {
    const [mode, setMode] = useState<'tessera' | 'nome'>('tessera');
    const [tessera, setTessera] = useState('');
    const [cognome, setCognome] = useState('');
    const [nascita, setNascita] = useState('');
    const [nome, setNome] = useState('');
    const [results, setResults] = useState<FidalAthlete[] | null>(null);
    const [found, setFound] = useState<FidalAthlete | null>(null);
    const [open, setOpen] = useState(true);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState('');
    // Con l'API la ricerca per nome nell'anagrafica FIDAL è riservata allo staff
    const canSearchByName = !USE_API || FIDAL_SEARCH_ROLES.includes(tokenRole() ?? '');
    const needsCognome = USE_API && mode === 'tessera';

    async function handleSearch() {
        if (searching) return;
        setSearching(true);
        setError('');
        try {
            if (mode === 'tessera') {
                const a = await verifyTessera(tessera, cognome, nascita, raceId);
                setResults(null);
                setFound(a);
                if (!a) setResults([]);
            } else {
                const list = await searchByName(cognome, nome);
                setResults(list);
                setFound(null);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Ricerca non riuscita');
        } finally {
            setSearching(false);
        }
    }

    function handleSelect(a: FidalAthlete) {
        setFound(a);
        setResults(null);
    }

    function handleUse() {
        if (found) { onPrefill(found); setOpen(false); }
    }

    if (!open) return null;

    return (
        <div className="mb-5 rounded-xl border border-brand-200 bg-brand-50/60 p-4">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-brand-800 flex items-center gap-2">
                    <UserCheck className="h-4 w-4" /> Cerca dati atleta (FIDAL / RunCard)
                </h3>
                <button onClick={() => setOpen(false)} className="text-xs text-slate-400 hover:text-slate-600">
                    Salta, compila manualmente
                </button>
            </div>
            <p className="text-xs text-slate-500 mb-3">
                Se sei tesserato FIDAL o RunCard, inserisci il numero tessera{USE_API ? ', il cognome e la data di nascita' : ''} per caricare automaticamente i tuoi dati.
            </p>

            {/* Mode toggle */}
            {canSearchByName && <div className="flex gap-2 mb-3">
                {(['tessera', 'nome'] as const).map(m => (
                    <button
                        key={m}
                        type="button"
                        onClick={() => { setMode(m); setResults(null); setFound(null); }}
                        className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                            mode === m ? 'border-brand-500 bg-brand-500 text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        {m === 'tessera' ? 'Per numero tessera' : 'Per cognome / nome'}
                    </button>
                ))}
            </div>}

            {mode === 'tessera' ? (
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={tessera}
                        onChange={e => { setTessera(e.target.value.toUpperCase()); setFound(null); setResults(null); }}
                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                        placeholder="es. RM001234 oppure RC001122"
                        className="flex-1 min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500 uppercase"
                    />
                    {needsCognome && (
                        <input
                            type="text"
                            value={cognome}
                            onChange={e => { setCognome(e.target.value); setFound(null); setResults(null); }}
                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                            placeholder="Cognome *"
                            aria-label="Cognome"
                            className="flex-1 min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                    )}
                    {needsCognome && (
                        <input
                            type="date"
                            value={nascita}
                            onChange={e => { setNascita(e.target.value); setFound(null); setResults(null); }}
                            aria-label="Data di nascita"
                            title="Data di nascita"
                            className="flex-1 min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                    )}
                    <button type="button" onClick={handleSearch} disabled={!tessera.trim() || (needsCognome && (!cognome.trim() || !nascita)) || searching}
                        className="flex items-center gap-1 px-3 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-40">
                        <Search className="h-4 w-4" /> {searching ? 'Cerco…' : 'Cerca'}
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-2 mb-2">
                    <input type="text" value={cognome} onChange={e => setCognome(e.target.value)} placeholder="Cognome *"
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                    <div className="flex gap-2">
                        <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome (opzionale)"
                            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                        <button type="button" onClick={handleSearch} disabled={!cognome.trim() || searching}
                            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-40">
                            <Search className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Results list (nome search) */}
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
            {results !== null && results.length === 0 && (
                <p className="mt-2 text-xs text-slate-500">{needsCognome ? 'Nessun tesserato con questa tessera, cognome e data di nascita. Controlla i dati o compila manualmente il modulo.' : 'Nessun atleta trovato. Compila manualmente il modulo.'}</p>
            )}
            {results && results.length > 0 && (
                <div className="mt-2 border border-slate-200 rounded-lg bg-white divide-y divide-slate-100 max-h-40 overflow-y-auto">
                    {results.map(a => (
                        <button key={a.tessera} type="button" onClick={() => handleSelect(a)}
                            className="w-full text-left px-3 py-2 hover:bg-brand-50 transition-colors">
                            <span className="text-sm font-medium text-slate-800">{a.cognome} {a.nome}</span>
                            <span className="ml-2 text-xs text-slate-400">{a.tessera} · {a.societa}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Found athlete card */}
            {found && (
                <div className="mt-3 p-3 rounded-lg border border-green-200 bg-green-50">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <ShieldCheck className="h-4 w-4 text-green-600" />
                                <span className="text-sm font-semibold text-green-800">{found.cognome} {found.nome}</span>
                                <span className="text-xs px-1.5 py-0.5 rounded bg-green-200 text-green-800 font-mono">{found.tessera}</span>
                                <span className="text-xs text-green-600 uppercase font-semibold">{found.tipo}</span>
                            </div>
                            <p className="text-xs text-slate-600">
                                {found.sesso === 'M' ? 'Maschile' : 'Femminile'} ·{' '}
                                {new Date(found.dataNascita).toLocaleDateString('it-IT')} ·{' '}
                                {found.societa || 'Individuale'}
                            </p>
                            {found.certScadenza && (
                                <p className="text-xs text-green-600 mt-0.5">
                                    ✓ Certificato medico scade il {found.certScadenza}
                                </p>
                            )}
                            {!found.certScadenza && (
                                <p className="text-xs text-amber-600 mt-0.5">
                                    ⚠ Scadenza certificato non disponibile — potrà essere richiesta dall'organizzatore
                                </p>
                            )}
                        </div>
                        <button type="button" onClick={handleUse}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 shrink-0">
                            <Check className="h-3.5 w-3.5" /> Usa questi dati
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Step 3 — Summary + discount code ────────────────────────────────────────

function Summary({
    race, fields, data,
    appliedDiscount, onApplyDiscount, validateCode,
    assignedCat, fidalVerified, combo,
}: {
    combo?: Combinata;
    race: Race;
    fields: FormField[];
    data: Record<string, string | boolean>;
    appliedDiscount: DiscountCode | null;
    onApplyDiscount: (code: DiscountCode | null) => void;
    validateCode: (code: string) => DiscountCode | null | Promise<DiscountCode | null>;
    assignedCat: RaceCategory | null;
    fidalVerified: boolean;
}) {
    const active = getActivePrice(race);
    const price = combo ? combo.prezzo : active.price;
    const priceLabel = combo ? `Combinata ${combo.nome}` : active.label;
    const [codeInput, setCodeInput] = useState('');
    const [codeError, setCodeError] = useState('');

    async function handleApplyCode() {
        let result: DiscountCode | null = null;
        try { result = await validateCode(codeInput.trim()); } catch { result = null; }
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
                        {assignedCat && (
                            <span className="inline-flex items-center gap-1 mt-1 text-xs px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 font-medium">
                                Categoria: {assignedCat.name}
                            </span>
                        )}
                    </div>
                    <div className="text-right">
                        <p className="font-bold text-brand-700 text-xl">{formatPrice(price)}</p>
                        <p className="text-xs text-slate-400">{priceLabel}</p>
                    </div>
                </div>
                {fidalVerified && (
                    <div className="flex items-center gap-1.5 mt-3 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
                        <ShieldCheck className="h-3.5 w-3.5" /> Dati verificati tramite tessera FIDAL/RunCard
                    </div>
                )}
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

            {/* Codice sconto (non vale sulle combinate) */}
            {!combo && <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
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
                                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-brand-500 uppercase"
                            />
                            <button
                                type="button"
                                onClick={handleApplyCode}
                                disabled={!codeInput.trim()}
                                className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-40 transition-colors"
                            >
                                Applica
                            </button>
                        </div>
                        {codeError && <p className="text-xs text-red-500 mt-1">{codeError}</p>}
                    </div>
                )}
            </div>}

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
                        <span className="font-bold text-brand-700 text-lg">{formatPrice(finalPrice)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Step 4 — Payment ─────────────────────────────────────────────────────────

/** paypal comprende anche le carte (gestite da PayPal: i dati carta non passano dal sito). */
type PaymentMethod = 'paypal' | 'bank' | 'free' | 'onsite';

interface FeeSettings { bankFee: number; paypalPercent: number; paypalFixed: number; bankDays: number }
const DEFAULT_FEES: FeeSettings = { bankFee: 1, paypalPercent: 3.4, paypalFixed: 0.35, bankDays: 5 };

/** Stessa formula del server (registrations/rules.ts → paymentFee). */
function methodFee(m: PaymentMethod, amount: number, f: FeeSettings): number {
    if (amount <= 0) return 0;
    if (m === 'bank') return f.bankFee;
    if (m === 'paypal') return Math.round((amount * f.paypalPercent / 100 + f.paypalFixed) * 100) / 100;
    return 0;
}

function MethodButton({ active, onClick, icon, title, subtitle, extra }: {
    active: boolean; onClick: () => void; icon: React.ReactNode; title: string; subtitle: string; extra?: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
                active ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
        >
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0">{icon}</div>
            <div className="min-w-0">
                <p className="font-semibold text-slate-800">{title}</p>
                <p className="text-xs text-slate-400">{subtitle}</p>
            </div>
            <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                {extra && <span className="text-xs font-medium text-slate-500">{extra}</span>}
                {active && <Check className="h-5 w-5 text-brand-600" />}
            </div>
        </button>
    );
}

function PaymentStep({
    totalPrice,
    method,
    onMethodChange,
    allowOnline = true,
    allowOnsite = false,
    fees,
}: {
    totalPrice: number;
    method: PaymentMethod;
    onMethodChange: (m: PaymentMethod) => void;
    allowOnline?: boolean;
    allowOnsite?: boolean;
    fees: FeeSettings;
}) {
    const isFree = totalPrice <= 0;
    const fee = methodFee(method, totalPrice, fees);
    const plus = (m: PaymentMethod) => {
        const f = methodFee(m, totalPrice, fees);
        return f > 0 ? `+ ${formatPrice(f)}` : undefined;
    };

    return (
        <div className="space-y-5">
            {/* Amount due */}
            <div className="bg-brand-50 rounded-xl p-4 border border-brand-200">
                <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700">Importo da pagare</span>
                    <span className="text-2xl font-bold text-brand-700">
                        {isFree ? 'Gratuito' : formatPrice(totalPrice + fee)}
                    </span>
                </div>
                {!isFree && fee > 0 && (
                    <p className="text-xs text-slate-500 mt-1 text-right">
                        quota {formatPrice(totalPrice)} + {method === 'bank' ? 'gestione bonifico' : 'commissione PayPal/carta'} {formatPrice(fee)}
                    </p>
                )}
            </div>

            {isFree ? (
                <div className="text-center py-6 text-slate-500 text-sm">
                    <Check className="h-10 w-10 text-green-500 mx-auto mb-2" />
                    Nessun pagamento richiesto. Prosegui per confermare l'iscrizione.
                </div>
            ) : (
                <div className="space-y-3">
                    <p className="text-sm font-medium text-slate-700">Seleziona metodo di pagamento</p>

                    {allowOnline && (<>
                        <MethodButton
                            active={method === 'paypal'}
                            onClick={() => onMethodChange('paypal')}
                            icon={<div className="w-10 h-10 bg-[#003087] rounded-lg flex items-center justify-center"><CreditCard className="h-5 w-5 text-white" /></div>}
                            title="PayPal o carta di credito"
                            subtitle="Visa, Mastercard, Amex anche senza conto PayPal · conferma immediata"
                            extra={plus('paypal')}
                        />
                        <MethodButton
                            active={method === 'bank'}
                            onClick={() => onMethodChange('bank')}
                            icon={<div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center"><Euro className="h-5 w-5 text-white" /></div>}
                            title="Bonifico bancario"
                            subtitle={`Ricevi IBAN e causale · da effettuare entro ${fees.bankDays} giorni`}
                            extra={plus('bank')}
                        />
                    </>)}

                    {allowOnsite && (
                        <MethodButton
                            active={method === 'onsite'}
                            onClick={() => onMethodChange('onsite')}
                            icon={<div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center"><Euro className="h-5 w-5 text-white" /></div>}
                            title="Paga in loco il giorno della gara"
                            subtitle="L'iscrizione resta valida; la quota si salda al ritiro pettorale."
                        />
                    )}

                    {allowOnline && !allowOnsite && (
                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                            Per questa gara il pagamento anticipato è obbligatorio: le iscrizioni non pagate entro la scadenza vengono annullate.
                        </p>
                    )}
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                        <Percent className="h-3.5 w-3.5" />
                        <span>Il pagamento con carta avviene sui server di PayPal: i dati della carta non passano da questo sito.</span>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Step 5 — Confirmation ────────────────────────────────────────────────────

function Confirmation({ submissionId, raceName, eventTitle, pricePaid, paymentMethod, athleteLoggedIn }: {
    submissionId: string;
    raceName: string;
    eventTitle: string;
    pricePaid: number;
    paymentMethod: PaymentMethod;
    athleteLoggedIn: boolean;
}) {
    function downloadReceipt() {
        const content = [
            'RICEVUTA DI ISCRIZIONE',
            '======================',
            `N° iscrizione: ${submissionId}`,
            `Evento: ${eventTitle}`,
            `Distanza: ${raceName}`,
            `Importo: ${formatPrice(pricePaid)}`,
            `Metodo: ${paymentMethod === 'paypal' ? 'PayPal / carta' : paymentMethod === 'bank' ? 'Bonifico' : paymentMethod === 'onsite' ? 'In loco' : 'Gratuito'}`,
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
                {athleteLoggedIn ? (
                    <Link
                        to="/profilo"
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
                    >
                        <User className="h-4 w-4" /> Il mio profilo
                    </Link>
                ) : (
                    <Link
                        to="/events"
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
                    >
                        Torna agli eventi
                    </Link>
                )}
            </div>
            {!athleteLoggedIn && (
                <p className="text-sm text-slate-400 mt-4">
                    Vuoi tracciare le tue gare?{' '}
                    <Link to="/registrati" className="text-brand-600 hover:underline">Crea un account gratuito</Link>
                </p>
            )}
        </div>
    );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function RegisterPage() {
    const { slug } = useParams<{ slug: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { getEvent, commission, validateDiscountCode, applyDiscountCode } = useAdminStore();
    const { currentAthlete, register: registerAthlete } = useAthleteAuth();
    const { isAdmin, isOrganizer, canManageEvent } = useAuth();
    const { currentSociety } = useSocietyAuth();

    const event = slug ? getEvent(slug) : undefined;
    const staffEnroll = !!event && (isAdmin || (isOrganizer && canManageEvent(event.id)));
    const eventRaces = useMemo(() => event ? allRaces(event) : [], [event]);
    const raceParam = searchParams.get('race');
    const searchParamCombo = searchParams.get('combinata') ?? '';
    const initialRaceId = raceParam ?? eventRaces[0]?.id ?? '';
    // Se si arriva con una gara già scelta e valida, salta lo step "Scelta gara".
    const startAtData = !!raceParam && eventRaces.some(r => r.id === raceParam && r.isOpen);

    const [step, setStep] = useState(startAtData ? 1 : 0);
    const [selectedRaceId, setSelectedRaceId] = useState(initialRaceId);
    // Combinata scelta (selectedRaceId = la sua prima gara: modulo e pagamento)
    const [comboId, setComboId] = useState(searchParamCombo);
    const [formData, setFormData] = useState<Record<string, string | boolean>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [appliedDiscount, setAppliedDiscount] = useState<DiscountCode | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('paypal');
    // Maggiorazioni dei metodi (bonifico +1 €, PayPal %): dal server, se disponibile
    const [fees, setFees] = useState<FeeSettings>(DEFAULT_FEES);
    useEffect(() => {
        if (!USE_API) return;
        api.get<FeeSettings>('/settings/payments').then(f => setFees({ ...DEFAULT_FEES, ...f })).catch(() => undefined);
    }, []);
    const [submissionId, setSubmissionId] = useState('');
    const [fidalVerified, setFidalVerified] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    // Scadenza certificato dell'atleta selezionato via FIDAL (per il controllo
    // sulla data evento). WISE non la fornisce: arriva dal dump quando presente.
    const [fidalCertScadenza, setFidalCertScadenza] = useState<string | undefined>(undefined);
    const [fidalCertStatus, setFidalCertStatus] = useState<FidalAthlete['certificato']>(undefined);

    // Con il backend l'evento arriva dopo il primo render: quando c'è, seleziona
    // la gara (e salta "Scelta gara" se arrivata dal link) come fa il primo render.
    const firstRaceId = eventRaces[0]?.id;
    useEffect(() => {
        if (!selectedRaceId && firstRaceId) setSelectedRaceId(raceParam ?? firstRaceId);
        if (startAtData) setStep(st => (st === 0 ? 1 : st));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [firstRaceId, startAtData]);

    // Scelta FIDAL / non-FIDAL (null = non ancora scelto)
    const [isFidal, setIsFidal] = useState<boolean | null>(null);


    // Certificato già verificato nell'account atleta?
    const today = new Date().toISOString().slice(0, 10);
    const certValidFromAccount =
        currentAthlete?.certStatus === 'verificato' &&
        currentAthlete?.certExpiry &&
        currentAthlete.certExpiry >= today;

    // Modal post-FIDAL: crea account con solo email+password
    const [showAccountModal, setShowAccountModal] = useState(false);
    const [accountEmail, setAccountEmail] = useState('');
    const [accountPassword, setAccountPassword] = useState('');
    const [accountError, setAccountError] = useState('');

    const selectedRace = useMemo(
        () => eventRaces.find(r => r.id === selectedRaceId),
        [eventRaces, selectedRaceId]
    );
    const combinate = useMemo(() => openCombinate(event, eventRaces), [event, eventRaces]);
    const combo = useMemo(() => combinate.find(c => c.id === comboId), [combinate, comboId]);

    // ── Requisito tesseramento per ente gara ──
    const athleteAffiliations = useMemo(
        () => currentAthlete
            ? (currentAthlete.affiliations ?? affiliationsFromLegacy(currentAthlete.fidalTessera, currentAthlete.runcardTessera, currentAthlete.club))
            : [],
        [currentAthlete]
    );
    const raceEnte = selectedRace?.ente;
    // Gara riservata (es. solo FIDAL, FIDAL + Runcard): solo i tesseramenti ammessi, FIDAL per primo
    const restricted = ammessiGara(selectedRace).length > 0;
    const eligibleAffs = useMemo(() => {
        if (!currentAthlete) return [];
        if (restricted) {
            return athleteAffiliations
                .filter(a => ammesso(selectedRace, tesseramentoDaEnte(a.ente, a.societaNome)))
                .sort((a, b) => Number(b.ente === 'fidal') - Number(a.ente === 'fidal'));
        }
        if (!raceEnte || raceEnte === 'non_competitiva') return [];
        return athleteAffiliations; // gara aperta: scelta libera tra i tesseramenti
    }, [currentAthlete, raceEnte, athleteAffiliations, restricted, selectedRace]);
    const needsFidalAff = !!currentAthlete && restricted && !ammesso(selectedRace, 'libero');
    const [selectedAffId, setSelectedAffId] = useState('');
    // reset alla prima opzione quando cambia la gara o l'atleta
    useEffect(() => {
        setSelectedAffId(eligibleAffs[0]?.id ?? '');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedRaceId, currentAthlete?.id]);
    const chosenAff = eligibleAffs.find(a => a.id === selectedAffId);
    const missingFidalAff = needsFidalAff && eligibleAffs.length === 0;
    const fields = useMemo(() => selectedRace?.formSchema ?? [], [selectedRace]);
    // Quando l'atleta è loggato, il modulo gara mostra SOLO i campi extra
    // (taglia, note, consensi…): i dati di profilo arrivano dall'account.
    const visibleFields = useMemo(
        () => currentAthlete ? fields.filter(isExtraRegField) : fields,
        [fields, currentAthlete]
    );

    // Categoria assegnata in base ai dati inseriti
    const assignedCat = useMemo<RaceCategory | null>(() => {
        if (!selectedRace?.categories?.length) return null;
        const annoField = fields.find(f => f.catalogKey === 'anno_nascita');
        const sessoField = fields.find(f => f.catalogKey === 'sesso');
        const birthYear = annoField ? parseInt(formData[annoField.id] as string) : 0;
        const gender = sessoField ? (formData[sessoField.id] as string) : '';
        if (!birthYear || !gender) return null;
        return assignCategory(selectedRace.categories, birthYear, gender);
    }, [selectedRace, fields, formData]);

    // Prefill form da account atleta loggato (applicato quando cambiano i fields)
    useEffect(() => {
        if (!currentAthlete || fields.length === 0) return;
        const birthYear = currentAthlete.birthDate
            ? new Date(currentAthlete.birthDate).getFullYear()
            : undefined;
        const updates: Record<string, string | boolean> = {};
        fields.forEach(f => {
            if (f.catalogKey === 'nome')            updates[f.id] = currentAthlete.name;
            if (f.catalogKey === 'cognome')         updates[f.id] = currentAthlete.surname;
            if (f.catalogKey === 'email')           updates[f.id] = currentAthlete.email;
            if (f.catalogKey === 'telefono' && currentAthlete.phone)      updates[f.id] = currentAthlete.phone;
            if (f.catalogKey === 'societa' && currentAthlete.club)        updates[f.id] = currentAthlete.club;
            if (f.catalogKey === 'codice_fiscale' && currentAthlete.codFiscale) updates[f.id] = currentAthlete.codFiscale;
            if (f.catalogKey === 'anno_nascita' && birthYear)   updates[f.id] = String(birthYear);
            if (f.catalogKey === 'data_nascita' && currentAthlete.birthDate)    updates[f.id] = currentAthlete.birthDate;
            if (f.catalogKey === 'sesso')           updates[f.id] = currentAthlete.gender;
            const affs = currentAthlete.affiliations ?? [];
            const fidalT = affs.find(a => a.ente === 'fidal')?.numeroTessera ?? currentAthlete.fidalTessera;
            const otherT = affs.find(a => a.ente !== 'fidal' && a.numeroTessera)?.numeroTessera ?? currentAthlete.runcardTessera;
            if (f.catalogKey === 'tessera_fidal' && fidalT) updates[f.id] = fidalT;
            if (f.catalogKey === 'tessera_runcard' && otherT) updates[f.id] = otherT;
        });
        if (Object.keys(updates).length > 0) {
            setFormData(prev => ({ ...prev, ...updates }));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fields]);

    // Prefill form con dati atleta FIDAL
    function handleFidalPrefill(athlete: FidalAthlete) {
        const updates: Record<string, string | boolean> = {};
        fields.forEach(f => {
            if (f.catalogKey === 'nome') updates[f.id] = athlete.nome;
            if (f.catalogKey === 'cognome') updates[f.id] = athlete.cognome;
            if (f.catalogKey === 'data_nascita') updates[f.id] = athlete.dataNascita;
            if (f.catalogKey === 'sesso') updates[f.id] = athlete.sesso;
            if (f.catalogKey === 'societa') updates[f.id] = athlete.societa;
            if (f.catalogKey === 'codice_societa') updates[f.id] = athlete.codiceSocieta;
            if (f.catalogKey === 'tessera_fidal' && athlete.tipo === 'fidal') updates[f.id] = athlete.tessera;
            if (f.catalogKey === 'tessera_runcard' && athlete.tipo === 'runcard') updates[f.id] = athlete.tessera;
        });
        setFormData(prev => ({ ...prev, ...updates }));
        setFidalVerified(true);
        setFidalCertScadenza(athlete.certScadenza);
        setFidalCertStatus(athlete.certificato);
    }

    // Scadenza certificato nota (da FIDAL o dall'account) e verifica rispetto
    // alla DATA DELL'EVENTO: un certificato che scade prima della gara non è valido.
    const certScadenza = fidalCertScadenza ?? currentAthlete?.certExpiry;
    const eventDateStr = event ? eventStartDate(event) : undefined;
    const certExpiredForEvent =
        !!selectedRace?.requiresMedicalCert &&
        (fidalCertStatus === 'scaduto' || certExpiresBeforeEvent(certScadenza, eventDateStr));

    // Price calculation
    const activeStep = useMemo(() => selectedRace ? getActivePrice(selectedRace).step : undefined, [selectedRace]);
    const basePrice  = useMemo(() => combo ? combo.prezzo : selectedRace ? getActivePrice(selectedRace).price : 0, [selectedRace, combo]);
    const discountAmount = useMemo(
        () => appliedDiscount ? calcDiscount(basePrice, appliedDiscount) : 0,
        [appliedDiscount, basePrice]
    );
    // Commissione effettiva: step > gara > evento > globale
    const effectiveCommission = useMemo(
        () => resolveCommission(commission, event, selectedRace ?? undefined, activeStep),
        [commission, event, selectedRace, activeStep]
    );
    const commissionAmount = useMemo(() => {
        if (effectiveCommission.appliedTo !== 'buyer') return 0;
        const afterDiscount = Math.max(0, basePrice - discountAmount);
        return calcCommissionAmount(effectiveCommission, afterDiscount);
    }, [effectiveCommission, basePrice, discountAmount]);
    const totalPrice = Math.max(0, basePrice - discountAmount + commissionAmount);
    // Modalità di pagamento della gara (online / in loco / entrambe / nessuno)
    const paymentMode = selectedRace?.paymentMode ?? 'both';
    const allowOnline = paymentMode === 'online' || paymentMode === 'both';
    const allowOnsite = paymentMode === 'onsite' || paymentMode === 'both';
    const isFree = totalPrice <= 0 || paymentMode === 'none';

    // Allinea il metodo selezionato alle modalità ammesse dalla gara
    useEffect(() => {
        if (paymentMode === 'onsite') setPaymentMethod('onsite');
        else if (paymentMode === 'online' || paymentMode === 'both') {
            setPaymentMethod(m => m === 'onsite' ? 'paypal' : m);
        }
    }, [paymentMode]);

    const handleFormChange = useCallback((data: Record<string, string | boolean>) => {
        setFormData(data);
    }, []);

    // Controllo doppia iscrizione: atleta loggato già iscritto a questo evento
    const alreadyRegistered = useMemo(() => {
        if (!currentAthlete || !event) return false;
        // Già iscritto alla gara scelta (o a tutte le gare della combinata):
        // può comunque iscriversi alle altre gare dell'evento o aggiungere la combinata
        const mine = loadRegistrations().filter(
            r => r.eventId === event.id && r.athleteAccountId === currentAthlete.id && r.paymentStatus !== 'rejected'
        );
        const targets = combo ? combo.raceIds : selectedRaceId ? [selectedRaceId] : [];
        return targets.length > 0 && targets.every(id => mine.some(r => r.raceId === id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentAthlete?.id, event?.id, selectedRaceId, combo?.id]);

    if (!event) {
        return (
            <main className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-slate-500 mb-4">Evento non trovato.</p>
                    <Link to="/events" className="text-brand-600 hover:underline text-sm">← Torna agli eventi</Link>
                </div>
            </main>
        );
    }

    // Lo staff (admin / organizzatore) non si iscrive come atleta: lo indirizziamo
    // all'iscrizione rapida dalla scheda evento.
    if (staffEnroll) {
        return (
            <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
                <div className="text-center max-w-sm bg-white border border-slate-200 rounded-2xl p-8" style={{ boxShadow: '2px 4px 6px 0 #eeeeee' }}>
                    <p className="font-display font-700 text-lg text-slate-800 mb-2">Sei loggato come staff</p>
                    <p className="text-sm text-slate-500 mb-5">
                        Come admin/organizzatore non puoi iscriverti come atleta. Usa
                        l'<strong>iscrizione rapida</strong> dalla scheda evento per registrare gli atleti.
                    </p>
                    <Link
                        to={`/events/${event.slug}`}
                        className="inline-block bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
                    >
                        Vai alla scheda evento
                    </Link>
                </div>
            </main>
        );
    }

    // La società non si iscrive come singolo: iscrive i propri atleti dalla dashboard.
    if (currentSociety) {
        return (
            <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
                <div className="text-center max-w-sm bg-white border border-slate-200 rounded-2xl p-8" style={{ boxShadow: '2px 4px 6px 0 #eeeeee' }}>
                    <p className="font-display font-700 text-lg text-slate-800 mb-2">Sei loggato come società</p>
                    <p className="text-sm text-slate-500 mb-5">
                        Iscrivi i tuoi atleti alle gare dalla <strong>dashboard società</strong>,
                        non come singolo partecipante.
                    </p>
                    <Link
                        to="/societa"
                        className="inline-block bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
                    >
                        Vai alla dashboard società
                    </Link>
                </div>
            </main>
        );
    }

    function validateForm(): boolean {
        const newErrors: Record<string, string> = {};
        for (const field of visibleFields) {
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

    /** Valore di un campo del modulo per chiave di catalogo (nome, cognome, …). */
    function byCatalog(key: CatalogKey): string {
        const f = fields.find(ff => ff.catalogKey === key);
        const v = f ? formData[f.id] : undefined;
        return typeof v === 'string' ? v.trim() : '';
    }

    /** Invio al backend: il server ricalcola prezzo, categoria e controlli. */
    async function submitToApi() {
        if (!selectedRace) return;
        const anno = byCatalog('anno_nascita');
        const dataNascita = byCatalog('data_nascita') || (anno ? `${anno}-01-01` : '');
        const sesso = (byCatalog('sesso') || currentAthlete?.gender || '').toUpperCase();
        setSubmitting(true);
        try {
            const asAthlete = tokenRole() === 'ATHLETE' && !!currentAthlete;
            const r = await api.post<{ registration: { id: string; paymentRef?: string | null; paymentMethod?: string } }>('/registrations', {
                raceId: selectedRace.id,
                combinataId: combo?.id,
                formData,
                discountCode: combo ? undefined : appliedDiscount?.code,
                paymentMethod: isFree ? undefined : paymentMethod,
                // Atleta con account: anagrafica e tesseramento li prende il server dal profilo
                affiliationId: asAthlete ? selectedAffId || undefined : undefined,
                athlete: asAthlete ? undefined : {
                    nome: byCatalog('nome') || currentAthlete?.name || '',
                    cognome: byCatalog('cognome') || currentAthlete?.surname || '',
                    dataNascita: dataNascita || currentAthlete?.birthDate || '',
                    sesso,
                    societa: byCatalog('societa') || chosenAff?.societaNome || currentAthlete?.club || undefined,
                    codiceSocieta: byCatalog('codice_societa') || chosenAff?.codiceSocieta || undefined,
                    tessera: byCatalog('tessera_fidal') || byCatalog('tessera_runcard') || chosenAff?.numeroTessera || undefined,
                    email: byCatalog('email') || currentAthlete?.email || undefined,
                },
                // Iscrizione senza account: verifica anti-bot (se attiva)
                captchaToken: tokenRole() ? undefined : takeCaptchaToken(),
            });
            // PayPal/carta o bonifico: si va alla pagina di pagamento (link valido anche dopo)
            const ref = r.registration.paymentRef;
            if (ref && (r.registration.paymentMethod === 'paypal' || r.registration.paymentMethod === 'bank')) {
                navigate(`/pagamento/${ref}`);
                return;
            }
            setSubmissionId(r.registration.id);
            setStep(s => s + 1);
            if (isFidal && !currentAthlete) setTimeout(() => setShowAccountModal(true), 600);
        } catch (e) {
            window.alert(e instanceof Error ? e.message : 'Iscrizione non riuscita');
        } finally {
            setSubmitting(false);
        }
    }

    function handleNext() {
        if (step === 0 && !selectedRaceId) return;
        if (step === 1 && !validateForm()) return;
        if (step === 3 && USE_API) {
            void submitToApi();
            return;
        }
        if (step === 3) {
            // Payment confirmed — submit
            if (!selectedRace || !event) return;
            const id = `reg_${Date.now()}`;
            if (appliedDiscount) applyDiscountCode(appliedDiscount.id);
            const needsCert = selectedRace.requiresMedicalCert;
            const fidalReg = fidalVerified || chosenAff?.ente === 'fidal';
            // Se il certificato scade PRIMA dell'evento non è valido: va rinnovato
            // e verificato, a prescindere dal tesseramento FIDAL.
            const certStatus = !needsCert ? 'non_richiesto'
                : certExpiredForEvent ? 'in_attesa'
                : fidalReg ? 'verificato'               // tesserato FIDAL → cert valido in automatico
                : certValidFromAccount ? 'verificato'   // cert già ok nell'account
                : 'in_attesa';
            saveRegistration({
                id,
                eventId: event.id,
                raceId: selectedRaceId,
                submittedAt: new Date().toISOString(),
                formData,
                pricePaid: totalPrice,
                discountCode: appliedDiscount?.code,
                discountAmount: discountAmount > 0 ? discountAmount : undefined,
                paymentMethod: isFree ? 'free' : paymentMethod === 'paypal' ? 'paypal' : 'manual',
                assignedCategory: assignedCat?.name,
                fidalVerified: fidalVerified || chosenAff?.ente === 'fidal',
                paymentStatus: 'pending',
                athleteAccountId: currentAthlete?.id,
                certStatus,
                // certInfo: popolato dal backend tramite l'account atleta
                certInfo: currentAthlete?.certType && currentAthlete?.certExpiry
                    ? { tipo: currentAthlete.certType, scadenza: currentAthlete.certExpiry, numero: currentAthlete.certNumber }
                    : undefined,
            });
            setSubmissionId(id);
            // Proponi creazione account post-FIDAL
            if (isFidal && !currentAthlete) {
                setTimeout(() => setShowAccountModal(true), 600);
            }
        }
        setStep(s => s + 1);
    }

    function handleBack() {
        if (step === 0) navigate(`/events/${slug}`);
        else setStep(s => s - 1);
    }

    const isLastStep = step === STEPS.length - 2; // step 3 = pagamento
    const nextLabel = isLastStep
        ? ((isFree || paymentMethod === 'onsite') ? 'Conferma iscrizione' : paymentMethod === 'bank' ? 'Conferma e vedi dati bonifico' : 'Conferma e paga')
        : 'Continua';
    // Blocca "Continua" in step 1:
    // - guest su gara competitiva che non ha ancora scelto FIDAL/non-FIDAL;
    // - atleta loggato su gara FIDAL senza un tesseramento FIDAL nel profilo.
    const step1Blocked = step === 1 && (
        missingFidalAff ||
        (!!selectedRace?.requiresMedicalCert && !currentAthlete && (isFidal === null || isFidal === false))
    );

    return (
        <main className="min-h-screen bg-slate-50 py-8 px-4">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <Link
                        to={`/events/${slug}`}
                        className="flex items-center gap-1 text-sm text-slate-400 hover:text-brand-600 transition-colors mb-2"
                    >
                        <ChevronLeft className="h-4 w-4" /> {event.title}
                    </Link>
                    <h1 className="text-2xl font-bold text-slate-800">Iscrizione</h1>
                    <p className="text-slate-500 text-sm mt-0.5">{formatDate(eventStartDate(event))} · {event.city}</p>
                </div>

                {/* Blocco doppia iscrizione */}
                {alreadyRegistered && step < 4 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6 flex items-start gap-4">
                        <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold text-amber-800">Sei già iscritto a questo evento</p>
                            <p className="text-sm text-amber-700 mt-1">
                                Il tuo account è già registrato per una gara di questa manifestazione.
                                Non è possibile effettuare una seconda iscrizione per lo stesso evento.
                            </p>
                            <Link to="/profilo" className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-brand-600 hover:text-brand-800">
                                <User className="h-4 w-4" /> Vai al tuo profilo per gestire l'iscrizione
                            </Link>
                        </div>
                    </div>
                )}

                {!alreadyRegistered && step < STEPS.length - 1 && <StepBar current={step} />}

                {/* Athlete login banner */}
                {!alreadyRegistered && <>
                {currentAthlete && step < 4 && (
                    <div className="flex items-center gap-2 mb-4 bg-brand-50 border border-brand-200 rounded-xl px-4 py-2.5 text-sm text-brand-800">
                        <User className="h-4 w-4 shrink-0" />
                        <span>Stai iscrivendo come <strong>{currentAthlete.name} {currentAthlete.surname}</strong> — i tuoi dati verranno pre-compilati automaticamente.</span>
                    </div>
                )}

                {/* Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-7">
                    {step === 0 && (
                        <RacePicker races={eventRaces} selectedId={selectedRaceId}
                            onSelect={id => { setComboId(''); setSelectedRaceId(id); }}
                            combinate={combinate} comboId={combo?.id}
                            onSelectCombo={c => { setComboId(c.id); setSelectedRaceId(c.raceIds[0]); setAppliedDiscount(null); }} />
                    )}

                    {step === 1 && selectedRace && (
                        <div>
                            <h2 className="font-semibold text-slate-700 text-base mb-4">
                                {combo ? `Combinata ${combo.nome}: ${combo.raceIds.map(id => eventRaces.find(r => r.id === id)?.name).join(' + ')}` : selectedRace.name}
                            </h2>
                            {descriviAmmessi(selectedRace) && (
                                <p className="-mt-2 mb-4 inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200 px-3 py-1 text-xs font-semibold text-brand-700">
                                    <ShieldCheck className="h-3.5 w-3.5" /> {descriviAmmessi(selectedRace)}
                                </p>
                            )}

                            {/* ── Logica FIDAL/cert solo per gare competitive ── */}
                            {selectedRace.requiresMedicalCert && (
                                <>
                                    {/* Scelta FIDAL / non-FIDAL (solo se non già loggato) */}
                                    {!currentAthlete && isFidal === null && (
                                        <div className="space-y-4">
                                            <p className="text-sm text-slate-600">Per procedere con l'iscrizione, seleziona la tua situazione:</p>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <button type="button" onClick={() => setIsFidal(true)}
                                                    className="text-left p-4 rounded-xl border-2 border-slate-200 hover:border-brand-400 hover:bg-brand-50 transition-all">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <ShieldCheck className="h-5 w-5 text-brand-600" />
                                                        <span className="font-semibold text-slate-800">{ammesso(selectedRace, 'fidal') && restricted && !ammesso(selectedRace, 'runcard') ? 'Sono tesserato FIDAL' : 'Sono tesserato FIDAL / RunCard'}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-500">
                                                        Inserisci il numero tessera o cerca per nome — il sistema caricherà automaticamente i tuoi dati e il certificato medico.
                                                    </p>
                                                </button>
                                                {(ammesso(selectedRace, 'libero') || ammesso(selectedRace, 'eps')) && (
                                                <button type="button" onClick={() => setIsFidal(false)}
                                                    className="text-left p-4 rounded-xl border-2 border-slate-200 hover:border-brand-400 hover:bg-brand-50 transition-all">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <User className="h-5 w-5 text-slate-500" />
                                                        <span className="font-semibold text-slate-800">Non sono tesserato FIDAL</span>
                                                    </div>
                                                    <p className="text-xs text-slate-500">
                                                        Ti chiediamo di registrarti sulla piattaforma per inserire i tuoi dati e il certificato medico una volta sola.
                                                    </p>
                                                </button>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Non-FIDAL senza account: redirect a registrazione */}
                                    {!currentAthlete && isFidal === false && (
                                        <div className="space-y-4">
                                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                                                <p className="font-semibold mb-1">Registrazione account richiesta</p>
                                                <p className="text-xs">
                                                    Per gli atleti non tesserati FIDAL è necessario creare un account gratuito.
                                                    Potrai inserire i tuoi dati e il certificato medico <strong>una sola volta</strong> —
                                                    verranno caricati automaticamente in tutte le iscrizioni future.
                                                </p>
                                            </div>
                                            <div className="flex flex-col sm:flex-row gap-3">
                                                <Link
                                                    to={`/registrati?redirect=${encodeURIComponent(`/events/${slug}/register?race=${selectedRaceId}`)}&from=iscrizione`}
                                                    className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors"
                                                >
                                                    <User className="h-4 w-4" /> Crea account gratuito
                                                </Link>
                                                <Link
                                                    to={`/accedi?redirect=${encodeURIComponent(`/events/${slug}/register?race=${selectedRaceId}`)}`}
                                                    className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
                                                >
                                                    Ho già un account
                                                </Link>
                                            </div>
                                            <button type="button" onClick={() => setIsFidal(null)}
                                                className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
                                                <ChevronLeft className="h-3 w-3" /> Torna indietro
                                            </button>
                                        </div>
                                    )}

                                    {/* FIDAL lookup */}
                                    {isFidal === true && !currentAthlete && (
                                        <FidalLookup onPrefill={handleFidalPrefill} raceId={selectedRace?.id} />
                                    )}

                                    {/* Cert già verificato nell'account */}
                                    {(isFidal === true || currentAthlete) && certValidFromAccount && !certExpiredForEvent && (
                                        <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 text-sm text-green-800">
                                            <ShieldCheck className="h-4 w-4 shrink-0" />
                                            Certificato medico già verificato nel tuo account — nessun documento aggiuntivo richiesto.
                                        </div>
                                    )}

                                    {/* Certificato valido per la gara secondo i dati FIDAL (senza mostrare la data) */}
                                    {fidalCertStatus === 'valido' && !!selectedRace?.requiresMedicalCert && (
                                        <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 text-sm text-green-800">
                                            <ShieldCheck className="h-4 w-4 shrink-0" />
                                            Tessera e certificato medico risultano validi per la data della gara.
                                        </div>
                                    )}

                                    {/* Certificato in scadenza prima dell'evento */}
                                    {certExpiredForEvent && (
                                        <div className="mb-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm text-amber-800">
                                            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                            <span>
                                                Il certificato medico risulta in scadenza{certScadenza ? ' il ' : ''}
                                                {certScadenza && <strong>{new Date(certScadenza).toLocaleDateString('it-IT')}</strong>},
                                                <strong> prima della data della gara</strong>
                                                {eventDateStr ? ` (${new Date(eventDateStr).toLocaleDateString('it-IT')})` : ''}.
                                                Puoi completare l'iscrizione, ma non sarà valida finché non presenti un
                                                certificato in corso di validità: l'iscrizione resterà in attesa di verifica.
                                            </span>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Form dati — mostrato se:
                                - gara non competitiva (sempre)
                                - gara competitiva + FIDAL scelto o già loggato */}
                            {(!selectedRace.requiresMedicalCert || isFidal === true || currentAthlete) && (
                                <>
                                    {/* Blocco 1 — profilo riusato (atleta loggato) */}
                                    {currentAthlete && (
                                        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                                            <div className="flex items-center gap-2 mb-1">
                                                <User className="h-4 w-4 text-brand-600" />
                                                <span className="text-sm font-semibold text-slate-800">
                                                    {currentAthlete.name} {currentAthlete.surname}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500">
                                                {currentAthlete.email}
                                                {currentAthlete.club ? ` · ${currentAthlete.club}` : ''}
                                            </p>
                                            <p className="text-xs text-slate-400 mt-1">
                                                I dati anagrafici e i tesseramenti del tuo profilo verranno usati per questa iscrizione.{' '}
                                                <Link to="/profilo" className="text-brand-600 hover:underline">Modifica profilo</Link>
                                            </p>
                                        </div>
                                    )}

                                    {/* Blocco 2 — tesseramento richiesto/scelto per l'ente della gara */}
                                    {currentAthlete && (restricted || (raceEnte && raceEnte !== 'non_competitiva')) && (
                                        <div className="mb-4">
                                            {restricted && eligibleAffs.length <= 1 ? (
                                                chosenAff ? (
                                                    <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-800 flex items-center gap-2">
                                                        <ShieldCheck className="h-4 w-4 shrink-0" />
                                                        <span>Tesseramento <strong>{chosenAff.ente.toUpperCase()} {chosenAff.numeroTessera || ''}</strong>{chosenAff.societaNome ? ` (${chosenAff.societaNome})` : ''}{chosenAff.ente === 'fidal' ? ' — certificato valido automaticamente.' : ''}</span>
                                                    </div>
                                                ) : needsFidalAff ? (
                                                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                                        <p className="font-semibold mb-0.5">Tesseramento richiesto</p>
                                                        <p className="text-xs">
                                                            {descriviAmmessi(selectedRace)}: aggiungi il tesseramento nel tuo profilo per poterti iscrivere.{' '}
                                                            <Link to="/profilo" className="underline">Vai al profilo</Link>
                                                        </p>
                                                    </div>
                                                ) : null
                                            ) : (
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-1">Tesseramento per questa gara</label>
                                                    <select value={selectedAffId} onChange={e => setSelectedAffId(e.target.value)}
                                                        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                                                        {!needsFidalAff && <option value="">Nessun tesseramento / non competitivo</option>}
                                                        {eligibleAffs.map(a => (
                                                            <option key={a.id} value={a.id}>
                                                                {a.ente.toUpperCase()} — {a.societaNome || 'senza società'}{a.numeroTessera ? ` (${a.numeroTessera})` : ''}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <p className="text-xs text-slate-400 mt-1">{restricted ? 'Scegli con quale tesseramento ammesso ti iscrivi.' : 'Puoi scegliere liberamente con quale tesseramento presentarti.'}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Blocco 3 — solo campi extra della gara (+ consensi) */}
                                    {visibleFields.length === 0 ? (
                                        <p className="text-slate-400 text-sm italic">
                                            {currentAthlete
                                                ? 'Nessun dato aggiuntivo richiesto: prosegui per il riepilogo.'
                                                : 'Nessun dato richiesto per questa gara.'}
                                        </p>
                                    ) : (
                                        <DynamicForm fields={visibleFields} data={formData} onChange={handleFormChange} errors={errors} />
                                    )}
                                </>
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
                            validateCode={USE_API ? (c: string) => checkDiscountApi(c, selectedRace.id) : validateDiscountCode}
                            assignedCat={assignedCat}
                            fidalVerified={fidalVerified}
                            combo={combo}
                        />
                    )}

                    {step === 3 && (
                        <PaymentStep
                            totalPrice={isFree ? 0 : totalPrice}
                            method={paymentMethod}
                            onMethodChange={setPaymentMethod}
                            allowOnline={allowOnline}
                            allowOnsite={allowOnsite}
                            fees={fees}
                        />
                    )}

                    {step === 4 && selectedRace && (
                        <Confirmation
                            submissionId={submissionId}
                            raceName={combo ? `Combinata ${combo.nome}` : selectedRace.name}
                            eventTitle={event.title}
                            pricePaid={totalPrice}
                            paymentMethod={isFree ? 'free' : paymentMethod}
                            athleteLoggedIn={!!currentAthlete}
                        />
                    )}
                </div>

                {/* Verifica anti-bot per chi si iscrive senza account (solo se attiva) */}
                {USE_API && isLastStep && !tokenRole() && <Captcha className="mt-5 flex justify-end" />}

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
                        {!step1Blocked && (
                            <button
                                type="button"
                                onClick={handleNext}
                                disabled={(step === 0 && !selectedRaceId) || submitting}
                                className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-40 transition-colors"
                            >
                                {nextLabel}
                                {!isLastStep && <ChevronRight className="h-4 w-4" />}
                            </button>
                        )}
                    </div>
                )}
            </>}
        </div>

            {/* ── Modal post-FIDAL: crea account ── */}
            {showAccountModal && step === 4 && (
                <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                        <h3 className="font-display font-700 text-lg text-slate-800 mb-1">
                            Salva le tue gare
                        </h3>
                        <p className="text-sm text-slate-500 mb-4">
                            Crea un account gratuito per accedere al tuo storico gare e ai tuoi risultati.
                            I tuoi dati sono già pronti — ti servono solo email e password.
                        </p>
                        {accountError && (
                            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-sm mb-3">
                                <AlertCircle className="h-4 w-4 shrink-0" /> {accountError}
                            </div>
                        )}
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                                <input type="email" value={accountEmail}
                                    onChange={e => setAccountEmail(e.target.value)}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                    placeholder="mario@esempio.it" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                                <input type="password" value={accountPassword}
                                    onChange={e => setAccountPassword(e.target.value)}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                    placeholder="Almeno 6 caratteri" />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-5">
                            <button type="button"
                                onClick={async () => {
                                    setAccountError('');
                                    if (!accountEmail || !accountPassword) { setAccountError('Compila email e password.'); return; }
                                    if (accountPassword.length < 8) { setAccountError('Password troppo corta (min. 8 caratteri).'); return; }
                                    // Recupera i dati dal formData
                                    const nameField   = fields.find(f => f.catalogKey === 'nome');
                                    const surnField   = fields.find(f => f.catalogKey === 'cognome');
                                    const sexField    = fields.find(f => f.catalogKey === 'sesso');
                                    const birthField  = fields.find(f => f.catalogKey === 'data_nascita' || f.catalogKey === 'anno_nascita');
                                    const res = await registerAthlete({
                                        email:    accountEmail.trim(),
                                        password: accountPassword,
                                        name:     nameField ? String(formData[nameField.id] ?? '') : '',
                                        surname:  surnField ? String(formData[surnField.id] ?? '') : '',
                                        birthDate: birthField ? String(formData[birthField.id] ?? '') : '',
                                        gender:   (sexField ? String(formData[sexField.id]) : 'M') as 'M' | 'F',
                                        fidalTessera: fields.find(f => f.catalogKey === 'tessera_fidal')
                                            ? String(formData[fields.find(f => f.catalogKey === 'tessera_fidal')!.id] ?? '') || undefined
                                            : undefined,
                                        certStatus: 'verificato', // FIDAL → cert già verificato
                                    });
                                    if ('error' in res) { setAccountError(res.error); return; }
                                    setShowAccountModal(false);
                                    navigate('/profilo');
                                }}
                                className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors">
                                Crea account
                            </button>
                            <button type="button" onClick={() => setShowAccountModal(false)}
                                className="px-4 py-2.5 rounded-lg border border-slate-300 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">
                                Non ora
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
