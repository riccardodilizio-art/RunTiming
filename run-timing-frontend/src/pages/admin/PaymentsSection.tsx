import { useCallback, useEffect, useState } from 'react';
import { Check, Download, Search, X, Banknote, FileSpreadsheet, Settings2, Users } from 'lucide-react';
import GroupDetails from '../../components/GroupDetails';
import type { PaymentGroupView } from '../../lib/gruppi';
import { USE_API, api, download } from '../../lib/api';
import { useAdminStore, reportApiError } from '../../hooks/useAdminStore';
import { eventStartDate } from '../../utils/event';
import { SITE_NAME } from '../../lib/brand';

// Pagamenti (solo admin): tutti gli incassi online passano dalla segreteria del sito,
// che controlla i bonifici e a fine gara gira le quote agli organizzatori.

interface PaymentSettings {
    bankFee: number; paypalPercent: number; paypalFixed: number; bankDays: number;
    iban: string; intestatario: string; banca: string;
    paypalClientId?: string | null; paypalEnv?: string;
}

interface BankRow {
    id: string; paymentRef: string | null; cognome: string; nome: string; email: string | null;
    pricePaid: number; paymentFee: number; paymentStatus: string; submittedAt: string; paidAt: string | null;
    race: { name: string; day: { date: string; event: { title: string } } };
}

interface Statement {
    event: { id: string; title: string };
    totals: {
        incassatoSegreteria: number; maggiorazioni: number; commissioni: number; daGirareOrganizzatore: number;
        commissioniDaOrganizzatore?: number;
        inAttesa: { count: number; total: number };
    };
    byMethod: { method: string; count: number; total: number; fees: number }[];
}

const euro = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
const inputCls = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';
const METHOD: Record<string, string> = { paypal: 'PayPal / carta', bank: 'Bonifico', onsite: 'In loco', manual: 'Manuale (staff)', free: 'Gratuite', combinata: 'Comprese in combinata' };

function SettingsCard() {
    const [s, setS] = useState<PaymentSettings | null>(null);
    const [saved, setSaved] = useState(false);
    useEffect(() => { api.get<PaymentSettings>('/settings/payments').then(setS).catch(reportApiError); }, []);
    if (!s) return null;
    const set = <K extends keyof PaymentSettings>(k: K, v: PaymentSettings[K]) => setS({ ...s, [k]: v });
    async function save() {
        if (!s) return;
        try {
            const { paypalClientId: _id, paypalEnv: _env, ...body } = s;
            void _id; void _env;
            setS({ ...s, ...(await api.put<PaymentSettings>('/settings/payments', body)) });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (e) { reportApiError(e); }
    }
    return (
        <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2"><Settings2 className="h-4 w-4" /> Impostazioni pagamenti</h3>
            <div className="grid sm:grid-cols-2 gap-3">
                <label className="text-xs text-slate-600">Intestatario conto
                    <input className={inputCls} value={s.intestatario} onChange={e => set('intestatario', e.target.value)} /></label>
                <label className="text-xs text-slate-600">IBAN
                    <input className={`${inputCls} font-mono`} value={s.iban} onChange={e => set('iban', e.target.value)} /></label>
                <label className="text-xs text-slate-600">Banca
                    <input className={inputCls} value={s.banca} onChange={e => set('banca', e.target.value)} /></label>
                <label className="text-xs text-slate-600">Giorni per fare il bonifico
                    <input type="number" min={1} className={inputCls} value={s.bankDays} onChange={e => set('bankDays', Number(e.target.value))} /></label>
                <label className="text-xs text-slate-600">Maggiorazione bonifico (€)
                    <input type="number" step="0.01" min={0} className={inputCls} value={s.bankFee} onChange={e => set('bankFee', Number(e.target.value))} /></label>
                <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs text-slate-600">PayPal/carta %
                        <input type="number" step="0.1" min={0} className={inputCls} value={s.paypalPercent} onChange={e => set('paypalPercent', Number(e.target.value))} /></label>
                    <label className="text-xs text-slate-600">+ fisso (€)
                        <input type="number" step="0.01" min={0} className={inputCls} value={s.paypalFixed} onChange={e => set('paypalFixed', Number(e.target.value))} /></label>
                </div>
            </div>
            <div className="flex items-center justify-between text-xs">
                <span className={s.paypalClientId ? 'text-green-700' : 'text-amber-700'}>
                    PayPal: {s.paypalClientId ? `collegato (${s.paypalEnv === 'live' ? 'soldi veri' : 'modalità prova'})` : 'non configurato (chiavi nel .env del server)'}
                </span>
                <button type="button" onClick={save} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 text-white font-semibold hover:bg-brand-700">
                    <Check className="h-3.5 w-3.5" /> {saved ? 'Salvato' : 'Salva'}
                </button>
            </div>
        </section>
    );
}

function BankCard() {
    const [q, setQ] = useState('');
    const [status, setStatus] = useState<'PENDING' | 'CONFIRMED'>('PENDING');
    const [rows, setRows] = useState<BankRow[]>([]);
    const load = useCallback(() => {
        const p = new URLSearchParams({ status });
        if (q.trim()) p.set('q', q.trim());
        api.get<BankRow[]>(`/admin/payments/bank?${p}`).then(setRows).catch(reportApiError);
    }, [q, status]);
    useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

    async function mark(id: string, paymentStatus: 'CONFIRMED' | 'REJECTED') {
        if (paymentStatus === 'REJECTED' && !window.confirm('Annullare questa iscrizione?')) return;
        try { await api.patch(`/registrations/${id}/payment`, { paymentStatus }); load(); }
        catch (e) { reportApiError(e); }
    }

    return (
        <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2"><Banknote className="h-4 w-4" /> Bonifici</h3>
                <div className="flex gap-1 text-xs">
                    {(['PENDING', 'CONFIRMED'] as const).map(s => (
                        <button key={s} type="button" onClick={() => setStatus(s)}
                            className={`px-3 py-1 rounded-full ${status === s ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                            {s === 'PENDING' ? 'Da controllare' : 'Ricevuti'}
                        </button>
                    ))}
                </div>
            </div>
            <div className="relative">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                <input className={`${inputCls} pl-9`} placeholder="Cerca per causale (RT-…), cognome o importo" value={q} onChange={e => setQ(e.target.value)} />
            </div>
            {rows.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">Nessun bonifico {status === 'PENDING' ? 'da controllare' : 'ricevuto'}.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs text-slate-500 border-b">
                                <th className="py-2 pr-3">Causale</th><th className="pr-3">Atleta</th><th className="pr-3">Gara</th>
                                <th className="pr-3 text-right">Importo</th><th className="pr-3">Iscritto il</th><th />
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {rows.map(r => (
                                <tr key={r.id}>
                                    <td className="py-2 pr-3 font-mono text-xs">{r.paymentRef}</td>
                                    <td className="pr-3">{r.cognome} {r.nome}</td>
                                    <td className="pr-3 text-xs text-slate-500">{r.race.day.event.title} · {r.race.name}</td>
                                    <td className="pr-3 text-right font-semibold">{euro(r.pricePaid)}</td>
                                    <td className="pr-3 text-xs text-slate-500">{new Date(r.submittedAt).toLocaleDateString('it-IT')}</td>
                                    <td className="text-right whitespace-nowrap">
                                        {status === 'PENDING' ? (
                                            <>
                                                <button type="button" onClick={() => mark(r.id, 'CONFIRMED')}
                                                    className="text-xs px-2.5 py-1 rounded-lg bg-green-600 text-white hover:bg-green-700 mr-1">Ricevuto</button>
                                                <button type="button" onClick={() => mark(r.id, 'REJECTED')} title="Annulla iscrizione"
                                                    className="text-xs p-1 rounded-lg text-slate-400 hover:text-red-600"><X className="h-4 w-4" /></button>
                                            </>
                                        ) : (
                                            <span className="text-xs text-green-700">{r.paidAt ? new Date(r.paidAt).toLocaleDateString('it-IT') : '✓'}</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}

function StatementCard() {
    const { events } = useAdminStore();
    const sorted = [...events].sort((a, b) => eventStartDate(b).localeCompare(eventStartDate(a)));
    const [eventId, setEventId] = useState('');
    const [st, setSt] = useState<Statement | null>(null);
    useEffect(() => {
        setSt(null);
        if (eventId) api.get<Statement>(`/events/${eventId}/statement`).then(setSt).catch(reportApiError);
    }, [eventId]);
    return (
        <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" /> Rendiconto evento</h3>
            <select className={inputCls} value={eventId} onChange={e => setEventId(e.target.value)}>
                <option value="">Scegli un evento…</option>
                {sorted.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
            {st && (
                <>
                    <div className="grid sm:grid-cols-2 gap-3">
                        <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-xs text-slate-500">Incassato dalla segreteria ({SITE_NAME})</p>
                            <p className="text-xl font-bold text-slate-800">{euro(st.totals.incassatoSegreteria)}</p>
                            <p className="text-xs text-slate-500">di cui tue maggiorazioni {euro(st.totals.maggiorazioni)} · commissioni {euro(st.totals.commissioni)}</p>
                        </div>
                        <div className="rounded-xl bg-brand-50 p-3">
                            <p className="text-xs text-slate-500">Da girare all'organizzatore</p>
                            <p className="text-xl font-bold text-brand-700">{euro(st.totals.daGirareOrganizzatore)}</p>
                            <p className="text-xs text-slate-500">in attesa: {st.totals.inAttesa.count} iscrizioni ({euro(st.totals.inAttesa.total)})</p>
                        </div>
                    </div>
                    <table className="w-full text-sm">
                        <tbody className="divide-y">
                            {st.byMethod.filter(m => m.count > 0).map(m => (
                                <tr key={m.method}>
                                    <td className="py-1.5">{METHOD[m.method] ?? m.method}</td>
                                    <td className="text-right text-slate-500">{m.count} pagate</td>
                                    <td className="text-right font-medium">{euro(m.total)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <p className="text-xs text-slate-400">Le quote "in loco" le incassa direttamente l'organizzatore e non sono nel totale da girare.</p>
                    {!!st.totals.commissioniDaOrganizzatore && (
                        <p className="text-sm text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
                            Commissioni da chiedere all'organizzatore (quote incassate da lui): <strong>{euro(st.totals.commissioniDaOrganizzatore)}</strong>
                        </p>
                    )}
                    <button type="button"
                        onClick={() => download(`/events/${eventId}/statement.xlsx`, `rendiconto-${st.event.title}.xlsx`).catch(reportApiError)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-emerald-200 text-emerald-700 text-xs font-semibold hover:bg-emerald-50">
                        <Download className="h-3.5 w-3.5" /> Scarica rendiconto Excel
                    </button>
                </>
            )}
        </section>
    );
}

/** Bonifici dei gruppi delle società: un bonifico conferma tutte le iscrizioni del gruppo. */
function GroupsCard() {
    const [status, setStatus] = useState<'PENDING' | 'CONFIRMED' | 'REJECTED'>('PENDING');
    const [rows, setRows] = useState<PaymentGroupView[]>([]);
    const [open, setOpen] = useState<string | null>(null);
    const load = useCallback(() => {
        api.get<PaymentGroupView[]>(`/admin/groups?status=${status}`).then(setRows).catch(reportApiError);
    }, [status]);
    useEffect(load, [load]);

    async function mark(g: PaymentGroupView, paymentStatus: 'PENDING' | 'CONFIRMED' | 'REJECTED') {
        const msg = paymentStatus === 'REJECTED'
            ? `Annullare tutte le ${g.iscritti} iscrizioni del gruppo ${g.paymentRef} (${g.societa})?`
            : paymentStatus === 'CONFIRMED' ? `Bonifico di ${euro(g.totale)} ricevuto da ${g.societa}? Si confermano ${g.iscritti} iscrizioni.`
                : `Rimettere in attesa il gruppo ${g.paymentRef}?`;
        if (!window.confirm(msg)) return;
        try { await api.patch(`/admin/groups/${g.id}/payment`, { paymentStatus }); load(); }
        catch (e) { reportApiError(e); }
    }

    return (
        <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2"><Users className="h-4 w-4" /> Gruppi società</h3>
                <div className="flex gap-1 text-xs">
                    {(['PENDING', 'CONFIRMED', 'REJECTED'] as const).map(s => (
                        <button key={s} type="button" onClick={() => setStatus(s)}
                            className={`px-3 py-1 rounded-full ${status === s ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                            {s === 'PENDING' ? 'Da incassare' : s === 'CONFIRMED' ? 'Incassati' : 'Annullati'}
                        </button>
                    ))}
                </div>
            </div>
            {rows.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">Nessun gruppo.</p>
            ) : (
                <div className="divide-y">
                    {rows.map(g => (
                        <div key={g.id} className="py-2.5">
                            <div className="flex items-center gap-3 flex-wrap">
                                <button type="button" onClick={() => setOpen(open === g.id ? null : g.id)} className="flex-1 min-w-0 text-left">
                                    <p className="text-sm font-semibold text-slate-800 truncate">{g.societa}</p>
                                    <p className="text-xs text-slate-500 truncate">
                                        <span className="font-mono">{g.paymentRef}</span> · {g.evento} · {g.gara} · {g.iscritti} atleti{g.omaggi ? `, ${g.omaggi} omaggio` : ''}
                                        {g.paymentMethod === 'onsite' ? ' · in loco' : ''}
                                    </p>
                                </button>
                                <span className="font-semibold text-sm">{euro(g.totale)}</span>
                                {status === 'PENDING' ? (
                                    <span className="whitespace-nowrap">
                                        <button type="button" onClick={() => mark(g, 'CONFIRMED')}
                                            className="text-xs px-2.5 py-1 rounded-lg bg-green-600 text-white hover:bg-green-700 mr-1">Ricevuto</button>
                                        <button type="button" onClick={() => mark(g, 'REJECTED')} title="Annulla il gruppo"
                                            className="text-xs p-1 rounded-lg text-slate-400 hover:text-red-600"><X className="h-4 w-4" /></button>
                                    </span>
                                ) : (
                                    <button type="button" onClick={() => mark(g, 'PENDING')} className="text-xs text-slate-500 hover:text-brand-600">Rimetti in attesa</button>
                                )}
                            </div>
                            {open === g.id && <GroupDetails group={g} />}
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

export default function PaymentsSection() {
    if (!USE_API) {
        return <p className="text-sm text-slate-500">I pagamenti sono disponibili solo con il backend attivo.</p>;
    }
    return (
        <div className="space-y-5">
            <BankCard />
            <GroupsCard />
            <StatementCard />
            <SettingsCard />
        </div>
    );
}
