import { useState } from 'react';
import { Plus, Edit2, Trash2, UserCheck, X, Check, Eye, EyeOff, Shield, ShieldOff } from 'lucide-react';
import { useAdminStore } from '../../hooks/useAdminStore';
import type { AppUser } from '../../types';

const inputCls =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ocean-500 focus:border-ocean-500';

function newId() { return `user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`; }

const EMPTY_USER: Omit<AppUser, 'id'> = {
    username: '',
    password: '',
    displayName: '',
    role: 'organizer',
    assignedEventIds: [],
    isActive: true,
};

// ─── UserModal ────────────────────────────────────────────────────────────────

function UserModal({
    user,
    events,
    onSave,
    onClose,
}: {
    user: AppUser | null;
    events: { id: string; title: string }[];
    onSave: (u: AppUser) => void;
    onClose: () => void;
}) {
    const [draft, setDraft] = useState<AppUser>(
        user ?? { id: newId(), ...EMPTY_USER }
    );
    const [showPw, setShowPw] = useState(false);

    function set<K extends keyof AppUser>(key: K, val: AppUser[K]) {
        setDraft(d => ({ ...d, [key]: val }));
    }

    function toggleEvent(eventId: string) {
        const cur = draft.assignedEventIds;
        set('assignedEventIds',
            cur.includes(eventId)
                ? cur.filter(id => id !== eventId)
                : [...cur, eventId]
        );
    }

    function handleSave() {
        if (!draft.username.trim() || !draft.password.trim() || !draft.displayName.trim()) return;
        onSave(draft);
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                    <h3 className="font-semibold text-slate-800">
                        {user ? 'Modifica utente' : 'Nuovo organizzatore'}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Nome visualizzato *</label>
                            <input type="text" value={draft.displayName}
                                onChange={e => set('displayName', e.target.value)}
                                className={inputCls} placeholder="Mario Rossi" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Username *</label>
                            <input type="text" value={draft.username}
                                onChange={e => set('username', e.target.value.toLowerCase().replace(/\s/g, ''))}
                                className={inputCls} placeholder="mrossi" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Password *</label>
                        <div className="relative">
                            <input
                                type={showPw ? 'text' : 'password'}
                                value={draft.password}
                                onChange={e => set('password', e.target.value)}
                                className={`${inputCls} pr-10`}
                                placeholder="••••••••"
                            />
                            <button type="button" onClick={() => setShowPw(v => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                tabIndex={-1}>
                                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <input type="checkbox" id="isActive" checked={draft.isActive}
                            onChange={e => set('isActive', e.target.checked)}
                            className="rounded border-slate-300 text-ocean-600" />
                        <label htmlFor="isActive" className="text-sm text-slate-700">Account attivo</label>
                    </div>

                    {/* Assigned events */}
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-2">Gare assegnate</label>
                        {events.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">Nessuna gara disponibile</p>
                        ) : (
                            <div className="space-y-1 max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-2">
                                {events.map(ev => (
                                    <label key={ev.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={draft.assignedEventIds.includes(ev.id)}
                                            onChange={() => toggleEvent(ev.id)}
                                            className="rounded border-slate-300 text-ocean-600"
                                        />
                                        <span className="text-sm text-slate-700">{ev.title}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-2 px-5 pb-5">
                    <button onClick={onClose}
                        className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50">
                        Annulla
                    </button>
                    <button onClick={handleSave}
                        disabled={!draft.username || !draft.password || !draft.displayName}
                        className="px-4 py-2 rounded-lg bg-ocean-600 text-white text-sm font-medium hover:bg-ocean-700 disabled:opacity-50 flex items-center gap-1.5">
                        <Check className="w-4 h-4" />
                        Salva
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── UsersSection ─────────────────────────────────────────────────────────────

export default function UsersSection() {
    const { users, saveUser, deleteUser, events } = useAdminStore();
    const [editing, setEditing] = useState<AppUser | null | 'new'>(null);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

    const eventList = events.map(e => ({ id: e.id, title: e.title }));

    function handleSave(u: AppUser) {
        saveUser(u);
        setEditing(null);
    }

    function handleDelete(id: string) {
        deleteUser(id);
        setConfirmDelete(null);
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="font-semibold text-slate-800">Organizzatori</h2>
                    <p className="text-sm text-slate-500 mt-0.5">Gestisci gli account degli organizzatori di gara</p>
                </div>
                <button
                    onClick={() => setEditing('new')}
                    className="flex items-center gap-1.5 bg-ocean-600 hover:bg-ocean-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Nuovo organizzatore
                </button>
            </div>

            {users.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
                    <UserCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">Nessun organizzatore ancora</p>
                    <p className="text-slate-400 text-xs mt-1">Crea un account per permettere a un organizzatore di accedere al pannello</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="text-left px-4 py-3 font-medium text-slate-600">Nome</th>
                                <th className="text-left px-4 py-3 font-medium text-slate-600">Username</th>
                                <th className="text-left px-4 py-3 font-medium text-slate-600">Gare assegnate</th>
                                <th className="text-left px-4 py-3 font-medium text-slate-600">Stato</th>
                                <th className="px-4 py-3" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {users.map(u => (
                                <tr key={u.id} className="hover:bg-slate-50/50">
                                    <td className="px-4 py-3 font-medium text-slate-800">{u.displayName}</td>
                                    <td className="px-4 py-3 text-slate-600 font-mono text-xs">{u.username}</td>
                                    <td className="px-4 py-3 text-slate-500">
                                        {u.assignedEventIds.length === 0
                                            ? <span className="italic text-slate-400">nessuna</span>
                                            : u.assignedEventIds.map(eid => {
                                                const ev = eventList.find(e => e.id === eid);
                                                return ev ? (
                                                    <span key={eid} className="inline-block bg-ocean-100 text-ocean-700 text-xs px-2 py-0.5 rounded-full mr-1">
                                                        {ev.title}
                                                    </span>
                                                ) : null;
                                            })}
                                    </td>
                                    <td className="px-4 py-3">
                                        {u.isActive ? (
                                            <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium">
                                                <Shield className="w-3.5 h-3.5" /> Attivo
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-slate-400 text-xs font-medium">
                                                <ShieldOff className="w-3.5 h-3.5" /> Disabilitato
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1 justify-end">
                                            <button onClick={() => setEditing(u)}
                                                className="p-1.5 rounded hover:bg-slate-100 text-slate-500">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            {confirmDelete === u.id ? (
                                                <>
                                                    <button onClick={() => handleDelete(u.id)}
                                                        className="px-2 py-1 rounded bg-red-100 text-red-700 text-xs font-medium hover:bg-red-200">
                                                        Conferma
                                                    </button>
                                                    <button onClick={() => setConfirmDelete(null)}
                                                        className="px-2 py-1 rounded bg-slate-100 text-slate-600 text-xs hover:bg-slate-200">
                                                        No
                                                    </button>
                                                </>
                                            ) : (
                                                <button onClick={() => setConfirmDelete(u.id)}
                                                    className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {editing !== null && (
                <UserModal
                    user={editing === 'new' ? null : editing}
                    events={eventList}
                    onSave={handleSave}
                    onClose={() => setEditing(null)}
                />
            )}
        </div>
    );
}
