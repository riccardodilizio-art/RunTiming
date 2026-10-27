import { useState, useCallback, type ReactNode } from 'react';
import type { AppUser } from '../types';
import { AuthContext } from './useAuth';
import { USE_API, api, setAuthToken, tokenRole } from '../lib/api';

// ─── Admin della modalità dimostrativa (senza backend) ───────────────────────
// Nessuna password nel codice: in modalità demo l'admin esiste solo se
// VITE_DEMO_ADMIN_USER e VITE_DEMO_ADMIN_PASSWORD sono impostate nel .env locale.
// Con il backend (VITE_USE_API=true) l'accesso è solo con gli account veri.

const DEMO_ADMIN: AppUser | null =
    import.meta.env.VITE_DEMO_ADMIN_USER && import.meta.env.VITE_DEMO_ADMIN_PASSWORD
        ? {
            id: 'admin',
            username: import.meta.env.VITE_DEMO_ADMIN_USER,
            password: import.meta.env.VITE_DEMO_ADMIN_PASSWORD,
            displayName: 'Amministratore',
            role: 'admin',
            assignedEventIds: [],
            isActive: true,
        }
        : null;

// ─── LS helpers ───────────────────────────────────────────────────────────────

const LS_SESSION_KEY = 'rt_session';

function loadSession(): AppUser | null {
    // Con il backend la sessione staff vale solo se c'è ancora un token staff
    if (USE_API && tokenRole() !== 'ADMIN' && tokenRole() !== 'ORGANIZER') return null;
    try {
        const raw = localStorage.getItem(LS_SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

function persistSession(user: AppUser | null) {
    if (user) localStorage.setItem(LS_SESSION_KEY, JSON.stringify(user));
    else localStorage.removeItem(LS_SESSION_KEY);
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
    const [currentUser, setCurrentUser] = useState<AppUser | null>(() => loadSession());

    const login = useCallback(async (username: string, password: string, users: AppUser[]): Promise<AppUser | null> => {
        if (USE_API) {
            try {
                const r = await api.post<{ accessToken: string; role: string }>('/auth/login', { email: username, password });
                if (r.role !== 'ADMIN' && r.role !== 'ORGANIZER') return null; // atleti e società hanno il loro accesso
                setAuthToken(r.accessToken);
                const me = await api.get<{ id: string; email: string; role: string; displayName?: string | null; assignedEventIds: string[] }>('/auth/me');
                const user: AppUser = {
                    id: me.id,
                    username: me.email,
                    password: '',
                    displayName: me.displayName || me.email,
                    role: me.role === 'ADMIN' ? 'admin' : 'organizer',
                    assignedEventIds: me.assignedEventIds,
                    isActive: true,
                };
                setCurrentUser(user);
                persistSession(user);
                return user;
            } catch {
                return null;
            }
        }
        const allUsers = [...(DEMO_ADMIN ? [DEMO_ADMIN] : []), ...users.filter(u => u.id !== 'admin')];
        const found = allUsers.find(
            u => u.username === username && u.password === password && u.isActive
        );
        if (!found) return null;
        setCurrentUser(found);
        persistSession(found);
        return found;
    }, []);

    const logout = useCallback(() => {
        setCurrentUser(null);
        persistSession(null);
        if (USE_API) setAuthToken(null);
    }, []);

    const canManageEvent = useCallback((eventId: string): boolean => {
        if (!currentUser) return false;
        if (currentUser.role === 'admin') return true;
        return currentUser.assignedEventIds.includes(eventId);
    }, [currentUser]);

    const isAdmin = currentUser?.role === 'admin';
    const isOrganizer = currentUser?.role === 'organizer';

    return (
        <AuthContext.Provider value={{ currentUser, isAdmin, isOrganizer, login, logout, canManageEvent }}>
            {children}
        </AuthContext.Provider>
    );
}
