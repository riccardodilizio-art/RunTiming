import type { AthleteAccount } from '../types';

// ─── Athlete accounts storage (localStorage) ────────────────────────────────────

const LS_ACCOUNTS_KEY = 'rt_athlete_accounts';
const LS_SESSION_KEY  = 'rt_athlete_session';

export function loadAthleteAccounts(): AthleteAccount[] {
    try { const r = localStorage.getItem(LS_ACCOUNTS_KEY); return r ? JSON.parse(r) : []; }
    catch { return []; }
}

export function persistAccounts(list: AthleteAccount[]) {
    localStorage.setItem(LS_ACCOUNTS_KEY, JSON.stringify(list));
}

/** Admin-side: aggiorna un account atleta senza richiedere il contesto React */
export function updateAthleteAccount(id: string, updates: Partial<AthleteAccount>) {
    const list = loadAthleteAccounts().map(a => a.id === id ? { ...a, ...updates } : a);
    persistAccounts(list);
}

export function loadAthleteSession(): AthleteAccount | null {
    try { const r = localStorage.getItem(LS_SESSION_KEY); return r ? JSON.parse(r) : null; }
    catch { return null; }
}

export function persistAthleteSession(a: AthleteAccount | null) {
    if (a) localStorage.setItem(LS_SESSION_KEY, JSON.stringify(a));
    else    localStorage.removeItem(LS_SESSION_KEY);
}
