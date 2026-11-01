// Combinate: iscrizione a più gare dello stesso evento con una quota sua
// (es. gara A 10 € + gara B 10 €, combinata 18 €). Regole "pure" in un punto solo.
import { PaymentStatus, Prisma } from '@prisma/client';

export interface Combinata {
    id: string;
    nome: string;
    /** Gare incluse (almeno 2, dello stesso evento). */
    raceIds: string[];
    /** Quota della combinata. */
    prezzo: number;
}

/** Le iscrizioni "figlie" non si pagano da sole: seguono la principale. */
export const METODO_COMBINATA = 'combinata';

/** Combinate valide dell'evento (scarta quelle con meno di 2 gare note). */
export function combinateEvento(v: unknown, raceIds?: Set<string>): Combinata[] {
    if (!Array.isArray(v)) return [];
    const out: Combinata[] = [];
    for (const c of v) {
        if (!c || typeof c !== 'object') continue;
        const { id, nome, raceIds: r, prezzo } = c as Record<string, unknown>;
        if (typeof id !== 'string' || !id.trim() || typeof nome !== 'string' || !Array.isArray(r)) continue;
        const races = [...new Set(r.filter((x): x is string => typeof x === 'string' && (!raceIds || raceIds.has(x))))];
        const p = Number(prezzo);
        if (races.length < 2 || !Number.isFinite(p) || p < 0) continue;
        out.push({ id: id.slice(0, 40), nome: nome.trim().slice(0, 80) || 'Combinata', raceIds: races, prezzo: Math.round(p * 100) / 100 });
    }
    return out;
}

/** Combinata con gli id delle gare sostituiti (gare nuove o evento copiato). */
export function rimappaCombinate(list: Combinata[], map: Map<string, string>): Combinata[] {
    return list.map(c => ({ ...c, raceIds: c.raceIds.map(id => map.get(id) ?? id) }));
}

/**
 * Quanto paga chi aggiunge la combinata essendo già iscritto ad alcune gare:
 * quota della combinata meno quanto già pagato (mai sotto zero).
 */
export function prezzoAggiunta(prezzo: number, giaPagato: number): number {
    return Math.max(0, Math.round((prezzo - giaPagato) * 100) / 100);
}

/**
 * Le iscrizioni figlie seguono lo stato di pagamento della principale: le altre
 * gare di una combinata e le altre frazioni di una staffetta (il capitano paga per tutti).
 */
export function allineaCombinata(
    db: Pick<Prisma.TransactionClient, 'registration'>, parentIds: string[], paymentStatus: PaymentStatus, paidAt: Date | null,
) {
    if (!parentIds.length) return Promise.resolve({ count: 0 });
    return db.registration.updateMany({
        where: { OR: [{ combinataParentId: { in: parentIds } }, { staffettaCapoId: { in: parentIds } }] },
        data: { paymentStatus, paidAt },
    });
}
