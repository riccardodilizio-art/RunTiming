// Riepilogo di un pagamento di gruppo della società (area società e segreteria).
import { euro, type PaymentGroupView } from '../lib/gruppi';

/** Conto: 19 × 20 € + 19 × 1 € = 399 €. */
export function GroupTotals({ g }: { g: Pick<PaymentGroupView, 'iscritti' | 'omaggi' | 'paganti' | 'quota' | 'maggiorazione' | 'totale'> }) {
    return (
        <div className="text-sm text-slate-700 space-y-0.5">
            <p>{g.iscritti} atleti iscritti{g.omaggi ? <> · <strong className="text-green-700">{g.omaggi} in omaggio</strong></> : null}</p>
            <p>{g.paganti} × {euro(g.quota)}{g.maggiorazione ? ` + ${g.paganti} × ${euro(g.maggiorazione)} di bonifico` : ''}</p>
            <p className="text-base font-bold text-slate-900">Totale {euro(g.totale)}</p>
        </div>
    );
}

/** Dati per il bonifico (un solo bonifico per tutto il gruppo). */
export function BankBox({ g }: { g: Pick<PaymentGroupView, 'bank' | 'causale' | 'totale'> }) {
    if (!g.bank) return null;
    const rows: [string, string][] = [
        ['Importo', euro(g.totale)],
        ...(g.bank.intestatario ? [['Intestatario', g.bank.intestatario] as [string, string]] : []),
        ['IBAN', g.bank.iban || '—'],
        ...(g.bank.banca ? [['Banca', g.bank.banca] as [string, string]] : []),
        ['Causale', g.causale],
    ];
    return (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
            <p className="font-semibold text-amber-900 mb-1">Un solo bonifico entro {g.bank.giorni} giorni</p>
            <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-0.5">
                {rows.map(([k, v]) => (
                    <div key={k} className="contents">
                        <dt className="text-amber-800">{k}</dt>
                        <dd className="font-semibold text-slate-900 break-all select-all">{v}</dd>
                    </div>
                ))}
            </dl>
        </div>
    );
}

export default function GroupDetails({ group: g }: { group: PaymentGroupView }) {
    return (
        <div className="mt-2 rounded-xl bg-slate-50 p-3 space-y-3">
            <GroupTotals g={g} />
            {g.paymentStatus === 'PENDING' && <BankBox g={g} />}
            <ul className="text-xs text-slate-600 columns-1 sm:columns-2">
                {g.atleti.map(a => (
                    <li key={a.id}>
                        {a.cognome} {a.nome}{a.categoria ? ` · ${a.categoria}` : ''}
                        {a.omaggio && <span className="ml-1 text-green-700 font-semibold">omaggio</span>}
                    </li>
                ))}
            </ul>
        </div>
    );
}
