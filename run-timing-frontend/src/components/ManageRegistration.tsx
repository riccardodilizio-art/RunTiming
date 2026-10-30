import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRightLeft, CalendarClock, CheckCircle2, UserRoundPen, XCircle } from 'lucide-react';
import { api } from '../lib/api';

// Cambi dopo l'iscrizione: cambio gara (differenza, mai rimborso), cessione del
// pettorale e trasferimento all'anno dopo (con quota di segreteria). Usato
// dall'area atleta, dall'area società, dall'admin e dal link personale nell'email.
// In più il ritiro: un'iscrizione non ancora pagata (o gratuita) si può annullare da soli.

interface Options {
    iscrizione: { id: string; cognome: string; nome: string; gara: string; evento: string; data: string; pagato: number; pettorale: number | null };
    chiuso: string | null;
    nonPagata?: boolean;
    chiusura: string | null;
    cambioGara: { id: string; name: string; distance: string; quota: number; differenza: number; completa: boolean }[] | null;
    cessione: number | null;
    trasferimento: { quota: number; credito: number } | null;
    /** L'atleta può annullare da solo (non pagata o gratuita, prima della chiusura). */
    ritiro?: boolean;
    metodi: ('paypal' | 'bank')[];
    inAttesa: { descrizione: string; totale: number; paymentRef: string | null } | null;
}

interface Result {
    applicato: boolean;
    descrizione: string;
    paymentRef?: string | null;
    totale?: number;
    credito?: { codice: string; importo: number };
}

const euro = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
const inputCls = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';
type Tab = 'gara' | 'cessione' | 'trasferimento';

export default function ManageRegistration({ regId, token, onDone }: { regId?: string; token?: string; onDone?: () => void }) {
    const navigate = useNavigate();
    const base = token ? `/manage/${encodeURIComponent(token)}` : `/registrations/${regId}/changes`;
    const post = token ? `/manage/${encodeURIComponent(token)}/changes` : `/registrations/${regId}/changes`;
    const ritiroUrl = token ? `/manage/${encodeURIComponent(token)}/ritiro` : `/registrations/${regId}/ritiro`;
    const [o, setO] = useState<Options | null>(null);
    const [error, setError] = useState('');
    const [tab, setTab] = useState<Tab | null>(null);
    const [raceId, setRaceId] = useState('');
    const [method, setMethod] = useState<'paypal' | 'bank' | ''>('');
    const [a, setA] = useState({ nome: '', cognome: '', sesso: 'M', dataNascita: '', email: '', tessera: '', societa: '' });
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState<Result | null>(null);
    const [annullata, setAnnullata] = useState(false);

    useEffect(() => {
        api.get<Options>(base).then(x => {
            setO(x);
            setTab(x.cambioGara?.length ? 'gara' : x.cessione != null ? 'cessione' : x.trasferimento ? 'trasferimento' : null);
            setMethod(x.metodi[0] ?? '');
        }).catch(e => setError(e instanceof Error ? e.message : 'Iscrizione non trovata'));
    }, [base]);

    if (error && !o) return <p className="text-sm text-red-600">{error}</p>;
    if (!o) return <p className="text-sm text-slate-400">Caricamento…</p>;

    async function submit(e: FormEvent) {
        e.preventDefault();
        if (!tab) return;
        if (tab === 'trasferimento' && !confirm("Confermi? L'iscrizione di quest'anno verrà annullata e riceverai il credito per la prossima edizione.")) return;
        setBusy(true);
        setError('');
        try {
            const body: Record<string, unknown> = { tipo: tab, paymentMethod: method || undefined };
            if (tab === 'gara') body.raceId = raceId;
            if (tab === 'cessione') {
                body.athlete = {
                    nome: a.nome.trim(), cognome: a.cognome.trim(), sesso: a.sesso, dataNascita: a.dataNascita,
                    email: a.email.trim() || undefined, tessera: a.tessera.trim() || undefined, societa: a.societa.trim() || undefined,
                };
            }
            const r = await api.post<Result>(post, body);
            if (!r.applicato && r.paymentRef) { navigate(`/pagamento/${r.paymentRef}`); return; }
            setDone(r);
            onDone?.();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Cambio non riuscito');
        } finally {
            setBusy(false);
        }
    }

    async function ritira() {
        if (!confirm("Vuoi davvero annullare l'iscrizione? Il posto e il pettorale verranno liberati e non si potrà tornare indietro.")) return;
        setBusy(true);
        setError('');
        try {
            await api.post(ritiroUrl, {});
            setAnnullata(true);
            onDone?.();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Annullamento non riuscito');
        } finally {
            setBusy(false);
        }
    }

    const i = o.iscrizione;
    const head = (
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm">
            <p className="font-semibold text-slate-800">{i.cognome} {i.nome}</p>
            <p className="text-slate-500">{i.evento} · {i.gara}{i.pettorale ? ` · pettorale ${i.pettorale}` : ''}</p>
            <p className="text-xs text-slate-400 mt-0.5">{o.nonPagata ? `Quota da pagare: ${euro(i.pagato)}` : `Quota pagata: ${euro(i.pagato)}`}</p>
        </div>
    );

    if (annullata) {
        return (
            <div className="space-y-3">
                {head}
                <div className="flex gap-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <XCircle className="h-5 w-5 shrink-0 text-slate-500" />
                    <p><strong>Iscrizione annullata.</strong> Ti abbiamo mandato la conferma per email.</p>
                </div>
            </div>
        );
    }

    if (done) {
        return (
            <div className="space-y-3">
                {head}
                <div className="flex gap-2 text-sm text-green-800 bg-green-50 border border-green-200 rounded-xl p-3">
                    <CheckCircle2 className="h-5 w-5 shrink-0" />
                    <div>
                        <p className="font-semibold">{done.descrizione}: fatto.</p>
                        {done.credito && (
                            <p className="mt-1">Il tuo credito di {euro(done.credito.importo)} per la prossima edizione: codice{' '}
                                <span className="font-mono font-bold">{done.credito.codice}</span> (te l'abbiamo mandato anche per email).</p>
                        )}
                        {done.totale ? <p className="mt-1">Da pagare al ritiro del pettorale: {euro(done.totale)}.</p> : null}
                    </div>
                </div>
            </div>
        );
    }

    const tabs: { key: Tab; label: string; icon: ReactNode; ok: boolean }[] = [
        { key: 'gara', label: 'Cambia gara', icon: <ArrowRightLeft className="h-4 w-4" />, ok: !!o.cambioGara?.length },
        { key: 'cessione', label: 'Cedi il pettorale', icon: <UserRoundPen className="h-4 w-4" />, ok: o.cessione != null },
        { key: 'trasferimento', label: "Rinvia all'anno prossimo", icon: <CalendarClock className="h-4 w-4" />, ok: !!o.trasferimento },
    ];
    const available = tabs.filter(t => t.ok);
    const target = o.cambioGara?.find(g => g.id === raceId);
    const amount = tab === 'gara' ? target?.differenza ?? 0 : tab === 'cessione' ? o.cessione ?? 0 : o.trasferimento?.quota ?? 0;

    return (
        <div className="space-y-4">
            {head}
            {o.inAttesa ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <p className="font-semibold">Cambio in attesa di pagamento</p>
                    <p>{o.inAttesa.descrizione} · {euro(o.inAttesa.totale)}</p>
                    {o.inAttesa.paymentRef && (
                        <button type="button" onClick={() => navigate(`/pagamento/${o.inAttesa!.paymentRef}`)} className="mt-2 text-brand-700 font-semibold hover:underline">
                            Vai al pagamento
                        </button>
                    )}
                </div>
            ) : o.chiuso ? (
                <p className="text-sm text-slate-600">{o.chiuso}.</p>
            ) : available.length === 0 ? (
                <p className="text-sm text-slate-600">
                    {o.nonPagata
                        ? "Il cambio gara e il rinvio all'anno prossimo si possono fare dopo aver pagato l'iscrizione."
                        : "Per questo evento non sono previsti cambi dopo l'iscrizione"}: per richieste scrivi alla segreteria.
                </p>
            ) : (
                <form onSubmit={submit} className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                        {available.map(t => (
                            <button key={t.key} type="button" onClick={() => setTab(t.key)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border ${tab === t.key ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-700 border-slate-300 hover:border-brand-400'}`}>
                                {t.icon} {t.label}
                            </button>
                        ))}
                    </div>

                    {tab === 'gara' && (
                        <div className="space-y-2">
                            {o.cambioGara!.map(g => (
                                <label key={g.id} className={`flex items-center gap-3 rounded-xl border p-3 text-sm ${g.completa ? 'opacity-50' : 'cursor-pointer hover:border-brand-400'} ${raceId === g.id ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}>
                                    <input type="radio" name="gara" className="accent-brand-600" disabled={g.completa} checked={raceId === g.id} onChange={() => setRaceId(g.id)} />
                                    <span className="flex-1"><strong>{g.name}</strong> · {g.distance}{g.completa ? ' · al completo' : ''}</span>
                                    <span className="text-right">{g.differenza > 0 ? <>paghi la differenza <strong>{euro(g.differenza)}</strong></> : 'nessun costo'}</span>
                                </label>
                            ))}
                            <p className="text-xs text-slate-500">Nessun rimborso se la nuova gara costa meno. Il pettorale verrà riassegnato.</p>
                        </div>
                    )}

                    {tab === 'cessione' && (
                        <div className="space-y-2">
                            <p className="text-sm text-slate-600">Il pettorale passa a un'altra persona{o.cessione ? <> con una quota di segreteria di <strong>{euro(o.cessione)}</strong></> : ''}. Valgono gli stessi requisiti dell'iscrizione (età, tesseramento, certificato).</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <input className={inputCls} required placeholder="Nome" value={a.nome} onChange={e => setA({ ...a, nome: e.target.value })} />
                                <input className={inputCls} required placeholder="Cognome" value={a.cognome} onChange={e => setA({ ...a, cognome: e.target.value })} />
                                <input className={inputCls} required type="date" value={a.dataNascita} onChange={e => setA({ ...a, dataNascita: e.target.value })} aria-label="Data di nascita" />
                                <select className={inputCls} value={a.sesso} onChange={e => setA({ ...a, sesso: e.target.value })} aria-label="Sesso">
                                    <option value="M">Uomo</option><option value="F">Donna</option>
                                </select>
                                <input className={inputCls} type="email" required={!!token} placeholder="Email del nuovo atleta" value={a.email} onChange={e => setA({ ...a, email: e.target.value })} />
                                <input className={inputCls} placeholder="Tessera FIDAL / Runcard (se tesserato)" value={a.tessera} onChange={e => setA({ ...a, tessera: e.target.value })} />
                                <input className={`${inputCls} sm:col-span-2`} placeholder="Società (se tesserato)" value={a.societa} onChange={e => setA({ ...a, societa: e.target.value })} />
                            </div>
                        </div>
                    )}

                    {tab === 'trasferimento' && o.trasferimento && (
                        <p className="text-sm text-slate-600">
                            L'iscrizione di quest'anno viene annullata e la quota pagata ({euro(o.trasferimento.credito)}) diventa un <strong>credito</strong> per
                            la prossima edizione: ricevi un codice da inserire quando ti iscrivi.
                            {o.trasferimento.quota ? <> Quota di segreteria: <strong>{euro(o.trasferimento.quota)}</strong>.</> : ''}
                        </p>
                    )}

                    {amount > 0 && o.metodi.length > 1 && (
                        <div className="flex gap-4 text-sm">
                            {o.metodi.map(m => (
                                <label key={m} className="flex items-center gap-1.5">
                                    <input type="radio" className="accent-brand-600" checked={method === m} onChange={() => setMethod(m)} />
                                    {m === 'paypal' ? 'PayPal / carta' : 'Bonifico'}
                                </label>
                            ))}
                        </div>
                    )}
                    {amount > 0 && o.metodi.length === 0 && <p className="text-xs text-slate-500">L'importo si paga sul posto, al ritiro del pettorale.</p>}
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    {o.chiusura && <p className="text-xs text-slate-400">I cambi si possono fare fino alla chiusura delle iscrizioni.</p>}
                    <button type="submit" disabled={busy || (tab === 'gara' && !raceId)}
                        className="w-full px-4 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50">
                        {busy ? 'Attendi…' : amount > 0 && o.metodi.length ? `Conferma e paga ${euro(amount)}` : 'Conferma'}
                    </button>
                </form>
            )}
            {o.ritiro && (
                <div className="border-t border-slate-200 pt-4 space-y-2">
                    <p className="text-sm font-semibold text-slate-800">Non puoi più partecipare?</p>
                    <p className="text-sm text-slate-600">
                        {o.nonPagata
                            ? "L'iscrizione non è ancora pagata: puoi annullarla qui, così il posto torna libero. Se hai già pagato (per esempio con un bonifico appena fatto), non annullare: scrivi alla segreteria."
                            : "La gara è gratuita: puoi annullare l'iscrizione qui, così il posto torna libero."}
                    </p>
                    {error && !tab && <p className="text-sm text-red-600">{error}</p>}
                    <button type="button" onClick={ritira} disabled={busy}
                        className="w-full px-4 py-2.5 rounded-lg border border-red-300 text-red-700 text-sm font-semibold hover:bg-red-50 disabled:opacity-50">
                        {busy ? 'Attendi…' : 'Annulla iscrizione'}
                    </button>
                </div>
            )}
            {!o.ritiro && !o.nonPagata && !o.chiuso && (
                <p className="text-xs text-slate-400">Le quote già pagate non si rimborsano: puoi cedere il pettorale o rinviare all'anno prossimo, se previsti.</p>
            )}
        </div>
    );
}

/** Finestra con i cambi di un'iscrizione (area atleta, società, admin). */
export function ManageRegistrationModal({ regId, onClose }: { regId: string; onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-slate-800">Cambia gara, cedi o rinvia</h3>
                    <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none" aria-label="Chiudi">×</button>
                </div>
                <ManageRegistration regId={regId} />
            </div>
        </div>
    );
}
