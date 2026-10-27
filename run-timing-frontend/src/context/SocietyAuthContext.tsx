import { useState, useCallback, useEffect, type ReactNode } from 'react';
import type { SocietyAccount } from '../types';
import { SocietyAuthContext, type SocietyRegisterData } from './useSocietyAuth';
import { announceLogin, onExclusiveLogin } from './authBus';
import {
    loadSocietyAccounts, persistSocietyAccounts,
    loadSocietySession, persistSocietySession,
} from './societyAccounts';
import { USE_API, setAuthToken, tokenRole } from '../lib/api';
import { fetchSociety, loginSocietyApi, registerSocietyApi, saveSocietyApi } from '../lib/accounts';

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Operazione non riuscita');

function initialSession(): SocietyAccount | null {
    if (USE_API && tokenRole() !== 'SOCIETY') return null;
    return loadSocietySession();
}

export function SocietyAuthProvider({ children }: { children: ReactNode }) {
    const [currentSociety, setCurrentSociety] = useState<SocietyAccount | null>(initialSession);

    const setSession = useCallback((s: SocietyAccount | null) => {
        setCurrentSociety(s);
        persistSocietySession(s);
    }, []);

    useEffect(() => {
        if (!USE_API || tokenRole() !== 'SOCIETY') return;
        fetchSociety().then(setSession).catch(() => setSession(null));
    }, [setSession]);

    const login = useCallback(async (email: string, password: string): Promise<SocietyAccount | null> => {
        if (USE_API) {
            const s = await loginSocietyApi(email, password).catch(() => null);
            if (s) { setSession(s); announceLogin('society'); }
            return s;
        }
        const found = loadSocietyAccounts().find(
            a => a.email.toLowerCase() === email.toLowerCase() && a.password === password
        );
        if (!found) return null;
        setSession(found);
        announceLogin('society');
        return found;
    }, [setSession]);

    const register = useCallback(async (data: SocietyRegisterData): Promise<SocietyAccount | { error: string }> => {
        if (USE_API) {
            try {
                const s = await registerSocietyApi(data);
                setSession(s);
                announceLogin('society');
                return s;
            } catch (e) {
                return { error: errMsg(e) };
            }
        }
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
        setSession(newAccount);
        announceLogin('society');
        return newAccount;
    }, [setSession]);

    const logout = useCallback(() => {
        setSession(null);
        if (USE_API) setAuthToken(null);
    }, [setSession]);

    // Un'altra identità ha fatto login: chiude solo la sessione società locale.
    const dropSession = useCallback(() => setSession(null), [setSession]);
    useEffect(() => onExclusiveLogin('society', dropSession), [dropSession]);

    const updateSociety = useCallback(async (data: Partial<SocietyAccount>): Promise<string | null> => {
        if (!currentSociety) return 'Accesso richiesto';
        const updated = { ...currentSociety, ...data };
        if (USE_API) {
            try {
                setSession(await saveSocietyApi(updated));
                return null;
            } catch (e) {
                return errMsg(e);
            }
        }
        const accounts = loadSocietyAccounts().map(a => a.id === updated.id ? updated : a);
        persistSocietyAccounts(accounts);
        setSession(updated);
        return null;
    }, [currentSociety, setSession]);

    return (
        <SocietyAuthContext.Provider value={{ currentSociety, login, register, logout, updateSociety }}>
            {children}
        </SocietyAuthContext.Provider>
    );
}
