import type { Affiliation } from '../../types';

export function newAffiliationId() {
    return `aff_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

/** Deriva una lista di affiliazioni dai vecchi campi singoli (migrazione legacy). */
export function affiliationsFromLegacy(fidalTessera?: string, runcardTessera?: string, club?: string): Affiliation[] {
    const out: Affiliation[] = [];
    if (fidalTessera) out.push({ id: newAffiliationId(), ente: 'fidal', societaNome: club ?? '', numeroTessera: fidalTessera, source: 'manual' });
    if (runcardTessera) out.push({ id: newAffiliationId(), ente: 'altro', societaNome: 'RunCard', numeroTessera: runcardTessera, source: 'manual' });
    return out;
}
