import { useState, useCallback, useEffect, type ReactNode } from 'react';
import type { AppUser } from '../types';
import { AuthContext } from './useAuth';
import { announceLogin, onExclusiveLogin } from './authBus';

// ─── Default admin user (always exists) ──────────────────────────────────────

const DEFAULT_ADMIN: AppUser = {
    id: 'admin',
    username: 'admin',
    password: 'admin123',
    displayName: 'Amministratore',
    role: 'admin',
    assignedEventIds: [],
    isActive: true,
};

// ─── LS helpers ───────────────────────────────────────────────────────────────

const LS_SESSION_KEY = 'rt_session';

function loadSession(): AppUser | null {
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

    const login = useCallback((username: string, password: string, users: AppUser[]): AppUser | null => {
        // always check default admin first
        const allUsers = [DEFAULT_ADMIN, ...users.filter(u => u.id !== 'admin')];
        const found = allUsers.find(
            u => u.username === username && u.password === password && u.isActive
        );
        if (!found) return null;
        setCurrentUser(found);
        persistSession(found);
        announceLogin('admin');
        return found;
    }, []);

    const logout = useCallback(() => {
        setCurrentUser(null);
        persistSession(null);
    }, []);

    // Disconnette l'admin se si accede con un'altra identità.
    useEffect(() => onExclusiveLogin('admin', logout), [logout]);

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
