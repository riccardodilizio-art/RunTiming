import { useState, useMemo, useSyncExternalStore } from 'react';
import { mockEvents } from '../data/mockEvents';
import type {
    Event, Athlete, DiscountCode, CommissionConfig, RegistrationSubmission, AppUser, PaymentStatus, CertStatus, Result,
} from '../types';

// ─── Events ───────────────────────────────────────────────────────────────────

const LS_KEY = 'rt_admin_events';

function load(): Event[] {
    try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : []; }
    catch { return []; }
}
function persist(events: Event[]) { localStorage.setItem(LS_KEY, JSON.stringify(events)); }

// ─── Athletes ─────────────────────────────────────────────────────────────────

const LS_ATHLETES_KEY = 'rt_athletes';

function loadAthletes(): Athlete[] {
    try { const raw = localStorage.getItem(LS_ATHLETES_KEY); return raw ? JSON.parse(raw) : []; }
    catch { return []; }
}
function persistAthletes(a: Athlete[]) { localStorage.setItem(LS_ATHLETES_KEY, JSON.stringify(a)); }

// ─── Discount codes ───────────────────────────────────────────────────────────

const LS_DISCOUNTS_KEY = 'rt_discount_codes';

function loadDiscounts(): DiscountCode[] {
    try { const raw = localStorage.getItem(LS_DISCOUNTS_KEY); return raw ? JSON.parse(raw) : []; }
    catch { return []; }
}
function persistDiscounts(d: DiscountCode[]) { localStorage.setItem(LS_DISCOUNTS_KEY, JSON.stringify(d)); }

// ─── Commission ───────────────────────────────────────────────────────────────

const LS_COMMISSION_KEY = 'rt_commission';
const DEFAULT_COMMISSION: CommissionConfig = { fixedFee: 0, percentFee: 0, appliedTo: 'buyer' };

function loadCommission(): CommissionConfig {
    try {
        const raw = localStorage.getItem(LS_COMMISSION_KEY);
        return raw ? JSON.parse(raw) : DEFAULT_COMMISSION;
    } catch { return DEFAULT_COMMISSION; }
}
function persistCommission(c: CommissionConfig) { localStorage.setItem(LS_COMMISSION_KEY, JSON.stringify(c)); }

// ─── Registrations (shared store) ───────────────────────────────────────────────
//
// A tiny module-level store backed by localStorage. Unlike per-component
// `useState`, this is shared across every `useAdminStore()` consumer and
// notifies subscribers on every mutation, so the UI stays in sync without
// manual re-read hacks. (When the backend lands, swap the LS calls for fetch.)

const LS_REG_KEY = 'rt_registrations';

function readRegistrationsFromLS(): RegistrationSubmission[] {
    try { const raw = localStorage.getItem(LS_REG_KEY); return raw ? JSON.parse(raw) : []; }
    catch { return []; }
}

let registrationsCache: RegistrationSubmission[] | null = null;
const regListeners = new Set<() => void>();

function getRegistrationsSnapshot(): RegistrationSubmission[] {
    if (registrationsCache === null) registrationsCache = readRegistrationsFromLS();
    return registrationsCache;
}

function subscribeRegistrations(cb: () => void): () => void {
    regListeners.add(cb);
    return () => { regListeners.delete(cb); };
}

/** Replace the registration list, persist it, and notify all subscribers. */
function commitRegistrations(list: RegistrationSubmission[]) {
    registrationsCache = list;
    try { localStorage.setItem(LS_REG_KEY, JSON.stringify(list)); } catch { /* ignore */ }
    regListeners.forEach(l => l());
}

/** Read the current registrations (kept for non-reactive call sites). */
export function loadRegistrations(): RegistrationSubmission[] {
    return getRegistrationsSnapshot();
}

export function saveRegistration(sub: RegistrationSubmission) {
    commitRegistrations([...getRegistrationsSnapshot(), sub]);
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
    const list = getRegistrationsSnapshot().map(r => {
        if (r.athleteAccountId !== athleteAccountId) return r;
        if (r.certStatus === 'non_richiesto' || r.certStatus === undefined) return r;
        return { ...r, certStatus, certRejectionReason };
    });
    commitRegistrations(list);
}

// ─── Users (organizers) ───────────────────────────────────────────────────────

const LS_USERS_KEY = 'rt_users';

export function loadUsers(): AppUser[] {
    try { const raw = localStorage.getItem(LS_USERS_KEY); return raw ? JSON.parse(raw) : []; }
    catch { return []; }
}

function persistUsers(u: AppUser[]) { localStorage.setItem(LS_USERS_KEY, JSON.stringify(u)); }

// ─── Results ──────────────────────────────────────────────────────────────────

const LS_RESULTS_KEY = 'rt_results';

export function loadResults(): Record<string, Result[]> {
    try { const raw = localStorage.getItem(LS_RESULTS_KEY); return raw ? JSON.parse(raw) : {}; }
    catch { return {}; }
}

function persistResults(r: Record<string, Result[]>) {
    localStorage.setItem(LS_RESULTS_KEY, JSON.stringify(r));
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAdminStore() {
    // Events
    const [overrides, setOverrides] = useState<Event[]>(() => load());

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
        setOverrides(next);
        persist(next);
    }

    function deleteEvent(id: string) {
        const next = overrides.filter(e => e.id !== id);
        setOverrides(next);
        persist(next);
    }

    function getEvent(slug: string): Event | undefined {
        return events.find(e => e.slug === slug);
    }

    // Athletes
    const [athletes, setAthletes] = useState<Athlete[]>(() => loadAthletes());

    function saveAthlete(athlete: Athlete) {
        const next = [...athletes];
        const idx = next.findIndex(a => a.id === athlete.id);
        if (idx >= 0) next[idx] = athlete; else next.push(athlete);
        setAthletes(next);
        persistAthletes(next);
    }

    function deleteAthlete(id: string) {
        const next = athletes.filter(a => a.id !== id);
        setAthletes(next);
        persistAthletes(next);
    }

    // Discount codes
    const [discountCodes, setDiscountCodes] = useState<DiscountCode[]>(() => loadDiscounts());

    function saveDiscountCode(code: DiscountCode) {
        const next = [...discountCodes];
        const idx = next.findIndex(c => c.id === code.id);
        if (idx >= 0) next[idx] = code; else next.push(code);
        setDiscountCodes(next);
        persistDiscounts(next);
    }

    function deleteDiscountCode(id: string) {
        const next = discountCodes.filter(c => c.id !== id);
        setDiscountCodes(next);
        persistDiscounts(next);
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
        const next = discountCodes.map(c =>
            c.id === codeId ? { ...c, usedCount: c.usedCount + 1 } : c
        );
        setDiscountCodes(next);
        persistDiscounts(next);
    }

    // Commission
    const [commission, setCommission] = useState<CommissionConfig>(() => loadCommission());

    function saveCommission(c: CommissionConfig) {
        setCommission(c);
        persistCommission(c);
    }

    // Registrations (reactive — re-renders on any mutation, anywhere)
    const registrations = useSyncExternalStore(subscribeRegistrations, getRegistrationsSnapshot);

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
        commitRegistrations(registrations.map(r =>
            r.id === registrationId ? { ...r, paymentStatus: status } : r
        ));
    }

    function deleteRegistration(registrationId: string) {
        commitRegistrations(registrations.filter(r => r.id !== registrationId));
    }

    function updateRegistration(id: string, updates: Partial<RegistrationSubmission>) {
        commitRegistrations(registrations.map(r => r.id === id ? { ...r, ...updates } : r));
    }

    function updateCertStatus(registrationId: string, status: CertStatus, rejectionReason?: string) {
        commitRegistrations(registrations.map(r =>
            r.id === registrationId
                ? { ...r, certStatus: status, certRejectionReason: rejectionReason ?? r.certRejectionReason }
                : r
        ));
    }

    // Results
    const [resultsMap, setResultsMap] = useState<Record<string, Result[]>>(() => loadResults());

    function saveResults(raceId: string, results: Result[]) {
        const next = { ...resultsMap, [raceId]: results };
        setResultsMap(next);
        persistResults(next);
    }

    function getResults(raceId: string): Result[] {
        return resultsMap[raceId] ?? [];
    }

    // Users (organizers)
    const [users, setUsers] = useState<AppUser[]>(() => loadUsers());

    function saveUser(user: AppUser) {
        const next = [...users];
        const idx = next.findIndex(u => u.id === user.id);
        if (idx >= 0) next[idx] = user; else next.push(user);
        setUsers(next);
        persistUsers(next);
    }

    function deleteUser(id: string) {
        const next = users.filter(u => u.id !== id);
        setUsers(next);
        persistUsers(next);
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
