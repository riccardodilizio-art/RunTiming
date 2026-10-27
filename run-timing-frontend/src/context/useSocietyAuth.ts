import { createContext, useContext } from 'react';
import type { SocietyAccount, RosterAthlete } from '../types';

export type SocietyRegisterData =
    Omit<SocietyAccount, 'id' | 'createdAt' | 'roster'> & { roster?: RosterAthlete[] };

export interface SocietyAuthContextValue {
    currentSociety: SocietyAccount | null;
    login:    (email: string, password: string) => Promise<SocietyAccount | null>;
    register: (data: SocietyRegisterData) => Promise<SocietyAccount | { error: string }>;
    logout:   () => void;
    /** Con il backend restituisce un messaggio d'errore se il salvataggio fallisce. */
    updateSociety: (data: Partial<SocietyAccount>) => Promise<string | null>;
}

export const SocietyAuthContext = createContext<SocietyAuthContextValue | null>(null);

export function useSocietyAuth(): SocietyAuthContextValue {
    const ctx = useContext(SocietyAuthContext);
    if (!ctx) throw new Error('useSocietyAuth must be used inside SocietyAuthProvider');
    return ctx;
}
