import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Building2, LogOut, Users, Plus, Trash2, Edit2, X, Check, UserPlus, ClipboardList, RefreshCw,
} from 'lucide-react';
import { useSocietyAuth } from '../../context/useSocietyAuth';
import { useAdminStore, saveRegistration } from '../../hooks/useAdminStore';
import { allRaces } from '../../utils/event';
import { assignCategory } from '../../types';
import AffiliationsEditor from '../../components/athlete/AffiliationsEditor';
import { lookupBySociety } from '../../data/mockFidal';
import { fidalToRoster, newRosterId } from './rosterUtils';
import type { RosterAthlete, Race, RegistrationSubmission, Event as EventType } from '../../types';

const inputCls =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500';

function emptyRosterAthlete(): RosterAthlete {
    return { id: newRosterId(), nome: '', cognome: '', dataNascita: '', sesso: 'M', affiliations: [], source: 'manual' };
}

/** Costruisce il formData di un'iscrizione mappando i dati dell'atleta sui campi profilo della gara. */
function buildFormData(race: Race, ath: RosterAthlete, societaNome: string): Record<string, string | boolean> {
    const fd: Record<string, string | boolean> = {};
    const birthYear = ath.dataNascita ? new Date(ath.dataNascita).getFullYear() : undefined;
    const fidalAff = ath.affiliations.find(a => a.ente === 'fidal');
    const otherAff = ath.affiliations.find(a => a.ente !== 'fidal' && a.numeroTessera);
    for (const f of race.formSchema ?? []) {
        switch (f.catalogKey) {
            case 'nome': fd[f.id] = ath.nome; break;
            case 'cognome': fd[f.id] = ath.cognome; break;
            case 'data_nascita': fd[f.id] = ath.dataNascita; break;
            case 'anno_nascita': if (birthYear) fd[f.id] = String(birthYear); break;
            case 'sesso': fd[f.id] = ath.sesso; break;
            case 'codice_fiscale': if (ath.codFiscale) fd[f.id] = ath.codFiscale; break;
            case 'societa': fd[f.id] = ath.affiliations[0]?.societaNome || societaNome; break;
            case 'tessera_fidal': if (fidalAff?.numeroTessera) fd[f.id] = fidalAff.numeroTessera; break;
            case 'tessera_runcard': if (otherAff?.numeroTessera) fd[f.id] = otherAff.numeroTessera; break;
        }
    }
    return fd;
}

export default function SocietyDashboardPage() {
    const navigate = useNavigate();
    const { currentSociety, logout, updateSociety } = useSocietyAuth();
    const { events, registrations } = useAdminStore();

    const [editing, setEditing] = useState<RosterAthlete | null>(null);
    const [showRegModal, setShowRegModal] = useState(false);
    const [reimported, setReimported] = useState(0);

    useEffect(() => {
        if (!currentSociety) navigate('/societa/accedi', { replace: true });
    }, [currentSociety, navigate]);

    const roster = currentSociety?.roster ?? [];

    // Storico iscrizioni della società
    const raceMap = useMemo(() => {
        const m: Record<string, { eventTitle: string; raceName: string; race: Race }> = {};
        for (const ev of events) for (const r of allRaces(ev)) m[r.id] = { eventTitle: ev.title, raceName: r.name, race: r };
        return m;
    }, [events]);
    const societyRegs = useMemo(
        () => registrations.filter(r => r.societyId === currentSociety?.id),
        [registrations, currentSociety?.id]
    );
    function regAthleteName(reg: RegistrationSubmission): string {
        const info = raceMap[reg.raceId];
        const fs = info?.race.formSchema ?? [];
        const cog = fs.find(x => x.catalogKey === 'cognome');
        const nom = fs.find(x => x.catalogKey === 'nome');
        const c = cog ? String(reg.formData[cog.id] ?? '') : '';
        const n = nom ? String(reg.formData[nom.id] ?? '') : '';
        return `${c} ${n}`.trim() || '—';
    }

    function saveAthlete(ath: RosterAthlete) {
        if (!currentSociety) return;
        const exists = roster.some(r => r.id === ath.id);
        const next = exists ? roster.map(r => r.id === ath.id ? ath : r) : [...roster, ath];
        updateSociety({ roster: next });
        setEditing(null);
    }
    function removeAthlete(id: string) {
        if (!currentSociety) return;
        updateSociety({ roster: roster.filter(r => r.id !== id) });
    }
    function reimportFidal() {
        if (!currentSociety?.codiceFidal) return;
        const imported = lookupBySociety(currentSociety.codiceFidal).map(fidalToRoster);
        // merge: skip athletes already present by name+birthdate
        const key = (a: RosterAthlete) => `${a.nome}|${a.cognome}|${a.dataNascita}`.toLowerCase();
        const existing = new Set(roster.map(key));
        const toAdd = imported.filter(a => !existing.has(key(a)));
        updateSociety({ roster: [...roster, ...toAdd] });
        setReimported(toAdd.length);
        setTimeout(() => setReimported(0), 3000);
    }

    if (!currentSociety) return null;

    return (
        <main className="min-h-screen bg-slate-50">
            {/* Top bar */}
            <div className="bg-white border-b border-slate-200 px-4 sm:px-8 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
                        <Building2 className="h-4 w-4 text-white" />
                    </div>
                    <div>
                        <span className="font-semibold text-slate-800">{currentSociety.societaNome}</span>
                        <p className="text-xs text-slate-400">{currentSociety.presidentName} {currentSociety.presidentSurname}</p>
                    </div>
                </div>
                <button onClick={() => { logout(); navigate('/'); }}
                    className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors">
                    <LogOut className="h-4 w-4" /> Esci
                </button>
            </div>

            <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8">
                {/* Header actions */}
                <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <Users className="h-6 w-6 text-brand-600" /> Roster atleti
                        </h1>
                        <p className="text-slate-500 text-sm mt-0.5">{roster.length} atleti in società</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        {currentSociety.codiceFidal && (
                            <button onClick={reimportFidal}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-colors">
                                <RefreshCw className="h-4 w-4" /> Reimporta da FIDAL
                            </button>
                        )}
                        <button onClick={() => setEditing(emptyRosterAthlete())}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-brand-200 text-brand-700 text-sm hover:bg-brand-50 transition-colors">
                            <UserPlus className="h-4 w-4" /> Aggiungi atleta
                        </button>
                        <button onClick={() => setShowRegModal(true)} disabled={roster.length === 0}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-50">
                            <ClipboardList className="h-4 w-4" /> Iscrivi a una gara
                        </button>
                    </div>
                </div>

                {reimported > 0 && (
                    <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-green-700 text-sm">
                        <Check className="h-4 w-4" /> {reimported} nuovi atleti importati dal DB FIDAL.
                    </div>
                )}

                {/* Roster list */}
                {roster.length === 0 ? (
                    <div className="text-center py-16 bg-white border border-slate-200 rounded-xl">
                        <Users className="h-12 w-12 mx-auto mb-3 text-slate-200" />
                        <p className="text-slate-600 font-medium">Nessun atleta nel roster</p>
                        <p className="text-slate-400 text-sm mt-1">Aggiungi atleti manualmente o importali dal DB FIDAL.</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                    <th className="px-4 py-3">Atleta</th>
                                    <th className="px-4 py-3">Nascita</th>
                                    <th className="px-4 py-3">Tesseramenti</th>
                                    <th className="px-4 py-3" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {roster.map(a => (
                                    <tr key={a.id} className="hover:bg-slate-50/50">
                                        <td className="px-4 py-3 font-medium text-slate-800">
                                            {a.cognome} {a.nome}
                                            {a.source === 'fidal_db' && <span className="ml-2 text-[10px] text-brand-500">FIDAL</span>}
                                        </td>
                                        <td className="px-4 py-3 text-slate-500">
                                            {a.dataNascita ? new Date(a.dataNascita).toLocaleDateString('it-IT') : '—'} · {a.sesso}
                                        </td>
                                        <td className="px-4 py-3 text-slate-500">
                                            {a.affiliations.length === 0 ? '—' : a.affiliations.map(af => `${af.ente.toUpperCase()}${af.numeroTessera ? ` ${af.numeroTessera}` : ''}`).join(' · ')}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1 justify-end">
                                                <button onClick={() => setEditing(a)} className="p-1.5 rounded hover:bg-brand-50 text-slate-400 hover:text-brand-600" title="Modifica">
                                                    <Edit2 className="h-3.5 w-3.5" />
                                                </button>
                                                <button onClick={() => removeAthlete(a.id)} className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500" title="Rimuovi">
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Storico iscrizioni società */}
                {societyRegs.length > 0 && (
                    <div className="mt-8">
                        <h2 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <ClipboardList className="h-5 w-5 text-brand-600" /> Iscrizioni effettuate ({societyRegs.length})
                        </h2>
                        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                        <th className="px-4 py-3">Atleta</th>
                                        <th className="px-4 py-3">Evento · Gara</th>
                                        <th className="px-4 py-3">Quota</th>
                                        <th className="px-4 py-3">Pagamento</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {societyRegs.map(reg => {
                                        const info = raceMap[reg.raceId];
                                        const paid = reg.paymentStatus === 'confirmed';
                                        return (
                                            <tr key={reg.id} className="hover:bg-slate-50/50">
                                                <td className="px-4 py-3 font-medium text-slate-800">{regAthleteName(reg)}</td>
                                                <td className="px-4 py-3 text-slate-500">
                                                    {info ? `${info.eventTitle} · ${info.raceName}` : reg.raceId}
                                                </td>
                                                <td className="px-4 py-3 text-slate-600">{reg.pricePaid.toFixed(2)} €</td>
                                                <td className="px-4 py-3">
                                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${paid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                        {paid ? 'Confermato' : 'In attesa'}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {editing && (
                <AthleteModal athlete={editing} onSave={saveAthlete} onClose={() => setEditing(null)} />
            )}
            {showRegModal && (
                <BulkRegistrationModal
                    events={events}
                    roster={roster}
                    societaNome={currentSociety.societaNome}
                    societyId={currentSociety.id}
                    onClose={() => setShowRegModal(false)}
                />
            )}
        </main>
    );
}

// ─── Roster athlete modal ──────────────────────────────────────────────────────

function AthleteModal({ athlete, onSave, onClose }: { athlete: RosterAthlete; onSave: (a: RosterAthlete) => void; onClose: () => void }) {
    const [draft, setDraft] = useState<RosterAthlete>(athlete);
    function set<K extends keyof RosterAthlete>(k: K, v: RosterAthlete[K]) {
        setDraft(d => ({ ...d, [k]: v }));
    }
    const valid = draft.nome.trim() && draft.cognome.trim() && draft.dataNascita;
    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <h3 className="font-semibold text-slate-800">{athlete.nome ? 'Modifica atleta' : 'Nuovo atleta'}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                </div>
                <div className="overflow-y-auto px-6 py-4 flex-1 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Nome *</label>
                            <input className={inputCls} value={draft.nome} onChange={e => set('nome', e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Cognome *</label>
                            <input className={inputCls} value={draft.cognome} onChange={e => set('cognome', e.target.value)} />
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2">
                            <label className="block text-xs font-medium text-slate-600 mb-1">Data di nascita *</label>
                            <input type="date" className={inputCls} value={draft.dataNascita} onChange={e => set('dataNascita', e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Sesso</label>
                            <select className={inputCls} value={draft.sesso} onChange={e => set('sesso', e.target.value as 'M' | 'F')}>
                                <option value="M">M</option>
                                <option value="F">F</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Codice fiscale</label>
                        <input className={inputCls} value={draft.codFiscale ?? ''} onChange={e => set('codFiscale', e.target.value || undefined)} />
                    </div>
                    <hr className="border-slate-100" />
                    <AffiliationsEditor value={draft.affiliations} onChange={affs => set('affiliations', affs)} />
                    <p className="text-xs text-slate-400">
                        Per gli atleti non-FIDAL inserisci tu i dati di tesseramento e scadenza certificato (sotto la tua responsabilità).
                    </p>
                </div>
                <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
                    <button disabled={!valid} onClick={() => onSave(draft)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors disabled:opacity-50">
                        <Check className="h-4 w-4" /> Salva
                    </button>
                    <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 text-sm hover:bg-slate-50">Annulla</button>
                </div>
            </div>
        </div>
    );
}

// ─── Bulk registration modal ───────────────────────────────────────────────────

function BulkRegistrationModal({ events, roster, societaNome, societyId, onClose }: {
    events: EventType[];
    roster: RosterAthlete[];
    societaNome: string;
    societyId: string;
    onClose: () => void;
}) {
    const [eventId, setEventId] = useState('');
    const [raceId, setRaceId] = useState('');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [done, setDone] = useState(0);

    const event = useMemo(() => events.find(e => e.id === eventId), [events, eventId]);
    const races = useMemo(() => event ? allRaces(event) : [], [event]);
    const race = useMemo(() => races.find(r => r.id === raceId), [races, raceId]);

    function toggle(id: string) {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }

    function confirm() {
        if (!event || !race) return;
        const chosen = roster.filter(a => selected.has(a.id));
        chosen.forEach(ath => {
            const formData = buildFormData(race, ath, societaNome);
            const birthYear = ath.dataNascita ? new Date(ath.dataNascita).getFullYear() : 0;
            const cat = race.categories?.length ? assignCategory(race.categories, birthYear, ath.sesso) : null;
            const sub: RegistrationSubmission = {
                id: `reg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                eventId: event.id,
                raceId: race.id,
                submittedAt: new Date().toISOString(),
                formData,
                pricePaid: race.price,
                paymentMethod: 'manual',
                paymentStatus: 'pending',
                assignedCategory: cat?.name,
                societyId,
            };
            saveRegistration(sub);
        });
        setDone(chosen.length);
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <h3 className="font-semibold text-slate-800">Iscrivi atleti a una gara</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                </div>

                {done > 0 ? (
                    <div className="p-8 text-center">
                        <Check className="h-12 w-12 text-green-500 mx-auto mb-3" />
                        <p className="font-semibold text-slate-800">{done} atleti iscritti</p>
                        <p className="text-sm text-slate-500 mt-1">Le iscrizioni risultano in attesa di pagamento/conferma da parte dell'organizzazione.</p>
                        <button onClick={onClose} className="mt-4 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700">Chiudi</button>
                    </div>
                ) : (
                    <>
                        <div className="overflow-y-auto px-6 py-4 flex-1 space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Evento</label>
                                    <select className={inputCls} value={eventId} onChange={e => { setEventId(e.target.value); setRaceId(''); }}>
                                        <option value="">— seleziona —</option>
                                        {events.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Gara</label>
                                    <select className={inputCls} value={raceId} onChange={e => setRaceId(e.target.value)} disabled={!event}>
                                        <option value="">— seleziona —</option>
                                        {races.map(r => <option key={r.id} value={r.id}>{r.name} ({r.distance})</option>)}
                                    </select>
                                </div>
                            </div>

                            {race && (
                                <div className="pt-1">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-sm font-medium text-slate-700">Atleti ({selected.size}/{roster.length})</p>
                                        <button onClick={() => setSelected(selected.size === roster.length ? new Set() : new Set(roster.map(a => a.id)))}
                                            className="text-xs text-brand-600 hover:underline">
                                            {selected.size === roster.length ? 'Deseleziona tutti' : 'Seleziona tutti'}
                                        </button>
                                    </div>
                                    <div className="space-y-1 max-h-64 overflow-y-auto">
                                        {roster.map(a => (
                                            <label key={a.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                                                <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} className="accent-brand-600 h-4 w-4" />
                                                <span className="text-sm text-slate-700">{a.cognome} {a.nome}</span>
                                                <span className="text-xs text-slate-400 ml-auto">{a.dataNascita ? new Date(a.dataNascita).getFullYear() : ''}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100">
                            <span className="text-sm text-slate-500">
                                {race ? `${(race.price * selected.size).toFixed(2)} € totali (da saldare)` : ''}
                            </span>
                            <button disabled={!race || selected.size === 0} onClick={confirm}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors disabled:opacity-50">
                                <Plus className="h-4 w-4" /> Iscrivi {selected.size > 0 ? selected.size : ''}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
