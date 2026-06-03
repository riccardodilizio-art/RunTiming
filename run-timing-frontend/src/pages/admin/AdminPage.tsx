import { useState } from 'react';
import {
    Settings, Calendar, Tag, UserCheck, LogOut, Check,
} from 'lucide-react';
import { useAdminStore } from '../../hooks/useAdminStore';
import { useAuth } from '../../context/useAuth';
import { newId } from './adminShared';
import EventEditor from './EventEditor';
import EventsListSection from './EventsListSection';
import AccountsSection from './AccountsSection';
import DiscountSection from './DiscountSection';
import UsersSection from './UsersSection';
import type { Event } from '../../types';

type AdminSection = 'gare' | 'account' | 'sconti' | 'utenti';

export default function AdminPage() {
    const { events, saveEvent, deleteEvent } = useAdminStore();
    const { currentUser, isAdmin, logout, canManageEvent } = useAuth();
    const [section, setSection] = useState<AdminSection>('gare');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    // Organizer sees only their assigned events
    const visibleEvents = isAdmin
        ? events
        : events.filter(e => canManageEvent(e.id));

    const editingEvent = editingId ? events.find(e => e.id === editingId) : null;

    const NAV_ITEMS: { key: AdminSection; label: string; icon: React.ReactNode }[] = [
        { key: 'gare',   label: 'Gare',    icon: <Calendar className="h-4 w-4" /> },
        ...(isAdmin ? [
            { key: 'account' as AdminSection, label: 'Account atleti',   icon: <UserCheck className="h-4 w-4" /> },
            { key: 'sconti'  as AdminSection, label: 'Sconti',           icon: <Tag className="h-4 w-4" /> },
            { key: 'utenti'  as AdminSection, label: 'Organizzatori',    icon: <UserCheck className="h-4 w-4" /> },
        ] : []),
    ];

    function createEvent() {
        const id = `ev_${newId()}`;
        const slug = `nuovo-evento-${id.slice(-5)}`;
        const newEvent: Event = {
            id,
            title: 'Nuovo evento',
            slug,
            category: 'running',
            date: new Date(Date.now() + 30 * 864e5).toISOString(),
            location: '',
            city: '',
            province: '',
            lat: 41.9028,
            lng: 12.4964,
            coverImage: '',
            days: [{
                id: `${id}-d1`,
                date: new Date(Date.now() + 30 * 864e5).toISOString(),
                races: [],
            }],
            isFeatured: false,
            isLive: false,
            organizer: '',
        };
        saveEvent(newEvent);
        setEditingId(id);
    }

    function handleSave(event: Event) {
        saveEvent(event);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    }

    return (
        <main className="min-h-screen bg-slate-50">
            {/* Top bar */}
            <div className="bg-white border-b border-slate-200 px-4 sm:px-8 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Settings className="h-5 w-5 text-brand-600" />
                    <span className="font-semibold text-slate-800 text-lg">
                        {isAdmin ? 'Admin Panel' : 'Pannello Organizzatore'}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    {saved && (
                        <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                            <Check className="h-4 w-4" /> Salvato
                        </span>
                    )}
                    <span className="hidden sm:block text-sm text-slate-500">
                        {currentUser?.displayName}
                    </span>
                    <button
                        type="button"
                        onClick={logout}
                        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors"
                    >
                        <LogOut className="h-4 w-4" /> Esci
                    </button>
                </div>
            </div>

            {/* Navigation tabs */}
            {!editingEvent && (
                <div className="bg-white border-b border-slate-200 px-4 sm:px-8">
                    <div className="flex gap-1 max-w-5xl mx-auto">
                        {NAV_ITEMS.map(item => (
                            <button
                                key={item.key}
                                type="button"
                                onClick={() => setSection(item.key)}
                                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                                    section === item.key
                                        ? 'border-brand-600 text-brand-700'
                                        : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                {item.icon} {item.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8">
                {editingEvent ? (
                    <EventEditor
                        event={editingEvent}
                        onSave={handleSave}
                        onBack={() => setEditingId(null)}
                        isAdmin={isAdmin}
                    />
                ) : section === 'account' ? (
                    <AccountsSection />
                ) : section === 'sconti' ? (
                    <DiscountSection />
                ) : section === 'utenti' ? (
                    <UsersSection />
                ) : (
                    <EventsListSection
                        events={visibleEvents}
                        isAdmin={isAdmin}
                        onEdit={id => setEditingId(id)}
                        onDelete={id => { if (confirm(`Eliminare questo evento?`)) deleteEvent(id); }}
                        onCreate={createEvent}
                    />
                )}
            </div>
        </main>
    );
}
