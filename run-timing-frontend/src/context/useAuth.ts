import { createContext, useContext } from 'react';
import type { AppUser, UserRole } from '../types';

export interface AuthContextValue {
    currentUser: AppUser | null;
    isAdmin: boolean;
    isOrganizer: boolean;
    login: (username: string, password: string, users: AppUser[]) => AppUser | null;
    logout: () => void;
    canManageEvent: (eventId: string) => boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
    return ctx;
}

export type { UserRole };
