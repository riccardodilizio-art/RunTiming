import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { AthleteAccount } from '../types';

// ─── localStorage helpers ─────────────────────────────────────────────────────

const LS_ACCOUNTS_KEY = 'rt_athlete_accounts';
const LS_SESSION_KEY  = 'rt_athlete_session';

export function loadAthleteAccounts(): AthleteAccount[] {
    try { const r = localStorage.getItem(LS_ACCOUNTS_KEY); return r ? JSON.parse(r) : []; }
    catch { return []; }
}

function persistAccounts(list: AthleteAccount[]) {
    localStorage.setItem(LS_ACCOUNTS_KEY, JSON.stringify(list));
}

/** Admin-side: aggiorna un account atleta senza richiedere il contesto React */
export function updateAthleteAccount(id: string, updates: Partial<AthleteAccount>) {
    const list = loadAthleteAccounts().map(a => a.id === id ? { ...a, ...updates } : a);
    persistAccounts(list);
}

function loadSession(): AthleteAccount | null {
    try { const r = localStorage.getItem(LS_SESSION_KEY); return r ? JSON.parse(r) : null; }
    catch { return null; }
}

function persistSession(a: AthleteAccount | null) {
    if (a) localStorage.setItem(LS_SESSION_KEY, JSON.stringify(a));
    else    localStorage.removeItem(LS_SESSION_KEY);
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface AthleteAuthContextValue {
    currentAthlete: AthleteAccount | null;
    login:    (email: string, password: string) => AthleteAccount | null;
    register: (data: Omit<AthleteAccount, 'id' | 'createdAt'>) => AthleteAccount | { error: string };
    logout:   () => void;
    updateProfile: (data: Partial<AthleteAccount>) => void;
}

const AthleteAuthContext = createContext<AthleteAuthContextValue | null>(null);

export function AthleteAuthProvider({ children }: { children: ReactNode }) {
    const [currentAthlete, setCurrentAthlete] = useState<AthleteAccount | null>(() => loadSession());

    const login = useCallback((email: string, password: string): AthleteAccount | null => {
        const accounts = loadAthleteAccounts();
        const found = accounts.find(
            a => a.email.toLowerCase() === email.toLowerCase() && a.password === password
        );
        if (!found) return null;
        setCurrentAthlete(found);
        persistSession(found);
        return found;
    }, []);

    const register = useCallback(
        (data: Omit<AthleteAccount, 'id' | 'createdAt'>): AthleteAccount | { error: string } => {
            const accounts = loadAthleteAccounts();
            if (accounts.some(a => a.email.toLowerCase() === data.email.toLowerCase())) {
                return { error: 'Email già registrata. Prova ad accedere.' };
            }
            const newAccount: AthleteAccount = {
                ...data,
                id: `ath_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                createdAt: new Date().toISOString(),
            };
            const updated = [...accounts, newAccount];
            persistAccounts(updated);
            setCurrentAthlete(newAccount);
            persistSession(newAccount);
            return newAccount;
        },
        []
    );

    const logout = useCallback(() => {
        setCurrentAthlete(null);
        persistSession(null);
    }, []);

    const updateProfile = useCallback((data: Partial<AthleteAccount>) => {
        setCurrentAthlete(prev => {
            if (!prev) return prev;
            const updated = { ...prev, ...data };
            const accounts = loadAthleteAccounts().map(a => a.id === updated.id ? updated : a);
            persistAccounts(accounts);
            persistSession(updated);
            return updated;
        });
    }, []);

    return (
        <AthleteAuthContext.Provider value={{ currentAthlete, login, register, logout, updateProfile }}>
            {children}
        </AthleteAuthContext.Provider>
    );
}

export function useAthleteAuth(): AthleteAuthContextValue {
    const ctx = useContext(AthleteAuthContext);
    if (!ctx) throw new Error('useAthleteAuth must be used inside AthleteAuthProvider');
    return ctx;
}
