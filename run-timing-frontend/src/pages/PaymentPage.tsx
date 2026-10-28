import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, Copy, CreditCard, Euro, Clock, AlertCircle } from 'lucide-react';
import { api, ApiError } from '../lib/api';

// Pagina di pagamento di un'iscrizione: /pagamento/RT-XXXXXXXX
// Il link vale anche dopo (dalla mail o dalla "Verifica iscrizione"): si può
// pagare con PayPal/carta oppure vedere i dati del bonifico, e cambiare idea.

interface PayInfo {
    ref: string;
    atleta: string;
    evento: string;
    gara: string;
    data: string;
    status: 'PENDING' | 'CONFIRMED' | 'REJECTED';
    method: string | null;
    amount: number;
    paymentFee: number;
    paidAt: string | null;
    obbligatorio: boolean;
    options: { method: 'paypal' | 'bank' | 'onsite'; fee: number; total: number }[];
    bank: { iban: string; intestatario: string; banca: string; causale: string; giorni: number } | null;
    paypalReady: boolean;
}

interface PaypalConfig { paypalClientId: string | null }

// Tipi minimi del JS SDK di PayPal (caricato da paypal.com)
interface PaypalButtons {
    render: (el: HTMLElement) => Promise<void>;
    close?: () => void;
}
declare global {
    interface Window {
        paypal?: {
            Buttons: (opts: {
                style?: Record<string, string>;
                createOrder: () => Promise<string>;
                onApprove: (data: { orderID: string }) => Promise<void>;
                onError?: (err: unknown) => void;
            }) => PaypalButtons;
        };
    }
}

const euro = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

function loadPaypalSdk(clientId: string): Promise<void> {
    if (window.paypal) return Promise.resolve();
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        // enable-funding=card: pulsante carta anche per chi non ha un conto PayPal
        s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=EUR&intent=capture&components=buttons&enable-funding=card&locale=it_IT`;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('Impossibile caricare PayPal'));
        document.head.appendChild(s);
    });
}

function CopyField({ label, value }: { label: string; value: string }) {
    const [ok, setOk] = useState(false);
    return (
        <div>
            <p className="text-xs text-slate-500 mb-1">{label}</p>
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
                <span className="font-mono text-sm text-slate-800 break-all flex-1 select-all">{value || '—'}</span>
                {value && (
                    <button
                        type="button"
                        onClick={() => { void navigator.clipboard?.writeText(value); setOk(true); setTimeout(() => setOk(false), 1500); }}
                        className="text-slate-400 hover:text-brand-600 flex-shrink-0"
                        title="Copia"
                    >
                        {ok ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    </button>
                )}
            </div>
        </div>
    );
}

export default function PaymentPage() {
    const { ref = '' } = useParams<{ ref: string }>();
    const [info, setInfo] = useState<PayInfo | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [view, setView] = useState<'paypal' | 'bank' | null>(null);
    const paypalEl = useRef<HTMLDivElement>(null);

    const load = useCallback(async () => {
        try {
            const i = await api.get<PayInfo>(`/payments/${encodeURIComponent(ref)}`);
            setInfo(i);
            setView(v => v ?? (i.method === 'bank' ? 'bank' : i.method === 'paypal' ? 'paypal' : null));
        } catch (e) {
            setError(e instanceof ApiError && e.status === 404 ? 'Codice di pagamento non trovato.' : 'Impossibile caricare il pagamento.');
        }
    }, [ref]);

    useEffect(() => { void load(); }, [load]);

    // Pulsanti PayPal / carta
    useEffect(() => {
        if (view !== 'paypal' || !info || info.status !== 'PENDING' || !info.paypalReady || !paypalEl.current) return;
        let buttons: PaypalButtons | undefined;
        let cancelled = false;
        (async () => {
            try {
                const cfg = await api.get<PaypalConfig>('/settings/payments');
                if (!cfg.paypalClientId) return;
                await loadPaypalSdk(cfg.paypalClientId);
                if (cancelled || !window.paypal || !paypalEl.current) return;
                paypalEl.current.innerHTML = '';
                buttons = window.paypal.Buttons({
                    style: { layout: 'vertical', shape: 'rect', label: 'pay' },
                    // Importo deciso dal server, non dal browser
                    createOrder: async () => (await api.post<{ orderId: string }>(`/payments/${encodeURIComponent(ref)}/paypal/order`)).orderId,
                    onApprove: async ({ orderID }) => {
                        setBusy(true);
                        try {
                            setInfo(await api.post<PayInfo>(`/payments/${encodeURIComponent(ref)}/paypal/capture`, { orderId: orderID }));
                        } catch (e) {
                            setError(e instanceof Error ? e.message : 'Pagamento non riuscito');
                        } finally {
                            setBusy(false);
                        }
                    },
                    onError: () => setError('Pagamento non riuscito con PayPal. Riprova o scegli il bonifico.'),
                });
                await buttons.render(paypalEl.current);
            } catch {
                setError('PayPal non disponibile in questo momento. Riprova più tardi o scegli il bonifico.');
            }
        })();
        return () => { cancelled = true; buttons?.close?.(); };
    }, [view, info, ref]);

    async function chooseBank() {
        setBusy(true);
        try {
            setInfo(await api.post<PayInfo>(`/payments/${encodeURIComponent(ref)}/bank`));
            setView('bank');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Operazione non riuscita');
        } finally {
            setBusy(false);
        }
    }

    if (error && !info) {
        return (
            <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
                <div className="text-center">
                    <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
                    <p className="text-slate-700 mb-4">{error}</p>
                    <Link to="/events" className="text-brand-600 hover:underline text-sm">← Torna agli eventi</Link>
                </div>
            </main>
        );
    }
    if (!info) return <main className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">Caricamento…</main>;

    const opt = (m: 'paypal' | 'bank') => info.options.find(o => o.method === m);
    const paid = info.status === 'CONFIRMED';

    return (
        <main className="min-h-screen bg-slate-50 py-8 px-4">
            <div className="max-w-lg mx-auto space-y-4">
                <div>
                    <p className="text-sm text-slate-400">{info.evento}</p>
                    <h1 className="text-2xl font-bold text-slate-800">Pagamento iscrizione</h1>
                    <p className="text-sm text-slate-500">{info.gara} · {info.atleta} · codice <span className="font-mono">{info.ref}</span></p>
                </div>

                {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}

                {paid ? (
                    <div className="bg-white border border-green-200 rounded-2xl p-6 text-center">
                        <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Check className="h-7 w-7 text-green-600" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800">Pagamento ricevuto</h2>
                        <p className="text-slate-500 text-sm mt-1">{euro(info.amount)} · iscrizione confermata</p>
                        <Link to="/events" className="inline-block mt-5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg">
                            Torna agli eventi
                        </Link>
                    </div>
                ) : info.status === 'REJECTED' ? (
                    <div className="bg-white border border-red-200 rounded-2xl p-6 text-center text-slate-600">
                        Questa iscrizione è stata annullata. Contatta la segreteria se pensi sia un errore.
                    </div>
                ) : (
                    <>
                        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                            <p className="text-sm font-medium text-slate-700">Come vuoi pagare?</p>
                            {opt('paypal') && (
                                <button type="button" onClick={() => setView('paypal')} disabled={busy}
                                    className={`w-full text-left p-4 rounded-xl border-2 flex items-center gap-3 ${view === 'paypal' ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}>
                                    <CreditCard className="h-5 w-5 text-[#003087]" />
                                    <span className="flex-1">
                                        <span className="font-semibold text-slate-800 block">PayPal o carta</span>
                                        <span className="text-xs text-slate-400">Conferma immediata</span>
                                    </span>
                                    <span className="font-semibold text-slate-700">{euro(opt('paypal')!.total)}</span>
                                </button>
                            )}
                            {opt('bank') && (
                                <button type="button" onClick={() => (info.method === 'bank' ? setView('bank') : chooseBank())} disabled={busy}
                                    className={`w-full text-left p-4 rounded-xl border-2 flex items-center gap-3 ${view === 'bank' ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}>
                                    <Euro className="h-5 w-5 text-slate-700" />
                                    <span className="flex-1">
                                        <span className="font-semibold text-slate-800 block">Bonifico bancario</span>
                                        <span className="text-xs text-slate-400">Confermato dopo il controllo della segreteria</span>
                                    </span>
                                    <span className="font-semibold text-slate-700">{euro(opt('bank')!.total)}</span>
                                </button>
                            )}
                        </div>

                        {view === 'paypal' && (
                            <div className="bg-white border border-slate-200 rounded-2xl p-4">
                                {info.paypalReady ? (
                                    <>
                                        <p className="text-sm text-slate-600 mb-3">Totale <strong>{euro(opt('paypal')!.total)}</strong>. Il pagamento con carta avviene sui server di PayPal.</p>
                                        <div ref={paypalEl} />
                                        {busy && <p className="text-sm text-slate-500 mt-2">Conferma del pagamento in corso…</p>}
                                    </>
                                ) : (
                                    <p className="text-sm text-amber-700">Il pagamento con PayPal/carta non è ancora attivo. Scegli il bonifico{info.obbligatorio ? '' : ' o paga sul posto'}.</p>
                                )}
                            </div>
                        )}

                        {view === 'bank' && info.bank && (
                            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                                <p className="text-sm text-slate-600">
                                    Effettua un bonifico di <strong>{euro(info.amount)}</strong> entro <strong>{info.bank.giorni} giorni</strong> con questi dati.
                                    Usa <strong>esattamente</strong> la causale indicata: serve ad abbinare il pagamento alla tua iscrizione.
                                </p>
                                <CopyField label="Intestatario" value={info.bank.intestatario} />
                                <CopyField label="IBAN" value={info.bank.iban} />
                                {info.bank.banca && <CopyField label="Banca" value={info.bank.banca} />}
                                <CopyField label="Importo" value={info.amount.toFixed(2).replace('.', ',')} />
                                <CopyField label="Causale" value={info.bank.causale} />
                                <p className="flex items-start gap-1.5 text-xs text-slate-500">
                                    <Clock className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                                    {info.obbligatorio
                                        ? "Pagamento anticipato obbligatorio: se il bonifico non arriva entro la scadenza, l'iscrizione viene annullata."
                                        : "Se non riesci a fare il bonifico, potrai pagare sul posto il giorno della gara."}
                                </p>
                            </div>
                        )}

                        <p className="text-xs text-slate-400 text-center">
                            Conserva questo link: puoi tornare qui per pagare o controllare lo stato. Codice {info.ref}.
                        </p>
                    </>
                )}
            </div>
        </main>
    );
}
