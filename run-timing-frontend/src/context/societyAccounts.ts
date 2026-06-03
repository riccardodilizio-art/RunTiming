import type { SocietyAccount } from '../types';

// ─── Society accounts storage (localStorage) ────────────────────────────────────

const LS_ACCOUNTS_KEY = 'rt_society_accounts';
const LS_SESSION_KEY  = 'rt_society_session';

export function loadSocietyAccounts(): SocietyAccount[] {
    try { const r = localStorage.getItem(LS_ACCOUNTS_KEY); return r ? JSON.parse(r) : []; }
    catch { return []; }
}

export function persistSocietyAccounts(list: SocietyAccount[]) {
    localStorage.setItem(LS_ACCOUNTS_KEY, JSON.stringify(list));
}

export function updateSocietyAccount(id: string, updates: Partial<SocietyAccount>) {
    const list = loadSocietyAccounts().map(a => a.id === id ? { ...a, ...updates } : a);
    persistSocietyAccounts(list);
}

export function loadSocietySession(): SocietyAccount | null {
    try { const r = localStorage.getItem(LS_SESSION_KEY); return r ? JSON.parse(r) : null; }
    catch { return null; }
}

export function persistSocietySession(a: SocietyAccount | null) {
    if (a) localStorage.setItem(LS_SESSION_KEY, JSON.stringify(a));
    else    localStorage.removeItem(LS_SESSION_KEY);
}
