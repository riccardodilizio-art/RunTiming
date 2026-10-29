import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users, Plus, Trash2, Edit2, X, Check, UserPlus, ClipboardList, RefreshCw, Clock,
} from 'lucide-react';
import { useSocietyAuth } from '../../context/useSocietyAuth';
import { useAdminStore, saveRegistration, loadMyRegistrationsApi, reportApiError, ensureEventApi } from '../../hooks/useAdminStore';
import { USE_API, api } from '../../lib/api';
import { allRaces, eventStartDate, eventEndDate } from '../../utils/event';
import { pickAffiliationForEnte, resolveCertStatus } from '../../utils/cert';
import { assignCategory } from '../../types';
import AffiliationsEditor from '../../components/athlete/AffiliationsEditor';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { listBySociety } from '../../data/fidalLookup';
import { fidalToRoster, newRosterId } from './rosterUtils';
import type { RosterAthlete, Race, RegistrationSubmission, Event as EventType } from '../../types';
import { SITE_NAME } from '../../lib/brand';
import { ApiError } from '../../lib/api';
import { ammesso, tesseramentoDaEnte } from '../../lib/tesseramenti';
import GroupDetails, { BankBox, GroupTotals } from '../../components/GroupDetails';
import { euro, type PaymentGroupView } from '../../lib/gruppi';

type SocietySection = 'roster' | 'storico' | 'pagamenti';

/** Metodi per pagare un gruppo: un bonifico, oppure in loco se la gara lo prevede. */
function groupMethods(race: Race): ('bank' | 'onsite')[] {
    if (race.paymentMode === 'online') return ['bank'];
    if (race.paymentMode === 'both') return ['bank', 'onsite'];
    return ['onsite'];
}

/** Tesseramento dell'atleta ammesso dalla gara (FIDAL per primo). */
function pickAffiliation(race: Race, ath: RosterAthlete) {
    const ok = ath.affiliations.filter(a => ammesso(race, tesseramentoDaEnte(a.ente, a.societaNome)));
    return ok.find(a => a.ente === 'fidal') ?? ok[0] ?? pickAffiliationForEnte(ath.affiliations, race.ente);
}

/** Pagamenti di gruppo della società (con i dati del bonifico da fare). */
function GroupPayments() {
    const [rows, setRows] = useState<PaymentGroupView[] | null>(null);
    const [open, setOpen] = useState<string | null>(null);
    useEffect(() => { api.get<PaymentGroupView[]>('/groups/me').then(setRows).catch(reportApiError); }, []);
    if (!rows) return <p className="text-sm text-slate-400">Caricamento…</p>;
    if (!rows.length) {
        return (
            <div className="text-center py-16 bg-white border border-slate-200 rounded-xl">
                <ClipboardList className="h-12 w-12 mx-auto mb-3 text-slate-200" />
                <p className="text-slate-600 font-medium">Nessun pagamento di gruppo</p>
                <p className="text-slate-400 text-sm mt-1">Quando iscrivi più atleti a una gara, qui trovi il riepilogo e i dati del bonifico.</p>
            </div>
        );
    }
    const label = { PENDING: 'Da pagare', CONFIRMED: 'Pagato', REJECTED: 'Annullato' } as const;
    const color = { PENDING: 'bg-amber-100 text-amber-700', CONFIRMED: 'bg-emerald-100 text-emerald-700', REJECTED: 'bg-slate-100 text-slate-500' } as const;
    return (
        <div className="space-y-2">
            <h2 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                <Clock className="h-5 w-5 text-brand-600" /> Pagamenti di gruppo
            </h2>
            {rows.map(g => (
                <div key={g.id} className="bg-white rounded-xl border border-slate-200 p-4">
                    <button type="button" onClick={() => setOpen(open === g.id ? null : g.id)} className="w-full flex items-center gap-3 text-left">
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-800 truncate">{g.evento} · {g.gara}</p>
                            <p className="text-xs text-slate-500">
                                <span className="font-mono">{g.paymentRef}</span> · {g.iscritti} atleti{g.omaggi ? `, ${g.omaggi} in omaggio` : ''} · {new Date(g.createdAt).toLocaleDateString('it-IT')}
                            </p>
                        </div>
                        <span className="font-semibold">{euro(g.totale)}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color[g.paymentStatus]}`}>{label[g.paymentStatus]}</span>
                    </button>
                    {(open === g.id || (g.paymentStatus === 'PENDING' && rows.length === 1)) && <GroupDetails group={g} />}
                </div>
            ))}
        </div>
    );
}

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
    const [section, setSection] = useState<SocietySection>('roster');

    useEffect(() => {
        if (!currentSociety) navigate('/societa/accedi', { replace: true });
    }, [currentSociety, navigate]);

    // Con il backend: storico iscrizioni della società dal server
    useEffect(() => {
        if (USE_API && currentSociety) loadMyRegistrationsApi().catch(reportApiError);
    }, [currentSociety]);

    /** Salva il roster; con il backend mostra l'eventuale errore del server. */
    async function saveRoster(next: RosterAthlete[]) {
        const err = await updateSociety({ roster: next });
        if (err) window.alert(err);
    }

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
        if (reg.athleteName) return reg.athleteName;
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
        void saveRoster(next);
        setEditing(null);
    }
    function removeAthlete(id: string) {
        if (!currentSociety) return;
        void saveRoster(roster.filter(r => r.id !== id));
    }
    // Con l'API l'import FIDAL si sblocca quando la segreteria approva il codice società
    const fidalPending = USE_API && !!currentSociety?.codiceFidal && !currentSociety.fidalApproved;
    async function reimportFidal() {
        if (!currentSociety?.codiceFidal || fidalPending) return;
        let imported: RosterAthlete[];
        try {
            imported = (await listBySociety(currentSociety.codiceFidal)).map(fidalToRoster);
        } catch (e) { reportApiError(e); return; }
        // merge: skip athletes already present by name+birthdate
        const key = (a: RosterAthlete) => `${a.nome}|${a.cognome}|${a.dataNascita}`.toLowerCase();
        const existing = new Set(roster.map(key));
        const toAdd = imported.filter(a => !existing.has(key(a)));
        void saveRoster([...roster, ...toAdd]);
        setReimported(toAdd.length);
        setTimeout(() => setReimported(0), 3000);
    }

    if (!currentSociety) return null;

    return (
        <DashboardLayout
            title={currentSociety.societaNome}
            subtitle={`${currentSociety.presidentName} ${currentSociety.presidentSurname}`}
            items={[
                { key: 'roster',  label: 'Roster atleti',      icon: <Users className="h-4 w-4" /> },
                { key: 'storico', label: 'Storico iscrizioni', icon: <ClipboardList className="h-4 w-4" />, badge: societyRegs.length || undefined },
                ...(USE_API ? [{ key: 'pagamenti', label: 'Pagamenti di gruppo', icon: <Clock className="h-4 w-4" /> }] : []),
            ]}
            active={section}
            onSelect={k => setSection(k as SocietySection)}
            userLabel={`${currentSociety.presidentName} ${currentSociety.presidentSurname}`}
            onLogout={() => { logout(); navigate('/'); }}
        >
            <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8">
              {section === 'roster' && (
                <>
                {/* Header actions */}
                <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <Users className="h-6 w-6 text-brand-600" /> Roster atleti
                        </h1>
                        <p className="text-slate-500 text-sm mt-0.5">{roster.length} atleti in società</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        {currentSociety.codiceFidal && !fidalPending && (
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

                {fidalPending && (
                    <div className="mb-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-800 text-sm">
                        <Clock className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>
                            Codice FIDAL <strong className="font-mono">{currentSociety.codiceFidal}</strong> in attesa di verifica da parte di {SITE_NAME}.
                            Appena approvato potrai importare gli atleti tesserati; intanto puoi aggiungerli a mano.
                        </span>
                    </div>
                )}

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
                </>
              )}

              {section === 'pagamenti' && USE_API && <GroupPayments />}

              {section === 'storico' && (
                societyRegs.length === 0 ? (
                    <div className="text-center py-16 bg-white border border-slate-200 rounded-xl">
                        <ClipboardList className="h-12 w-12 mx-auto mb-3 text-slate-200" />
                        <p className="text-slate-600 font-medium">Nessuna iscrizione effettuata</p>
                        <p className="text-slate-400 text-sm mt-1">Iscrivi i tuoi atleti a una gara dalla sezione Roster.</p>
                    </div>
                ) : (
                    <div>
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
                )
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
        </DashboardLayout>
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

    // Solo eventi non conclusi: non si iscrive a gare passate.
    const openEvents = useMemo(
        () => events.filter(e => new Date(eventEndDate(e)) >= new Date()),
        [events],
    );
    const event = useMemo(() => openEvents.find(e => e.id === eventId), [openEvents, eventId]);
    // Solo gare con iscrizioni aperte.
    const races = useMemo(() => (event ? allRaces(event).filter(r => r.isOpen) : []), [event]);
    const race = useMemo(() => races.find(r => r.id === raceId), [races, raceId]);

    function toggle(id: string) {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }

    // Con il backend serve il dettaglio della gara (modulo) per costruire i dati
    useEffect(() => {
        if (USE_API && event) ensureEventApi(event.slug).catch(reportApiError);
    }, [event]);
    const [sending, setSending] = useState(false);

    // ── Con il backend: iscrizione di gruppo (un solo pagamento, quote in omaggio) ──
    const methods = race ? groupMethods(race) : [];
    const [method, setMethod] = useState<'bank' | 'onsite'>('bank');
    const payMethod = methods.includes(method) ? method : methods[0];
    const [consensi, setConsensi] = useState(false);
    const [preview, setPreview] = useState<Pick<PaymentGroupView, 'iscritti' | 'omaggi' | 'paganti' | 'quota' | 'maggiorazione' | 'totale'> & { giaIscritti: number } | null>(null);
    const [errori, setErrori] = useState<string[]>([]);
    const [result, setResult] = useState<PaymentGroupView | null>(null);
    useEffect(() => {
        setPreview(null);
        if (!USE_API || !race || selected.size === 0 || !payMethod) return;
        const t = setTimeout(() => {
            api.post<typeof preview>('/groups/preview', { raceId: race.id, count: selected.size, paymentMethod: payMethod })
                .then(setPreview).catch(() => setPreview(null));
        }, 250);
        return () => clearTimeout(t);
    }, [race, selected.size, payMethod]);

    async function confirmApi(chosen: RosterAthlete[]) {
        if (!race || !payMethod) return;
        setSending(true);
        setErrori([]);
        try {
            const g = await api.post<PaymentGroupView>('/groups', {
                raceId: race.id,
                paymentMethod: payMethod,
                consensi,
                athletes: chosen.map(ath => {
                    const aff = pickAffiliation(race, ath);
                    return {
                        formData: buildFormData(race, ath, societaNome),
                        athlete: {
                            nome: ath.nome,
                            cognome: ath.cognome,
                            dataNascita: ath.dataNascita,
                            sesso: ath.sesso,
                            tessera: aff?.numeroTessera || undefined,
                            codiceSocieta: aff?.codiceSocieta || undefined,
                            tesseramento: aff ? tesseramentoDaEnte(aff.ente, aff.societaNome) : undefined,
                        },
                    };
                }),
            });
            setResult(g);
            loadMyRegistrationsApi().catch(() => undefined);
        } catch (e) {
            const body = e instanceof ApiError ? e.body as { errori?: string[] } | undefined : undefined;
            setErrori([e instanceof Error ? e.message : 'Iscrizione non riuscita', ...(body?.errori ?? [])]);
        } finally {
            setSending(false);
        }
    }

    function confirm() {
        if (!event || !race) return;
        const chosen = roster.filter(a => selected.has(a.id));
        if (USE_API) { void confirmApi(chosen); return; }
        chosen.forEach(ath => {
            const formData = buildFormData(race, ath, societaNome);
            const birthYear = ath.dataNascita ? new Date(ath.dataNascita).getFullYear() : 0;
            const cat = race.categories?.length ? assignCategory(race.categories, birthYear, ath.sesso) : null;
            // Stessa logica certificato degli altri flussi: FIDAL automatico,
            // gli altri sono garantiti dalla società (nessuna verifica admin).
            const aff = pickAffiliationForEnte(ath.affiliations, race.ente);
            const certStatus = resolveCertStatus({
                requiresMedicalCert: race.requiresMedicalCert,
                affiliation: aff,
                societyVouched: true,
                certScadenza: aff?.certScadenza,
                eventDate: eventStartDate(event),
            });
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
                fidalVerified: aff?.ente === 'fidal',
                certStatus,
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

                {result ? (
                    <div className="p-6 space-y-4 overflow-y-auto">
                        <div className="text-center">
                            <Check className="h-12 w-12 text-green-500 mx-auto mb-2" />
                            <p className="font-semibold text-slate-800">{result.iscritti} atleti iscritti</p>
                            <p className="text-xs text-slate-500 mt-0.5">Codice pagamento <span className="font-mono">{result.paymentRef}</span> · riepilogo inviato anche per email</p>
                        </div>
                        <GroupTotals g={result} />
                        {result.paymentStatus === 'PENDING' && result.paymentMethod === 'bank' && <BankBox g={result} />}
                        {result.paymentMethod === 'onsite' && <p className="text-sm text-slate-600">Il totale si paga sul posto, al ritiro dei pettorali.</p>}
                        <p className="text-xs text-slate-500">Lo ritrovi in "Pagamenti di gruppo".</p>
                        <button onClick={onClose} className="w-full px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700">Chiudi</button>
                    </div>
                ) : done > 0 ? (
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
                                        {openEvents.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
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
                        {USE_API && race && selected.size > 0 && (
                            <div className="px-6 py-3 border-t border-slate-100 space-y-2 bg-slate-50/60">
                                {methods.length > 1 && (
                                    <div className="flex gap-2 text-sm">
                                        {methods.map(m => (
                                            <label key={m} className="flex items-center gap-1.5">
                                                <input type="radio" className="accent-brand-600" checked={payMethod === m} onChange={() => setMethod(m)} />
                                                {m === 'bank' ? 'Un bonifico' : 'In loco'}
                                            </label>
                                        ))}
                                    </div>
                                )}
                                {preview && <GroupTotals g={preview} />}
                                {preview && preview.giaIscritti > 0 && race.gruppoOmaggi && (
                                    <p className="text-xs text-slate-500">Conteggio omaggi: avete già {preview.giaIscritti} iscritti a questa gara.</p>
                                )}
                                <label className="flex items-start gap-2 text-xs text-slate-600">
                                    <input type="checkbox" className="accent-brand-600 mt-0.5" checked={consensi} onChange={e => setConsensi(e.target.checked)} />
                                    Dichiaro di aver raccolto dagli atleti i consensi richiesti dal modulo (privacy, regolamento) e che sono in regola con il tesseramento.
                                </label>
                                {errori.length > 0 && (
                                    <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700 max-h-32 overflow-y-auto">
                                        <p className="font-semibold">{errori[0]}</p>
                                        {errori.slice(1).map(x => <p key={x}>{x}</p>)}
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100">
                            <span className="text-sm text-slate-500">
                                {race && !USE_API ? `${(race.price * selected.size).toFixed(2)} € totali (da saldare)` : ''}
                            </span>
                            <button disabled={!race || selected.size === 0 || sending || (USE_API && !consensi)} onClick={confirm}
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
