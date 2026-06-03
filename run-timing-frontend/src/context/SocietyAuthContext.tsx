import { useState, useCallback, type ReactNode } from 'react';
import type { SocietyAccount } from '../types';
import { SocietyAuthContext, type SocietyRegisterData } from './useSocietyAuth';
import {
    loadSocietyAccounts, persistSocietyAccounts,
    loadSocietySession, persistSocietySession,
} from './societyAccounts';

export function SocietyAuthProvider({ children }: { children: ReactNode }) {
    const [currentSociety, setCurrentSociety] = useState<SocietyAccount | null>(() => loadSocietySession());

    const login = useCallback((email: string, password: string): SocietyAccount | null => {
        const found = loadSocietyAccounts().find(
            a => a.email.toLowerCase() === email.toLowerCase() && a.password === password
        );
        if (!found) return null;
        setCurrentSociety(found);
        persistSocietySession(found);
        return found;
    }, []);

    const register = useCallback((data: SocietyRegisterData): SocietyAccount | { error: string } => {
        const accounts = loadSocietyAccounts();
        if (accounts.some(a => a.email.toLowerCase() === data.email.toLowerCase())) {
            return { error: 'Email già registrata. Prova ad accedere.' };
        }
        const newAccount: SocietyAccount = {
            ...data,
            roster: data.roster ?? [],
            id: `soc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            createdAt: new Date().toISOString(),
        };
        persistSocietyAccounts([...accounts, newAccount]);
        setCurrentSociety(newAccount);
        persistSocietySession(newAccount);
        return newAccount;
    }, []);

    const logout = useCallback(() => {
        setCurrentSociety(null);
        persistSocietySession(null);
    }, []);

    const updateSociety = useCallback((data: Partial<SocietyAccount>) => {
        setCurrentSociety(prev => {
            if (!prev) return prev;
            const updated = { ...prev, ...data };
            const accounts = loadSocietyAccounts().map(a => a.id === updated.id ? updated : a);
            persistSocietyAccounts(accounts);
            persistSocietySession(updated);
            return updated;
        });
    }, []);

    return (
        <SocietyAuthContext.Provider value={{ currentSociety, login, register, logout, updateSociety }}>
            {children}
        </SocietyAuthContext.Provider>
    );
}
