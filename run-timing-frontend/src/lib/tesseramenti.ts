import type { Race } from '../types';

// Tesseramenti ammessi per gara: stessa regola del server (backend/src/registrations/rules.ts).

export type Tesseramento = 'fidal' | 'runcard' | 'eps' | 'libero';
export const TESSERAMENTI: Tesseramento[] = ['fidal', 'runcard', 'eps', 'libero'];
export const TESSERAMENTO_LABEL: Record<Tesseramento, string> = {
    fidal: 'FIDAL', runcard: 'Runcard', eps: 'EPS e altri enti', libero: 'Non tesserati',
};

/** Tesseramenti ammessi (vuoto = tutti). Vecchie gare con ente FIDAL = FIDAL o Runcard. */
export function ammessiGara(race: Pick<Race, 'ammessi' | 'ente'> | undefined | null): Tesseramento[] {
    if (!race) return [];
    if (race.ammessi?.length) return race.ammessi;
    return race.ente === 'fidal' ? ['fidal', 'runcard'] : [];
}

export function tesseramentoDaEnte(ente: string | undefined, societaNome?: string): Tesseramento {
    if (ente === 'fidal') return 'fidal';
    if (ente === 'runcard' || /run\s*card/i.test(societaNome ?? '')) return 'runcard';
    if (!ente || ente === 'non_competitiva') return 'libero';
    return 'eps';
}

export function ammesso(race: Pick<Race, 'ammessi' | 'ente'> | undefined | null, t: Tesseramento): boolean {
    const a = ammessiGara(race);
    return !a.length || a.includes(t);
}

/** Frase per l'atleta, es. "Gara riservata ai tesserati FIDAL dai 35 anni". Null se aperta a tutti. */
export function descriviAmmessi(race: Pick<Race, 'ammessi' | 'ente' | 'minAge'> | undefined | null): string | null {
    const a = ammessiGara(race);
    if (!a.length) return null;
    const list = a.map(t => TESSERAMENTO_LABEL[t]);
    const who = a.every(t => t === 'fidal' || t === 'runcard')
        ? `ai tesserati ${list.join(' e ')}`
        : `a: ${list.join(', ').toLowerCase()}`;
    return `Gara riservata ${who}${race?.minAge ? ` dai ${race.minAge} anni` : ''}`;
}

/** Scelte rapide nell'editor gara. */
export const PRESET_AMMESSI: { id: string; label: string; ammessi: Tesseramento[]; minAge?: number }[] = [
    { id: 'tutti', label: 'Tutti (anche non tesserati)', ammessi: [] },
    { id: 'fidal_runcard', label: 'FIDAL + Runcard', ammessi: ['fidal', 'runcard'] },
    { id: 'fidal', label: 'Solo FIDAL', ammessi: ['fidal'] },
    { id: 'fidal_master', label: 'Solo FIDAL dai 35 anni (master)', ammessi: ['fidal'], minAge: 35 },
];
