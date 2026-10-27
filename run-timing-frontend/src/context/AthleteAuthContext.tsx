import { useState, useCallback, useEffect, type ReactNode } from 'react';
import type { AthleteAccount } from '../types';
import { AthleteAuthContext } from './useAthleteAuth';
import {
    loadAthleteAccounts, persistAccounts,
    loadAthleteSession, persistAthleteSession,
} from './athleteAccounts';
import { USE_API, setAuthToken, tokenRole } from '../lib/api';
import { fetchAthlete, loginAthleteApi, registerAthleteApi, saveAthleteApi } from '../lib/accounts';

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Operazione non riuscita');

/** Con il backend la sessione salvata vale solo se c'è ancora un token atleta. */
function initialSession(): AthleteAccount | null {
    if (USE_API && tokenRole() !== 'ATHLETE') return null;
    return loadAthleteSession();
}

export function AthleteAuthProvider({ children }: { children: ReactNode }) {
    const [currentAthlete, setCurrentAthlete] = useState<AthleteAccount | null>(initialSession);

    const setSession = useCallback((a: AthleteAccount | null) => {
        setCurrentAthlete(a);
        persistAthleteSession(a);
    }, []);

    // Con il backend: all'avvio riallinea il profilo (es. certificato verificato dall'admin)
    useEffect(() => {
        if (!USE_API || tokenRole() !== 'ATHLETE') return;
        fetchAthlete().then(setSession).catch(() => setSession(null));
    }, [setSession]);

    const login = useCallback(async (email: string, password: string): Promise<AthleteAccount | null> => {
        if (USE_API) {
            const a = await loginAthleteApi(email, password).catch(() => null);
            if (a) setSession(a);
            return a;
        }
        const found = loadAthleteAccounts().find(
            a => a.email.toLowerCase() === email.toLowerCase() && a.password === password
        );
        if (!found) return null;
        setSession(found);
        return found;
    }, [setSession]);

    const register = useCallback(
        async (data: Omit<AthleteAccount, 'id' | 'createdAt'>): Promise<AthleteAccount | { error: string }> => {
            if (USE_API) {
                try {
                    const a = await registerAthleteApi(data);
                    setSession(a);
                    return a;
                } catch (e) {
                    return { error: errMsg(e) };
                }
            }
            const accounts = loadAthleteAccounts();
            if (accounts.some(a => a.email.toLowerCase() === data.email.toLowerCase())) {
                return { error: 'Email già registrata. Prova ad accedere.' };
            }
            const newAccount: AthleteAccount = {
                ...data,
                id: `ath_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                createdAt: new Date().toISOString(),
            };
            persistAccounts([...accounts, newAccount]);
            setSession(newAccount);
            return newAccount;
        },
        [setSession]
    );

    const logout = useCallback(() => {
        setSession(null);
        if (USE_API) setAuthToken(null);
    }, [setSession]);

    const updateProfile = useCallback(async (data: Partial<AthleteAccount>): Promise<string | null> => {
        if (!currentAthlete) return 'Accesso richiesto';
        const updated = { ...currentAthlete, ...data };
        if (USE_API) {
            try {
                setSession(await saveAthleteApi(updated));
                return null;
            } catch (e) {
                return errMsg(e);
            }
        }
        const accounts = loadAthleteAccounts().map(a => a.id === updated.id ? updated : a);
        persistAccounts(accounts);
        setSession(updated);
        return null;
    }, [currentAthlete, setSession]);

    return (
        <AthleteAuthContext.Provider value={{ currentAthlete, login, register, logout, updateProfile }}>
            {children}
        </AthleteAuthContext.Provider>
    );
}
