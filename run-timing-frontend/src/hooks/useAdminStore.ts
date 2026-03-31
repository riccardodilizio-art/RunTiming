import { useState, useMemo } from 'react';
import { mockEvents } from '../data/mockEvents';
import type { Event } from '../types';

const LS_KEY = 'rt_admin_events';

function load(): Event[] {
    try {
        const raw = localStorage.getItem(LS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function persist(events: Event[]) {
    localStorage.setItem(LS_KEY, JSON.stringify(events));
}

export function useAdminStore() {
    const [overrides, setOverrides] = useState<Event[]>(() => load());

    // Merge base mockEvents with admin overrides (overrides win by event.id)
    const events = useMemo<Event[]>(() => {
        const merged: Event[] = [...mockEvents];
        for (const ov of overrides) {
            const idx = merged.findIndex(e => e.id === ov.id);
            if (idx >= 0) merged[idx] = ov;
            else merged.push(ov);
        }
        return merged;
    }, [overrides]);

    function saveEvent(event: Event) {
        const next = [...overrides];
        const idx = next.findIndex(e => e.id === event.id);
        if (idx >= 0) next[idx] = event;
        else next.push(event);
        setOverrides(next);
        persist(next);
    }

    function deleteEvent(id: string) {
        // Only remove from overrides; mockEvents base remains untouched
        const next = overrides.filter(e => e.id !== id);
        setOverrides(next);
        persist(next);
    }

    function getEvent(slug: string): Event | undefined {
        return events.find(e => e.slug === slug);
    }

    return { events, saveEvent, deleteEvent, getEvent };
}

// ─── Registration submissions ─────────────────────────────────────────────────

const LS_REG_KEY = 'rt_registrations';

export function saveRegistration(sub: import('../types').RegistrationSubmission) {
    try {
        const raw = localStorage.getItem(LS_REG_KEY);
        const list = raw ? JSON.parse(raw) : [];
        list.push(sub);
        localStorage.setItem(LS_REG_KEY, JSON.stringify(list));
    } catch { /* ignore */ }
}
