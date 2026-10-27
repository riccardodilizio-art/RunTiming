import { createContext, useContext } from 'react';
import type { AthleteAccount } from '../types';

export interface AthleteAuthContextValue {
    currentAthlete: AthleteAccount | null;
    login:    (email: string, password: string) => Promise<AthleteAccount | null>;
    register: (data: Omit<AthleteAccount, 'id' | 'createdAt'>) => Promise<AthleteAccount | { error: string }>;
    logout:   () => void;
    /** Con il backend restituisce un messaggio d'errore se il salvataggio fallisce. */
    updateProfile: (data: Partial<AthleteAccount>) => Promise<string | null>;
}

export const AthleteAuthContext = createContext<AthleteAuthContextValue | null>(null);

export function useAthleteAuth(): AthleteAuthContextValue {
    const ctx = useContext(AthleteAuthContext);
    if (!ctx) throw new Error('useAthleteAuth must be used inside AthleteAuthProvider');
    return ctx;
}
