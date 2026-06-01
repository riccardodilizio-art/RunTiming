import { CheckCircle2, XCircle, ShieldCheck, ShieldX, ShieldAlert } from 'lucide-react';
import { formatPrice } from './adminShared';
import type { RegistrationSubmission, PaymentStatus, CertStatus } from '../../types';

// ─── RaceStatsBar ─────────────────────────────────────────────────────────────

export function RaceStatsBar({ regs }: { regs: RegistrationSubmission[] }) {
    const total     = regs.length;
    const pending   = regs.filter(r => (r.paymentStatus ?? 'pending') === 'pending').length;
    const confirmed = regs.filter(r => r.paymentStatus === 'confirmed').length;
    const revenue   = regs
        .filter(r => r.paymentStatus === 'confirmed')
        .reduce((s, r) => s + r.pricePaid, 0);
    const certDaVerif = regs.filter(r => r.certStatus === 'in_attesa').length;
    const hasCerts = regs.some(r => r.certStatus !== undefined && r.certStatus !== 'non_richiesto');

    const cards = [
        { label: 'Iscritti totali',      value: total,                color: 'bg-ocean-50 border-ocean-200 text-ocean-700' },
        { label: 'In attesa pagamento',  value: pending,              color: 'bg-amber-50 border-amber-200 text-amber-700' },
        { label: 'Pagamenti confermati', value: confirmed,            color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
        { label: 'Incasso confermato',   value: formatPrice(revenue), color: 'bg-slate-50 border-slate-200 text-slate-700' },
        ...(hasCerts ? [{ label: 'Cert. da verificare', value: certDaVerif, color: certDaVerif > 0 ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-slate-50 border-slate-200 text-slate-400' }] : []),
    ];

    return (
        <div className={`grid grid-cols-2 gap-3 mb-5 ${hasCerts ? 'sm:grid-cols-5' : 'sm:grid-cols-4'}`}>
            {cards.map(c => (
                <div key={c.label} className={`rounded-xl border px-4 py-3 ${c.color}`}>
                    <p className="text-xs opacity-70 mb-0.5">{c.label}</p>
                    <p className="font-display font-700 text-xl leading-none">{c.value}</p>
                </div>
            ))}
        </div>
    );
}

// ─── PaymentBadge ─────────────────────────────────────────────────────────────

export function PaymentBadge({
    status,
    onConfirm,
    onReject,
    onReset,
}: {
    status: PaymentStatus;
    onConfirm: () => void;
    onReject: () => void;
    onReset: () => void;
}) {
    if (status === 'confirmed') {
        return (
            <button
                type="button"
                onClick={onReset}
                title="Clicca per annullare conferma"
                className="flex items-center gap-1 text-emerald-600 font-medium hover:text-emerald-800"
            >
                <CheckCircle2 className="h-3.5 w-3.5" /> Confermato
            </button>
        );
    }
    if (status === 'rejected') {
        return (
            <button
                type="button"
                onClick={onReset}
                title="Clicca per riportare in attesa"
                className="flex items-center gap-1 text-red-500 font-medium hover:text-red-700"
            >
                <XCircle className="h-3.5 w-3.5" /> Rifiutato
            </button>
        );
    }
    return (
        <div className="flex items-center gap-1">
            <span className="text-amber-600 font-medium">In attesa</span>
            <button
                type="button"
                onClick={onConfirm}
                title="Conferma pagamento"
                className="ml-1 p-0.5 rounded hover:bg-emerald-50 text-slate-400 hover:text-emerald-600"
            >
                <CheckCircle2 className="h-3.5 w-3.5" />
            </button>
            <button
                type="button"
                onClick={onReject}
                title="Rifiuta pagamento"
                className="p-0.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"
            >
                <XCircle className="h-3.5 w-3.5" />
            </button>
        </div>
    );
}

// ─── CertBadge ────────────────────────────────────────────────────────────────

export function CertBadge({
    status,
    certInfo,
    fidalVerified,
    onVerify,
    onReject,
    onReset,
}: {
    status: CertStatus;
    certInfo?: { tipo: string; scadenza: string; numero?: string; fileName?: string };
    fidalVerified?: boolean;
    onVerify: () => void;
    onReject: () => void;
    onReset: () => void;
}) {
    const today = new Date().toISOString().slice(0, 10);
    const isExpired = certInfo?.scadenza && certInfo.scadenza < today;

    if (status === 'non_richiesto') {
        return <span className="text-slate-300 text-xs">—</span>;
    }

    if (status === 'verificato') {
        return (
            <button type="button" onClick={onReset} title="Clicca per riportare in attesa"
                className="flex items-center gap-1 text-emerald-600 font-medium hover:text-emerald-800">
                <ShieldCheck className="h-3.5 w-3.5" />
                {fidalVerified ? 'FIDAL' : 'Verificato'}
            </button>
        );
    }

    if (status === 'rifiutato') {
        return (
            <button type="button" onClick={onReset} title="Clicca per riportare in attesa"
                className="flex items-center gap-1 text-red-500 font-medium hover:text-red-700">
                <ShieldX className="h-3.5 w-3.5" /> Rifiutato
            </button>
        );
    }

    // in_attesa
    return (
        <div className="space-y-1">
            <div className="flex items-center gap-1">
                <span className={`font-medium flex items-center gap-1 ${isExpired ? 'text-red-500' : 'text-amber-600'}`}>
                    <ShieldAlert className="h-3.5 w-3.5" />
                    {isExpired ? 'Scaduto' : 'Da verificare'}
                </span>
                <button type="button" onClick={onVerify} title="Approva certificato"
                    className="ml-1 p-0.5 rounded hover:bg-emerald-50 text-slate-400 hover:text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={onReject} title="Rifiuta certificato"
                    className="p-0.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500">
                    <XCircle className="h-3.5 w-3.5" />
                </button>
            </div>
            {certInfo && (
                <div className="text-[10px] text-slate-400 leading-tight">
                    <span className="capitalize">{certInfo.tipo.replace('_', ' ')}</span>
                    {certInfo.scadenza && (
                        <span className={`ml-1 ${isExpired ? 'text-red-400 font-semibold' : ''}`}>
                            · scad. {new Date(certInfo.scadenza).toLocaleDateString('it-IT')}
                        </span>
                    )}
                    {certInfo.fileName && (
                        <span className="ml-1 text-ocean-500" title={certInfo.fileName}>· 📎</span>
                    )}
                </div>
            )}
        </div>
    );
}
