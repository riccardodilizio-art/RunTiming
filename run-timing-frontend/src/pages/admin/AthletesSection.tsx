import { useState } from 'react';
import { Plus, Edit2, Trash2, Search, X, Check, User } from 'lucide-react';
import { useAdminStore } from '../../hooks/useAdminStore';
import type { Athlete } from '../../types';

const inputCls =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ocean-500 focus:border-ocean-500';

function newId() { return `ath_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`; }

const EMPTY_ATHLETE: Omit<Athlete, 'id'> = {
    name: '', surname: '', birthYear: new Date().getFullYear() - 30,
    club: '', email: '', phone: '', gender: undefined,
    avatarUrl: '', totalRaces: 0, totalPodiums: 0, notes: '',
};

// ─── AthleteModal ─────────────────────────────────────────────────────────────

function AthleteModal({
    athlete,
    onSave,
    onClose,
}: {
    athlete: Athlete | null;
    onSave: (a: Athlete) => void;
    onClose: () => void;
}) {
    const [draft, setDraft] = useState<Athlete>(
        athlete ?? { id: newId(), ...EMPTY_ATHLETE }
    );

    function set<K extends keyof Athlete>(key: K, value: Athlete[K]) {
        setDraft(d => ({ ...d, [key]: value }));
    }

    function handleSave() {
        if (!draft.name.trim() || !draft.surname.trim()) return;
        onSave(draft);
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <h2 className="font-semibold text-slate-800 text-lg">
                        {athlete ? 'Modifica atleta' : 'Nuovo atleta'}
                    </h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
                        <X className="h-4 w-4 text-slate-500" />
                    </button>
                </div>

                <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
                        <input type="text" value={draft.name} onChange={e => set('name', e.target.value)} className={inputCls} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Cognome *</label>
                        <input type="text" value={draft.surname} onChange={e => set('surname', e.target.value)} className={inputCls} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Anno di nascita</label>
                        <input
                            type="number" min={1920} max={new Date().getFullYear()}
                            value={draft.birthYear}
                            onChange={e => set('birthYear', parseInt(e.target.value) || 0)}
                            className={inputCls}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Sesso</label>
                        <select
                            value={draft.gender ?? ''}
                            onChange={e => set('gender', (e.target.value as Athlete['gender']) || undefined)}
                            className={inputCls}
                        >
                            <option value="">—</option>
                            <option value="M">Maschile</option>
                            <option value="F">Femminile</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                        <input type="email" value={draft.email ?? ''} onChange={e => set('email', e.target.value)} className={inputCls} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Telefono</label>
                        <input type="tel" value={draft.phone ?? ''} onChange={e => set('phone', e.target.value)} className={inputCls} />
                    </div>
                    <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Società sportiva</label>
                        <input type="text" value={draft.club ?? ''} onChange={e => set('club', e.target.value)} className={inputCls} />
                    </div>
                    <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Note</label>
                        <textarea rows={3} value={draft.notes ?? ''} onChange={e => set('notes', e.target.value)} className={inputCls} />
                    </div>
                </div>

                <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 text-sm hover:bg-slate-50 transition-colors">
                        Annulla
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!draft.name.trim() || !draft.surname.trim()}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-ocean-600 text-white text-sm font-medium hover:bg-ocean-700 disabled:opacity-40 transition-colors"
                    >
                        <Check className="h-4 w-4" /> Salva
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── AthletesSection ──────────────────────────────────────────────────────────

export default function AthletesSection() {
    const { athletes, saveAthlete, deleteAthlete } = useAdminStore();
    const [search, setSearch] = useState('');
    const [modalAthlete, setModalAthlete] = useState<Athlete | null | 'new'>(null);

    const filtered = athletes.filter(a => {
        const q = search.toLowerCase();
        return (
            a.name.toLowerCase().includes(q) ||
            a.surname.toLowerCase().includes(q) ||
            (a.club ?? '').toLowerCase().includes(q) ||
            (a.email ?? '').toLowerCase().includes(q)
        );
    });

    return (
        <div>
            {/* Toolbar */}
            <div className="flex items-center gap-3 mb-6">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Cerca per nome, cognome, società..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-ocean-500"
                    />
                </div>
                <button
                    onClick={() => setModalAthlete('new')}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ocean-600 text-white text-sm font-medium hover:bg-ocean-700 transition-colors"
                >
                    <Plus className="h-4 w-4" /> Nuovo atleta
                </button>
            </div>

            {filtered.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                    <User className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">{search ? 'Nessun atleta trovato.' : 'Nessun atleta registrato.'}</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                <th className="px-4 py-3">Atleta</th>
                                <th className="px-4 py-3 hidden sm:table-cell">Anno</th>
                                <th className="px-4 py-3 hidden md:table-cell">Società</th>
                                <th className="px-4 py-3 hidden lg:table-cell">Email</th>
                                <th className="px-4 py-3 text-right">Azioni</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filtered.map(a => (
                                <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-ocean-100 flex items-center justify-center flex-shrink-0">
                                                <span className="text-ocean-700 text-xs font-semibold">
                                                    {a.name[0]}{a.surname[0]}
                                                </span>
                                            </div>
                                            <div>
                                                <p className="font-medium text-slate-800">{a.surname} {a.name}</p>
                                                {a.gender && (
                                                    <p className="text-xs text-slate-400">{a.gender === 'M' ? 'Maschile' : 'Femminile'}</p>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">{a.birthYear}</td>
                                    <td className="px-4 py-3 text-slate-500 hidden md:table-cell">{a.club || '—'}</td>
                                    <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">{a.email || '—'}</td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={() => setModalAthlete(a)}
                                                className="p-1.5 rounded hover:bg-slate-100 transition-colors"
                                                title="Modifica"
                                            >
                                                <Edit2 className="h-4 w-4 text-slate-500" />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (confirm(`Eliminare ${a.name} ${a.surname}?`)) deleteAthlete(a.id);
                                                }}
                                                className="p-1.5 rounded hover:bg-red-50 transition-colors"
                                                title="Elimina"
                                            >
                                                <Trash2 className="h-4 w-4 text-red-400" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="px-4 py-2 border-t border-slate-100 text-xs text-slate-400">
                        {filtered.length} atleti{search ? ' trovati' : ' totali'}
                    </div>
                </div>
            )}

            {modalAthlete !== null && (
                <AthleteModal
                    athlete={modalAthlete === 'new' ? null : modalAthlete}
                    onSave={a => { saveAthlete(a); setModalAthlete(null); }}
                    onClose={() => setModalAthlete(null)}
                />
            )}
        </div>
    );
}
