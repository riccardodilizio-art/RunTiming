import type { Race, RegistrationSubmission, SportCategory } from '../../types';

// ─── Shared helpers & constants for the admin panel ─────────────────────────────

export function newId() {
    return `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function formatPrice(n: number) {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
}

export const inputCls =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500';

export const categoryOptions: { value: SportCategory; label: string }[] = [
    { value: 'running', label: 'Running' },
    { value: 'cycling', label: 'Ciclismo' },
    { value: 'triathlon', label: 'Triathlon' },
    { value: 'swimming', label: 'Nuoto' },
    { value: 'trail', label: 'Trail' },
    { value: 'other', label: 'Altro' },
];

// ─── CSV export ─────────────────────────────────────────────────────────────────

export function downloadCSV(race: Race, regs: RegistrationSubmission[]) {
    const fields = (race.formSchema ?? []).filter(f => !f.readOnly && f.type !== 'file');
    const headers = ['N°', ...fields.map(f => f.label), 'Quota (€)', 'Pagamento', 'Categoria', 'Data iscrizione'];
    const rows = regs.map((reg, i) => [
        i + 1,
        ...fields.map(f => {
            const val = reg.formData[f.id];
            return typeof val === 'boolean' ? (val ? 'Sì' : 'No') : String(val ?? '');
        }),
        reg.pricePaid.toFixed(2),
        reg.paymentStatus ?? 'pending',
        reg.assignedCategory ?? '',
        new Date(reg.submittedAt).toLocaleDateString('it-IT'),
    ]);
    const csv = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `iscritti-${race.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
