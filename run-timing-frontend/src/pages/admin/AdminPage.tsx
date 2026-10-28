import { useEffect, useState } from 'react';
import { Calendar, Tag, UserCheck, Check, Database, Euro, Building2 } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { useAdminStore, ensureEventApi, isEventFull, reportApiError } from '../../hooks/useAdminStore';
import { useAuth } from '../../context/useAuth';
import { newId } from './adminShared';
import EventEditor from './EventEditor';
import EventsListSection from './EventsListSection';
import AccountsSection from './AccountsSection';
import DiscountSection from './DiscountSection';
import UsersSection from './UsersSection';
import FidalImportSection from './FidalImportSection';
import PaymentsSection from './PaymentsSection';
import SocietiesSection from './SocietiesSection';
import { USE_API } from '../../lib/api';
import type { Event } from '../../types';

type AdminSection = 'gare' | 'pagamenti' | 'account' | 'societa' | 'sconti' | 'utenti' | 'fidal';

export default function AdminPage() {
    const { events, saveEvent, deleteEvent } = useAdminStore();
    const { currentUser, isAdmin, logout, canManageEvent } = useAuth();
    const [section, setSection] = useState<AdminSection>('gare');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);
    // Dopo un salvataggio l'editor riparte dai dati del server (id definitivi)
    const [editorVersion, setEditorVersion] = useState(0);

    // Organizer sees only their assigned events
    const visibleEvents = isAdmin
        ? events
        : events.filter(e => canManageEvent(e.id));

    const editingEvent = editingId ? events.find(e => e.id === editingId) : null;
    // Con il backend l'editor parte solo dal dettaglio completo (moduli, quote,
    // categorie): salvare la versione "leggera" del calendario li cancellerebbe.
    const editingReady = !!editingEvent && isEventFull(editingEvent.id);
    useEffect(() => {
        if (editingEvent && !isEventFull(editingEvent.id)) ensureEventApi(editingEvent.slug).catch(reportApiError);
    }, [editingEvent]);

    const NAV_ITEMS: { key: AdminSection; label: string; icon: React.ReactNode }[] = [
        { key: 'gare',   label: 'Gare',    icon: <Calendar className="h-4 w-4" /> },
        ...(isAdmin ? [
            { key: 'pagamenti' as AdminSection, label: 'Pagamenti', icon: <Euro className="h-4 w-4" /> },
            { key: 'account' as AdminSection, label: 'Account atleti',   icon: <UserCheck className="h-4 w-4" /> },
            ...(USE_API ? [{ key: 'societa' as AdminSection, label: 'Società', icon: <Building2 className="h-4 w-4" /> }] : []),
            { key: 'sconti'  as AdminSection, label: 'Sconti',           icon: <Tag className="h-4 w-4" /> },
            { key: 'utenti'  as AdminSection, label: 'Organizzatori',    icon: <UserCheck className="h-4 w-4" /> },
            { key: 'fidal'   as AdminSection, label: 'DB FIDAL',         icon: <Database className="h-4 w-4" /> },
        ] : []),
    ];

    async function createEvent() {
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
        const created = await saveEvent(newEvent);
        if (created) setEditingId(created.id);
    }

    async function handleSave(event: Event) {
        const ok = await saveEvent(event);
        if (!ok) return;
        setEditorVersion(v => v + 1);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    }

    return (
        <DashboardLayout
            title={isAdmin ? 'Admin Panel' : 'Organizzatore'}
            subtitle={currentUser?.displayName}
            items={NAV_ITEMS}
            active={section}
            onSelect={k => { setSection(k as AdminSection); setEditingId(null); }}
            userLabel={currentUser?.displayName}
            onLogout={logout}
        >
            <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8">
                {saved && (
                    <div className="mb-4 flex items-center gap-1.5 text-sm text-green-600 font-medium">
                        <Check className="h-4 w-4" /> Salvato
                    </div>
                )}
                {editingEvent && !editingReady ? (
                    <p className="text-sm text-slate-500 py-10 text-center">Caricamento evento…</p>
                ) : editingEvent ? (
                    <EventEditor
                        key={`${editingEvent.id}-${editorVersion}`}
                        event={editingEvent}
                        onSave={handleSave}
                        onBack={() => setEditingId(null)}
                        isAdmin={isAdmin}
                    />
                ) : section === 'pagamenti' ? (
                    <PaymentsSection />
                ) : section === 'account' ? (
                    <AccountsSection />
                ) : section === 'societa' ? (
                    <SocietiesSection />
                ) : section === 'sconti' ? (
                    <DiscountSection />
                ) : section === 'utenti' ? (
                    <UsersSection />
                ) : section === 'fidal' ? (
                    <FidalImportSection />
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
        </DashboardLayout>
    );
}
