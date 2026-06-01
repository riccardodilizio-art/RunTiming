import { createContext, useContext } from 'react';
import type { AthleteAccount } from '../types';

export interface AthleteAuthContextValue {
    currentAthlete: AthleteAccount | null;
    login:    (email: string, password: string) => AthleteAccount | null;
    register: (data: Omit<AthleteAccount, 'id' | 'createdAt'>) => AthleteAccount | { error: string };
    logout:   () => void;
    updateProfile: (data: Partial<AthleteAccount>) => void;
}

export const AthleteAuthContext = createContext<AthleteAuthContextValue | null>(null);

export function useAthleteAuth(): AthleteAuthContextValue {
    const ctx = useContext(AthleteAuthContext);
    if (!ctx) throw new Error('useAthleteAuth must be used inside AthleteAuthProvider');
    return ctx;
}
