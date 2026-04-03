import { useState, useMemo } from 'react';
import {
    ShieldCheck, ShieldX, ShieldAlert, Search, User, Mail, X,
} from 'lucide-react';
import { loadAthleteAccounts, updateAthleteAccount } from '../../context/AthleteAuthContext';
import { syncAthleteRegistrationsCert } from '../../hooks/useAdminStore';
import type { AthleteAccount, CertStatus } from '../../types';

type CertFilter = 'tutti' | 'in_attesa' | 'verificato' | 'rifiutato';

// ─── CertBadge ────────────────────────────────────────────────────────────────

function CertBadge({ status }: { status: CertStatus }) {
    if (status === 'verificato')
        return (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                <ShieldCheck className="h-3.5 w-3.5" /> Verificato
            </span>
        );
    if (status === 'rifiutato')
        return (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                <ShieldX className="h-3.5 w-3.5" /> Rifiutato
            </span>
        );
    return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
            <ShieldAlert className="h-3.5 w-3.5" /> In attesa
        </span>
    );
}

// ─── RejectModal ──────────────────────────────────────────────────────────────

function RejectModal({
    account,
    onConfirm,
    onClose,
}: {
    account: AthleteAccount;
    onConfirm: (reason: string) => void;
    onClose: () => void;
}) {
    const [reason, setReason] = useState('');
    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-slate-800">Rifiuta certificato</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <p className="text-sm text-slate-500 mb-4">
                    Stai rifiutando il certificato di{' '}
                    <strong>{account.name} {account.surname}</strong>.
                    L'atleta riceverà una notifica con il motivo del rifiuto e potrà ricaricare un certificato corretto.
                </p>
                <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Motivo del rifiuto <span className="text-red-500">*</span>
                    </label>
                    <textarea
                        rows={3}
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        placeholder="es. Certificato scaduto, tipo di certificato non idoneo alla gara..."
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ocean-500"
                    />
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => reason.trim() && onConfirm(reason.trim())}
                        disabled={!reason.trim()}
                        className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors"
                    >
                        Conferma rifiuto
                    </button>
                    <button
                        onClick={onClose}
                        className="px-4 py-2.5 rounded-lg border border-slate-300 text-slate-600 text-sm hover:bg-slate-50 transition-colors"
                    >
                        Annulla
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── AccountsSection ──────────────────────────────────────────────────────────

export default function AccountsSection() {
    const [accounts, setAccounts] = useState<AthleteAccount[]>(() => loadAthleteAccounts());
    const [search, setSearch]       = useState('');
    const [certFilter, setCertFilter] = useState<CertFilter>('tutti');
    const [rejectingAccount, setRejectingAccount] = useState<AthleteAccount | null>(null);
    const [emailSentFor, setEmailSentFor]         = useState<string | null>(null);

    function reload() {
        setAccounts(loadAthleteAccounts());
    }

    function approveCert(account: AthleteAccount) {
        updateAthleteAccount(account.id, {
            certStatus: 'verificato',
            certRejectionReason: undefined,
        });
        syncAthleteRegistrationsCert(account.id, 'verificato');
        reload();
    }

    function rejectCert(account: AthleteAccount, reason: string) {
        updateAthleteAccount(account.id, {
            certStatus: 'rifiutato',
            certRejectionReason: reason,
        });
        syncAthleteRegistrationsCert(account.id, 'rifiutato', reason);
        setRejectingAccount(null);
        setEmailSentFor(account.id);
        reload();
        // Rimuove la notifica dopo 5 secondi
        setTimeout(() => setEmailSentFor(null), 5000);
    }

    const filtered = useMemo(() => {
        return accounts
            .filter(a => {
                if (certFilter === 'in_attesa')  return a.certStatus === 'in_attesa';
                if (certFilter === 'verificato') return a.certStatus === 'verificato';
                if (certFilter === 'rifiutato')  return a.certStatus === 'rifiutato';
                return true;
            })
            .filter(a => {
                if (!search) return true;
                const q = search.toLowerCase();
                return (
                    `${a.name} ${a.surname}`.toLowerCase().includes(q) ||
                    a.email.toLowerCase().includes(q) ||
                    (a.club ?? '').toLowerCase().includes(q)
                );
            })
            .sort((a, b) => {
                // Da verificare prima
                if (a.certStatus === 'in_attesa' && b.certStatus !== 'in_attesa') return -1;
                if (b.certStatus === 'in_attesa' && a.certStatus !== 'in_attesa') return 1;
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            });
    }, [accounts, search, certFilter]);

    const pendingCount   = accounts.filter(a => a.certStatus === 'in_attesa').length;
    const verifiedCount  = accounts.filter(a => a.certStatus === 'verificato').length;
    const rejectedCount  = accounts.filter(a => a.certStatus === 'rifiutato').length;

    return (
        <div>
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {[
                    { label: 'Account totali',      value: accounts.length, color: 'bg-ocean-50 border-ocean-200 text-ocean-700' },
                    { label: 'Cert. da verificare', value: pendingCount,    color: pendingCount  > 0 ? 'bg-amber-50 border-amber-200 text-amber-700'   : 'bg-slate-50 border-slate-200 text-slate-400' },
                    { label: 'Cert. verificati',    value: verifiedCount,   color: verifiedCount > 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-400' },
                    { label: 'Cert. rifiutati',     value: rejectedCount,   color: rejectedCount > 0 ? 'bg-red-50 border-red-200 text-red-700'           : 'bg-slate-50 border-slate-200 text-slate-400' },
                ].map(c => (
                    <div key={c.label} className={`rounded-xl border px-4 py-3 ${c.color}`}>
                        <p className="text-xs opacity-70 mb-0.5">{c.label}</p>
                        <p className="font-display font-700 text-xl leading-none">{c.value}</p>
                    </div>
                ))}
            </div>

            {/* Notifica email simulata */}
            {emailSentFor && (
                <div className="mb-4 flex items-center gap-2 bg-ocean-50 border border-ocean-200 text-ocean-800 rounded-xl px-4 py-3 text-sm">
                    <Mail className="h-4 w-4 shrink-0" />
                    <span>
                        Notifica email inviata all'atleta con il motivo del rifiuto e le istruzioni per ricaricare il certificato.
                    </span>
                </div>
            )}

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Cerca per nome, email, società..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-ocean-500"
                    />
                </div>
                <div className="flex gap-2 flex-wrap">
                    {([
                        { key: 'tutti',      label: 'Tutti' },
                        { key: 'in_attesa',  label: `Da verificare${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
                        { key: 'verificato', label: 'Verificati' },
                        { key: 'rifiutato',  label: 'Rifiutati' },
                    ] as { key: CertFilter; label: string }[]).map(f => (
                        <button
                            key={f.key}
                            onClick={() => setCertFilter(f.key)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                                certFilter === f.key
                                    ? 'bg-ocean-600 text-white border-ocean-600'
                                    : 'bg-white text-slate-600 border-slate-300 hover:border-ocean-400'
                            }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tabella */}
            {filtered.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                    <User className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">
                        {search || certFilter !== 'tutti'
                            ? 'Nessun account trovato con questi filtri.'
                            : 'Nessun account atleta registrato.'}
                    </p>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                <th className="px-4 py-3">Atleta</th>
                                <th className="px-4 py-3 hidden md:table-cell">Tessere</th>
                                <th className="px-4 py-3">Certificato medico</th>
                                <th className="px-4 py-3 text-right">Azioni</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filtered.map(a => (
                                <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">

                                    {/* Atleta */}
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-ocean-100 flex items-center justify-center shrink-0">
                                                <span className="text-ocean-700 text-xs font-semibold">
                                                    {a.name[0]}{a.surname[0]}
                                                </span>
                                            </div>
                                            <div>
                                                <p className="font-medium text-slate-800">{a.surname} {a.name}</p>
                                                <p className="text-xs text-slate-400">{a.email}</p>
                                                {a.club && <p className="text-xs text-ocean-600">{a.club}</p>}
                                            </div>
                                        </div>
                                    </td>

                                    {/* Tessere */}
                                    <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell">
                                        {a.fidalTessera   && <p>FIDAL: {a.fidalTessera}</p>}
                                        {a.runcardTessera && <p>RunCard: {a.runcardTessera}</p>}
                                        {!a.fidalTessera && !a.runcardTessera && <span className="italic">—</span>}
                                    </td>

                                    {/* Certificato */}
                                    <td className="px-4 py-3">
                                        {a.certType && a.certStatus && a.certStatus !== 'non_richiesto' ? (
                                            <div className="space-y-1">
                                                <CertBadge status={a.certStatus} />
                                                <p className="text-xs text-slate-500">
                                                    {a.certType.replace('_', ' ')}
                                                    {a.certNumber && ` · N° ${a.certNumber}`}
                                                    {a.certExpiry && ` · Sc. ${new Date(a.certExpiry).toLocaleDateString('it-IT')}`}
                                                </p>
                                                {a.certFileName && (
                                                    <p className="text-xs text-slate-400 italic">{a.certFileName}</p>
                                                )}
                                                {a.certStatus === 'rifiutato' && a.certRejectionReason && (
                                                    <p className="text-xs text-red-600">
                                                        Motivo: {a.certRejectionReason}
                                                    </p>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-slate-400 italic">Nessun certificato caricato</span>
                                        )}
                                    </td>

                                    {/* Azioni */}
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                            {a.certType && a.certStatus === 'in_attesa' && (
                                                <>
                                                    <button
                                                        onClick={() => approveCert(a)}
                                                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium hover:bg-emerald-100 transition-colors"
                                                    >
                                                        <ShieldCheck className="h-3.5 w-3.5" /> Approva
                                                    </button>
                                                    <button
                                                        onClick={() => setRejectingAccount(a)}
                                                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs font-medium hover:bg-red-100 transition-colors"
                                                    >
                                                        <ShieldX className="h-3.5 w-3.5" /> Rifiuta
                                                    </button>
                                                </>
                                            )}
                                            {a.certType && a.certStatus === 'verificato' && (
                                                <button
                                                    onClick={() => setRejectingAccount(a)}
                                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs font-medium hover:bg-red-100 transition-colors"
                                                >
                                                    <ShieldX className="h-3.5 w-3.5" /> Revoca
                                                </button>
                                            )}
                                            {a.certType && a.certStatus === 'rifiutato' && (
                                                <button
                                                    onClick={() => approveCert(a)}
                                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium hover:bg-emerald-100 transition-colors"
                                                >
                                                    <ShieldCheck className="h-3.5 w-3.5" /> Approva ora
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="px-4 py-2 border-t border-slate-100 text-xs text-slate-400">
                        {filtered.length} account{search || certFilter !== 'tutti' ? ' trovati' : ' totali'}
                    </div>
                </div>
            )}

            {/* Modal rifiuto */}
            {rejectingAccount && (
                <RejectModal
                    account={rejectingAccount}
                    onConfirm={reason => rejectCert(rejectingAccount, reason)}
                    onClose={() => setRejectingAccount(null)}
                />
            )}
        </div>
    );
}
