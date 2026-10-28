import { useCallback, useEffect, useState } from 'react';
import { Building2, Check, AlertTriangle } from 'lucide-react';
import { decideSocietyFidalApi, listSocietiesApi, type AdminSocietyRow } from '../../lib/accounts';
import { reportApiError } from '../../hooks/useAdminStore';

// Società (solo admin): l'account società si crea liberamente, quindi il codice
// FIDAL indicato va verificato prima di sbloccare l'import degli atleti tesserati.

const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

export default function SocietiesSection() {
    const [pendingOnly, setPendingOnly] = useState(true);
    const [rows, setRows] = useState<AdminSocietyRow[] | null>(null);
    const [busy, setBusy] = useState<string | null>(null);

    const reload = useCallback(() => {
        listSocietiesApi(pendingOnly).then(setRows).catch(reportApiError);
    }, [pendingOnly]);
    useEffect(() => { reload(); }, [reload]);

    async function decide(id: string, approved: boolean) {
        setBusy(id);
        try {
            await decideSocietyFidalApi(id, approved);
            reload();
        } catch (e) { reportApiError(e); } finally { setBusy(null); }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-brand-600" /> Società
                    </h2>
                    <p className="text-sm text-slate-500 mt-0.5">
                        Approva il codice FIDAL solo se l'account appartiene davvero a quella società:
                        dopo l'approvazione può importare nomi e date di nascita dei tesserati.
                    </p>
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input type="checkbox" checked={pendingOnly} onChange={e => setPendingOnly(e.target.checked)} />
                    Solo da approvare
                </label>
            </div>

            {rows === null ? (
                <p className="text-sm text-slate-400">Caricamento…</p>
            ) : rows.length === 0 ? (
                <p className="text-sm text-slate-500 bg-white border border-slate-200 rounded-xl p-5">
                    {pendingOnly ? 'Nessun codice FIDAL da approvare.' : 'Nessuna società registrata.'}
                </p>
            ) : (
                <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
                    {rows.map(r => {
                        const off = r.fidalUfficiale;
                        const nameMismatch = off && norm(off.denominazione) !== norm(r.societaNome);
                        return (
                            <div key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-slate-800">{r.societaNome}</p>
                                    <p className="text-xs text-slate-500">
                                        {r.account.displayName ?? '—'} · {r.account.email} · registrata il {new Date(r.createdAt).toLocaleDateString('it-IT')}
                                    </p>
                                    {r.codiceFidal ? (
                                        <p className="text-xs mt-1">
                                            Codice <span className="font-mono font-semibold">{r.codiceFidal}</span>
                                            {off ? (
                                                <span className={nameMismatch ? 'text-amber-700' : 'text-slate-500'}>
                                                    {' '}→ FIDAL: {off.denominazione}{off.citta ? ` (${off.citta})` : ''}
                                                </span>
                                            ) : (
                                                <span className="text-amber-700"> → codice non trovato nel DB FIDAL importato</span>
                                            )}
                                        </p>
                                    ) : (
                                        <p className="text-xs mt-1 text-slate-400">Nessun codice FIDAL</p>
                                    )}
                                    {nameMismatch && (
                                        <p className="text-xs mt-1 text-amber-700 flex items-center gap-1">
                                            <AlertTriangle className="h-3.5 w-3.5" /> Il nome indicato non coincide con quello FIDAL: verifica prima di approvare.
                                        </p>
                                    )}
                                </div>
                                {r.codiceFidal && (
                                    <div className="flex items-center gap-2 shrink-0">
                                        {r.fidalApproved ? (
                                            <>
                                                <span className="text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">Approvato</span>
                                                <button disabled={busy === r.id} onClick={() => decide(r.id, false)}
                                                    className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                                                    Revoca
                                                </button>
                                            </>
                                        ) : (
                                            <button disabled={busy === r.id} onClick={() => decide(r.id, true)}
                                                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 disabled:opacity-50">
                                                <Check className="h-3.5 w-3.5" /> Approva codice
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
