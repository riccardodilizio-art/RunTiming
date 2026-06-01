import { useState, useCallback, type ReactNode } from 'react';
import type { AthleteAccount } from '../types';
import { AthleteAuthContext } from './useAthleteAuth';
import {
    loadAthleteAccounts, persistAccounts,
    loadAthleteSession, persistAthleteSession,
} from './athleteAccounts';

export function AthleteAuthProvider({ children }: { children: ReactNode }) {
    const [currentAthlete, setCurrentAthlete] = useState<AthleteAccount | null>(() => loadAthleteSession());

    const login = useCallback((email: string, password: string): AthleteAccount | null => {
        const accounts = loadAthleteAccounts();
        const found = accounts.find(
            a => a.email.toLowerCase() === email.toLowerCase() && a.password === password
        );
        if (!found) return null;
        setCurrentAthlete(found);
        persistAthleteSession(found);
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
            persistAthleteSession(newAccount);
            return newAccount;
        },
        []
    );

    const logout = useCallback(() => {
        setCurrentAthlete(null);
        persistAthleteSession(null);
    }, []);

    const updateProfile = useCallback((data: Partial<AthleteAccount>) => {
        setCurrentAthlete(prev => {
            if (!prev) return prev;
            const updated = { ...prev, ...data };
            const accounts = loadAthleteAccounts().map(a => a.id === updated.id ? updated : a);
            persistAccounts(accounts);
            persistAthleteSession(updated);
            return updated;
        });
    }, []);

    return (
        <AthleteAuthContext.Provider value={{ currentAthlete, login, register, logout, updateProfile }}>
            {children}
        </AthleteAuthContext.Provider>
    );
}
