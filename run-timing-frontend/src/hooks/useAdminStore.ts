import { useMemo, useSyncExternalStore } from 'react';
import { mockEvents } from '../data/mockEvents';
import type {
    Event, Athlete, DiscountCode, CommissionConfig, RegistrationSubmission, AppUser, PaymentStatus, CertStatus, Result,
} from '../types';

// ─── Shared local store ─────────────────────────────────────────────────────────
//
// A tiny module-level store backed by localStorage. Unlike per-component
// `useState`, a store is shared across every `useAdminStore()` consumer and
// notifies subscribers on every mutation, so the UI stays in sync everywhere
// without manual re-read hacks. Read it reactively in components via
// `useSyncExternalStore`, or imperatively via `getSnapshot()` for non-React
// call sites. (When the backend lands, swap the localStorage calls for fetch.)

interface LocalStore<T> {
    getSnapshot: () => T;
    subscribe: (cb: () => void) => () => void;
    set: (next: T) => void;
}

function createLocalStore<T>(key: string, fallback: T): LocalStore<T> {
    let cache: T;
    let loaded = false;
    const listeners = new Set<() => void>();

    function getSnapshot(): T {
        if (!loaded) {
            try { const raw = localStorage.getItem(key); cache = raw ? JSON.parse(raw) : fallback; }
            catch { cache = fallback; }
            loaded = true;
        }
        return cache;
    }

    function set(next: T) {
        cache = next;
        loaded = true;
        try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* ignore */ }
        listeners.forEach(l => l());
    }

    function subscribe(cb: () => void): () => void {
        listeners.add(cb);
        return () => { listeners.delete(cb); };
    }

    return { getSnapshot, subscribe, set };
}

const DEFAULT_COMMISSION: CommissionConfig = { fixedFee: 0, percentFee: 0, appliedTo: 'buyer' };

const eventsStore        = createLocalStore<Event[]>('rt_admin_events', []);
const athletesStore      = createLocalStore<Athlete[]>('rt_athletes', []);
const discountsStore     = createLocalStore<DiscountCode[]>('rt_discount_codes', []);
const commissionStore    = createLocalStore<CommissionConfig>('rt_commission', DEFAULT_COMMISSION);
const registrationsStore = createLocalStore<RegistrationSubmission[]>('rt_registrations', []);
const resultsStore       = createLocalStore<Record<string, Result[]>>('rt_results', {});
const usersStore         = createLocalStore<AppUser[]>('rt_users', []);

// ─── Imperative accessors (non-React call sites) ────────────────────────────────

/** Read the current registrations (kept for non-reactive call sites). */
export function loadRegistrations(): RegistrationSubmission[] {
    return registrationsStore.getSnapshot();
}

export function saveRegistration(sub: RegistrationSubmission) {
    registrationsStore.set([...registrationsStore.getSnapshot(), sub]);
}

/**
 * Admin-side: sincronizza il certStatus su tutte le iscrizioni di un atleta.
 * Chiamato quando l'admin approva o rifiuta il certificato sull'account.
 */
export function syncAthleteRegistrationsCert(
    athleteAccountId: string,
    certStatus: CertStatus,
    certRejectionReason?: string,
) {
    registrationsStore.set(registrationsStore.getSnapshot().map(r => {
        if (r.athleteAccountId !== athleteAccountId) return r;
        if (r.certStatus === 'non_richiesto' || r.certStatus === undefined) return r;
        return { ...r, certStatus, certRejectionReason };
    }));
}

export function loadUsers(): AppUser[] {
    return usersStore.getSnapshot();
}

export function loadResults(): Record<string, Result[]> {
    return resultsStore.getSnapshot();
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAdminStore() {
    // Every entity is a shared, reactive store: a mutation in one component
    // re-renders all consumers (no manual re-read hacks anywhere).
    const overrides     = useSyncExternalStore(eventsStore.subscribe, eventsStore.getSnapshot);
    const athletes      = useSyncExternalStore(athletesStore.subscribe, athletesStore.getSnapshot);
    const discountCodes = useSyncExternalStore(discountsStore.subscribe, discountsStore.getSnapshot);
    const commission    = useSyncExternalStore(commissionStore.subscribe, commissionStore.getSnapshot);
    const registrations = useSyncExternalStore(registrationsStore.subscribe, registrationsStore.getSnapshot);
    const resultsMap    = useSyncExternalStore(resultsStore.subscribe, resultsStore.getSnapshot);
    const users         = useSyncExternalStore(usersStore.subscribe, usersStore.getSnapshot);

    // Events: mock seed merged with admin-saved overrides.
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
        if (idx >= 0) next[idx] = event; else next.push(event);
        eventsStore.set(next);
    }

    function deleteEvent(id: string) {
        eventsStore.set(overrides.filter(e => e.id !== id));
    }

    function getEvent(slug: string): Event | undefined {
        return events.find(e => e.slug === slug);
    }

    // Athletes
    function saveAthlete(athlete: Athlete) {
        const next = [...athletes];
        const idx = next.findIndex(a => a.id === athlete.id);
        if (idx >= 0) next[idx] = athlete; else next.push(athlete);
        athletesStore.set(next);
    }

    function deleteAthlete(id: string) {
        athletesStore.set(athletes.filter(a => a.id !== id));
    }

    // Discount codes
    function saveDiscountCode(code: DiscountCode) {
        const next = [...discountCodes];
        const idx = next.findIndex(c => c.id === code.id);
        if (idx >= 0) next[idx] = code; else next.push(code);
        discountsStore.set(next);
    }

    function deleteDiscountCode(id: string) {
        discountsStore.set(discountCodes.filter(c => c.id !== id));
    }

    /** Valida un codice sconto e restituisce il codice se valido, null altrimenti */
    function validateDiscountCode(inputCode: string): DiscountCode | null {
        const today = new Date().toISOString().slice(0, 10);
        const found = discountCodes.find(
            c => c.code.toLowerCase() === inputCode.toLowerCase() && c.isActive
        );
        if (!found) return null;
        if (found.expiresAt && found.expiresAt < today) return null;
        if (found.maxUses !== undefined && found.usedCount >= found.maxUses) return null;
        return found;
    }

    /** Incrementa il contatore utilizzi di un codice sconto */
    function applyDiscountCode(codeId: string) {
        discountsStore.set(discountCodes.map(c =>
            c.id === codeId ? { ...c, usedCount: c.usedCount + 1 } : c
        ));
    }

    // Commission
    function saveCommission(c: CommissionConfig) {
        commissionStore.set(c);
    }

    // Registrations
    function getRegistrations(): RegistrationSubmission[] {
        return registrations;
    }

    function getRegistrationsByEvent(eventId: string): RegistrationSubmission[] {
        return registrations.filter(r => r.eventId === eventId);
    }

    function getRegistrationsByRace(raceId: string): RegistrationSubmission[] {
        return registrations.filter(r => r.raceId === raceId);
    }

    function updatePaymentStatus(registrationId: string, status: PaymentStatus) {
        registrationsStore.set(registrations.map(r =>
            r.id === registrationId ? { ...r, paymentStatus: status } : r
        ));
    }

    function deleteRegistration(registrationId: string) {
        registrationsStore.set(registrations.filter(r => r.id !== registrationId));
    }

    function updateRegistration(id: string, updates: Partial<RegistrationSubmission>) {
        registrationsStore.set(registrations.map(r => r.id === id ? { ...r, ...updates } : r));
    }

    function updateCertStatus(registrationId: string, status: CertStatus, rejectionReason?: string) {
        registrationsStore.set(registrations.map(r =>
            r.id === registrationId
                ? { ...r, certStatus: status, certRejectionReason: rejectionReason ?? r.certRejectionReason }
                : r
        ));
    }

    // Results
    function saveResults(raceId: string, results: Result[]) {
        resultsStore.set({ ...resultsMap, [raceId]: results });
    }

    function getResults(raceId: string): Result[] {
        return resultsMap[raceId] ?? [];
    }

    // Users (organizers)
    function saveUser(user: AppUser) {
        const next = [...users];
        const idx = next.findIndex(u => u.id === user.id);
        if (idx >= 0) next[idx] = user; else next.push(user);
        usersStore.set(next);
    }

    function deleteUser(id: string) {
        usersStore.set(users.filter(u => u.id !== id));
    }

    return {
        // events
        events, saveEvent, deleteEvent, getEvent,
        // athletes
        athletes, saveAthlete, deleteAthlete,
        // discounts
        discountCodes, saveDiscountCode, deleteDiscountCode,
        validateDiscountCode, applyDiscountCode,
        // commissions
        commission, saveCommission,
        // registrations
        registrations,
        getRegistrations, getRegistrationsByEvent, getRegistrationsByRace,
        updatePaymentStatus, updateCertStatus, updateRegistration, deleteRegistration,
        // results
        saveResults, getResults,
        // users
        users, saveUser, deleteUser,
    };
}
