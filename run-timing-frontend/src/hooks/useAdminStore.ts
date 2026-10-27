import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { mockEvents } from '../data/mockEvents';
import { USE_API, api, tokenRole } from '../lib/api';
import {
    type ApiEvent, type ApiRegistration, type Paged,
    fromEvent, toApiCert, toApiPayment, toEvent, toRegistration,
} from '../lib/adapters';
import { eventDays, allRaces } from '../utils/event';
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

function createLocalStore<T>(key: string, fallback: T, persist = true): LocalStore<T> {
    let cache: T;
    let loaded = !persist;
    if (!persist) cache = fallback;
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
        if (persist) { try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* ignore */ } }
        listeners.forEach(l => l());
    }

    function subscribe(cb: () => void): () => void {
        listeners.add(cb);
        return () => { listeners.delete(cb); };
    }

    return { getSnapshot, subscribe, set };
}

const DEFAULT_COMMISSION: CommissionConfig = { fixedFee: 0, percentFee: 0, appliedTo: 'buyer' };

// Con il backend (USE_API) questi store sono solo una cache in memoria dei dati
// del server: niente localStorage, la fonte di verità è il database.
const LOCAL = !USE_API;
const eventsStore        = createLocalStore<Event[]>('rt_admin_events', [], LOCAL);
const athletesStore      = createLocalStore<Athlete[]>('rt_athletes', []);
const discountsStore     = createLocalStore<DiscountCode[]>('rt_discount_codes', [], LOCAL);
const commissionStore    = createLocalStore<CommissionConfig>('rt_commission', DEFAULT_COMMISSION, LOCAL);
const registrationsStore = createLocalStore<RegistrationSubmission[]>('rt_registrations', [], LOCAL);
const resultsStore       = createLocalStore<Record<string, Result[]>>('rt_results', {}, LOCAL);

/** Stato della classifica per gara (solo backend): live = provvisoria dal semi-live, final = ufficiale. */
export interface ResultsMeta { status: 'live' | 'final' | null; updatedAt: string | null; source?: string }
const resultsMetaStore   = createLocalStore<Record<string, ResultsMeta>>('rt_results_meta', {}, false);
const usersStore         = createLocalStore<AppUser[]>('rt_users', []);

// ─── Sincronizzazione con il backend (solo USE_API) ──────────────────────────

/** Eventi di cui abbiamo il dettaglio completo (moduli, quote, categorie). */
const fullEvents = new Set<string>();
/** Richieste in corso, per non ripetere la stessa chiamata. */
const inflight = new Map<string, Promise<unknown>>();

function once<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const running = inflight.get(key) as Promise<T> | undefined;
    if (running) return running;
    const p = fn().finally(() => inflight.delete(key));
    inflight.set(key, p);
    return p;
}

/** Mostra l'errore del server all'utente (es. "Gara al completo"). */
export function reportApiError(e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(e);
    window.alert(msg);
}

/** True se abbiamo il dettaglio completo dell'evento (sempre vero senza backend). */
export function isEventFull(id: string): boolean {
    return !USE_API || fullEvents.has(id);
}

function upsertEvent(ev: Event, full: boolean) {
    if (full) fullEvents.add(ev.id); // prima di notificare, così i componenti lo vedono già
    const list = eventsStore.getSnapshot();
    const idx = list.findIndex(e => e.id === ev.id);
    const next = [...list];
    if (idx >= 0) next[idx] = ev; else next.push(ev);
    eventsStore.set(next);
}

/** Calendario completo (versione leggera di ogni evento). */
export function refreshEventsApi(): Promise<void> {
    return once('events', async () => {
        const all: Event[] = [];
        for (let page = 1; ; page++) {
            const r = await api.get<Paged<ApiEvent>>(`/events?when=all&pageSize=100&page=${page}`);
            all.push(...r.items.map(toEvent));
            if (page * r.pageSize >= r.total) break;
        }
        // Mantieni il dettaglio già scaricato degli eventi completi
        const current = new Map(eventsStore.getSnapshot().map(e => [e.id, e]));
        eventsStore.set(all.map(e => (fullEvents.has(e.id) ? current.get(e.id) ?? e : e)));
    });
}

/** Dettaglio completo di un evento (serve a pagina evento, iscrizione, editor). */
export function ensureEventApi(slug: string, force = false): Promise<void> {
    const known = eventsStore.getSnapshot().find(e => e.slug === slug);
    if (!force && known && fullEvents.has(known.id)) return Promise.resolve();
    return once(`event:${slug}`, async () => {
        const ev = toEvent(await api.get<ApiEvent>(`/events/${encodeURIComponent(slug)}`));
        upsertEvent(ev, true);
    });
}

function replaceRaceRegistrations(raceId: string, regs: RegistrationSubmission[]) {
    registrationsStore.set([
        ...registrationsStore.getSnapshot().filter(r => r.raceId !== raceId),
        ...regs,
    ]);
}

/** Staff: tutte le iscrizioni di una gara (anche rifiutate). */
export function loadRaceRegistrationsApi(raceId: string): Promise<void> {
    return once(`regs:${raceId}`, async () => {
        const all: RegistrationSubmission[] = [];
        for (let page = 1; ; page++) {
            const r = await api.get<Paged<ApiRegistration>>(`/races/${raceId}/registrations?pageSize=200&page=${page}`);
            all.push(...r.items.map(toRegistration));
            if (page * r.pageSize >= r.total) break;
        }
        replaceRaceRegistrations(raceId, all);
    });
}

/** Atleta / società: le proprie iscrizioni. */
export function loadMyRegistrationsApi(): Promise<void> {
    return once('regs:me', async () => {
        const mine = (await api.get<ApiRegistration[]>('/registrations/me')).map(toRegistration);
        const ids = new Set(mine.map(r => r.id));
        registrationsStore.set([...registrationsStore.getSnapshot().filter(r => !ids.has(r.id)), ...mine]);
    });
}

interface ApiEntrant {
    cognome: string;
    nome: string;
    societa?: string | null;
    categoria?: string | null;
    pagamento?: ApiRegistration['paymentStatus'];
    certificato?: ApiRegistration['certStatus'];
    campi?: Record<string, string | boolean | null>;
}

/**
 * Elenco iscritti pubblico: il backend espone solo nome, società e i campi
 * resi pubblici. Li ricostruiamo come "iscrizioni" sui campi del modulo, così
 * la pagina Iscritti funziona senza modifiche.
 */
export function loadEntrantsApi(event: Event): Promise<void> {
    return once(`entrants:${event.id}`, async () => {
        for (const race of allRaces(event)) {
            const fieldId = (key: string) => race.formSchema?.find(f => f.catalogKey === key)?.id ?? key;
            const regs: RegistrationSubmission[] = [];
            for (let page = 1; ; page++) {
                const r = await api.get<Paged<ApiEntrant>>(`/races/${race.id}/entrants?pageSize=100&page=${page}`);
                r.items.forEach((x, i) => {
                    const formData: Record<string, string | boolean> = {
                        [fieldId('cognome')]: x.cognome,
                        [fieldId('nome')]: x.nome,
                        [fieldId('societa')]: x.societa ?? '',
                    };
                    for (const [k, v] of Object.entries(x.campi ?? {})) if (v != null) formData[k] = v;
                    regs.push({
                        id: `pub_${race.id}_${(page - 1) * r.pageSize + i}`,
                        eventId: event.id,
                        raceId: race.id,
                        submittedAt: '',
                        formData,
                        pricePaid: 0,
                        paymentStatus: x.pagamento ? toRegistration({ paymentStatus: x.pagamento } as ApiRegistration).paymentStatus : 'confirmed',
                        assignedCategory: x.categoria ?? undefined,
                        certStatus: x.certificato ? toRegistration({ paymentStatus: 'PENDING', certStatus: x.certificato } as ApiRegistration).certStatus : undefined,
                    });
                });
                if (page * r.pageSize >= r.total) break;
            }
            replaceRaceRegistrations(race.id, regs);
        }
    });
}

const loadedResults = new Set<string>();

/** Classifica pubblica di una gara. `force` per gli aggiornamenti durante la gara (live). */
export function loadResultsApi(raceId: string, force = false): Promise<void> {
    if (!force && loadedResults.has(raceId)) return Promise.resolve();
    loadedResults.add(raceId);
    return once(`results:${raceId}`, async () => {
        const r = await api.get<ResultsMeta & { results: Result[] }>(`/races/${raceId}/results`);
        resultsStore.set({ ...resultsStore.getSnapshot(), [raceId]: r.results });
        resultsMetaStore.set({ ...resultsMetaStore.getSnapshot(), [raceId]: { status: r.status, updatedAt: r.updatedAt, source: r.source } });
    });
}

/** Admin: genera la chiave del programma semi-live per una gara (la precedente smette di valere). */
export function createSyncKeyApi(raceId: string): Promise<{ raceId: string; syncKey: string }> {
    return api.post(`/races/${raceId}/sync-key`);
}

async function loadCommissionApi() {
    commissionStore.set(await api.get<CommissionConfig>('/settings/commission'));
}

interface ApiDiscount extends Omit<DiscountCode, 'expiresAt' | 'maxUses' | 'description' | 'type'> {
    type: DiscountCode['type'];
    description?: string | null;
    maxUses?: number | null;
    expiresAt?: string | null;
}
const toDiscount = (d: ApiDiscount): DiscountCode => ({
    ...d,
    description: d.description ?? undefined,
    maxUses: d.maxUses ?? undefined,
    expiresAt: d.expiresAt ? d.expiresAt.slice(0, 10) : undefined,
});

/** Admin: elenco codici sconto. */
export function loadDiscountsApi(): Promise<void> {
    return once('discounts', async () => {
        discountsStore.set((await api.get<ApiDiscount[]>('/discounts')).map(toDiscount));
    });
}

/** Verifica pubblica di un codice sconto (il prezzo finale lo calcola comunque il server). */
export async function checkDiscountApi(code: string): Promise<DiscountCode | null> {
    const r = await api.get<{ valid: boolean; code?: string; type?: DiscountCode['type']; value?: number; description?: string }>(
        `/discounts/check/${encodeURIComponent(code)}`,
    );
    if (!r.valid || !r.code || !r.type) return null;
    return { id: r.code, code: r.code, type: r.type, value: r.value ?? 0, description: r.description, usedCount: 0, isActive: true };
}

let bootstrapped = false;
function bootstrapApi() {
    if (bootstrapped || !USE_API) return;
    bootstrapped = true;
    refreshEventsApi().catch(reportApiError);
    loadCommissionApi().catch(() => { /* default: nessuna commissione */ });
}

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
    const resultsMeta   = useSyncExternalStore(resultsMetaStore.subscribe, resultsMetaStore.getSnapshot);
    const users         = useSyncExternalStore(usersStore.subscribe, usersStore.getSnapshot);

    useEffect(bootstrapApi, []);

    // Events: dal backend (USE_API) oppure mock + modifiche salvate in locale.
    const events = useMemo<Event[]>(() => {
        if (USE_API) return overrides;
        const merged: Event[] = [...mockEvents];
        for (const ov of overrides) {
            const idx = merged.findIndex(e => e.id === ov.id);
            if (idx >= 0) merged[idx] = ov;
            else merged.push(ov);
        }
        return merged;
    }, [overrides]);

    /**
     * Salva l'evento. Con il backend restituisce l'evento salvato (con gli id
     * definitivi del server), oppure null se il server rifiuta (errore mostrato).
     * L'organizzatore può salvare solo le informazioni generali.
     */
    async function saveEvent(event: Event): Promise<Event | null> {
        if (!USE_API) {
            const next = [...overrides];
            const idx = next.findIndex(e => e.id === event.id);
            if (idx >= 0) next[idx] = event; else next.push(event);
            eventsStore.set(next);
            return event;
        }
        try {
            const body = fromEvent(event, eventDays(event));
            const exists = overrides.some(e => e.id === event.id);
            let saved: ApiEvent;
            if (!exists) saved = await api.post<ApiEvent>('/events', body);
            else if (tokenRole() === 'ORGANIZER') {
                const info = {
                    title: body.title, category: body.category, location: body.location, city: body.city,
                    province: body.province, lat: body.lat, lng: body.lng, coverImage: body.coverImage,
                    flyerUrl: body.flyerUrl, regulationUrl: body.regulationUrl, description: body.description,
                    organizer: body.organizer, routeInfo: body.routeInfo,
                };
                saved = await api.patch<ApiEvent>(`/events/${event.id}/info`, info);
            } else saved = await api.put<ApiEvent>(`/events/${event.id}`, body);
            const ev = toEvent(saved);
            upsertEvent(ev, true);
            return ev;
        } catch (e) {
            reportApiError(e);
            return null;
        }
    }

    async function deleteEvent(id: string) {
        if (USE_API) {
            try { await api.del(`/events/${id}`); }
            catch (e) { reportApiError(e); return; }
        }
        eventsStore.set(eventsStore.getSnapshot().filter(e => e.id !== id));
    }

    function getEvent(slug: string): Event | undefined {
        // Con il backend il calendario ha solo i dati essenziali: il dettaglio
        // completo si scarica alla prima richiesta (poi la pagina si aggiorna da sola).
        if (USE_API) ensureEventApi(slug).catch(() => { /* evento inesistente: la pagina mostra "non trovato" */ });
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
    async function saveDiscountCode(code: DiscountCode) {
        if (USE_API) {
            const body = {
                description: code.description || undefined,
                type: code.type,
                value: Number(code.value) || 0,
                maxUses: code.maxUses || undefined,
                expiresAt: code.expiresAt || undefined,
                isActive: code.isActive,
            };
            try {
                const exists = discountCodes.some(c => c.id === code.id);
                const saved = exists
                    ? await api.patch<ApiDiscount>(`/discounts/${code.id}`, body)
                    : await api.post<ApiDiscount>('/discounts', { ...body, code: code.code });
                const d = toDiscount(saved);
                discountsStore.set([...discountsStore.getSnapshot().filter(c => c.id !== code.id && c.id !== d.id), d]);
            } catch (e) { reportApiError(e); }
            return;
        }
        const next = [...discountCodes];
        const idx = next.findIndex(c => c.id === code.id);
        if (idx >= 0) next[idx] = code; else next.push(code);
        discountsStore.set(next);
    }

    async function deleteDiscountCode(id: string) {
        if (USE_API) {
            try { await api.del(`/discounts/${id}`); }
            catch (e) { reportApiError(e); return; }
        }
        discountsStore.set(discountsStore.getSnapshot().filter(c => c.id !== id));
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

    /** Incrementa il contatore utilizzi di un codice sconto (con il backend lo fa il server) */
    function applyDiscountCode(codeId: string) {
        if (USE_API) return;
        discountsStore.set(discountCodes.map(c =>
            c.id === codeId ? { ...c, usedCount: c.usedCount + 1 } : c
        ));
    }

    // Commission
    async function saveCommission(c: CommissionConfig) {
        if (USE_API) {
            try { commissionStore.set(await api.put<CommissionConfig>('/settings/commission', c)); }
            catch (e) { reportApiError(e); }
            return;
        }
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

    async function updatePaymentStatus(registrationId: string, status: PaymentStatus) {
        if (USE_API) {
            try { await api.patch(`/registrations/${registrationId}/payment`, { paymentStatus: toApiPayment(status) }); }
            catch (e) { reportApiError(e); return; }
        }
        registrationsStore.set(registrationsStore.getSnapshot().map(r =>
            r.id === registrationId ? { ...r, paymentStatus: status } : r
        ));
    }

    /** Con il backend un'iscrizione non si cancella: viene segnata come rifiutata (resta lo storico). */
    async function deleteRegistration(registrationId: string) {
        if (USE_API) return updatePaymentStatus(registrationId, 'rejected');
        registrationsStore.set(registrations.filter(r => r.id !== registrationId));
    }

    function updateRegistration(id: string, updates: Partial<RegistrationSubmission>) {
        if (USE_API) {
            window.alert('Modifica dei dati di iscrizione non ancora disponibile con il backend.');
            return;
        }
        registrationsStore.set(registrations.map(r => r.id === id ? { ...r, ...updates } : r));
    }

    async function updateCertStatus(registrationId: string, status: CertStatus, rejectionReason?: string) {
        if (USE_API) {
            try { await api.patch(`/registrations/${registrationId}/cert`, { certStatus: toApiCert(status) }); }
            catch (e) { reportApiError(e); return; }
        }
        registrationsStore.set(registrationsStore.getSnapshot().map(r =>
            r.id === registrationId
                ? { ...r, certStatus: status, certRejectionReason: rejectionReason ?? r.certRejectionReason }
                : r
        ));
    }

    // Results
    /** Pubblica la classifica (con il backend come UFFICIALE: il semi-live non la sovrascrive più). */
    async function saveResults(raceId: string, results: Result[]): Promise<boolean> {
        if (USE_API) {
            try {
                await api.put(`/races/${raceId}/results`, { status: 'final', results });
            } catch (e) { reportApiError(e); return false; }
            resultsMetaStore.set({ ...resultsMetaStore.getSnapshot(), [raceId]: { status: 'final', updatedAt: new Date().toISOString(), source: 'upload' } });
        }
        resultsStore.set({ ...resultsStore.getSnapshot(), [raceId]: results });
        return true;
    }

    function getResults(raceId: string): Result[] {
        if (USE_API) loadResultsApi(raceId).catch(() => { /* gara senza classifica */ });
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
        saveResults, getResults, resultsMeta,
        // users
        users, saveUser, deleteUser,
    };
}
