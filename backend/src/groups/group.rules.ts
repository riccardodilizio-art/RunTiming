// Iscrizioni di gruppo delle società: regole "pure" (senza DB), in un punto solo.
//
// Esempio deciso con la segreteria: "ogni 10 iscritti uno gratis", +1 € di
// bonifico per ogni pagante. 21 atleti a 20 € → 2 omaggi, 19 paganti →
// 19 × 20 € + 19 × 1 € = 399 €.

export interface RegolaOmaggi {
    /** Ogni quanti iscritti della stessa società (es. 10). */
    ogni: number;
    /** Quanti di quelli sono gratis (es. 1). */
    gratis: number;
}

/** Regola valida o null (spenta / dati non validi). */
export function regolaOmaggi(v: unknown): RegolaOmaggi | null {
    if (!v || typeof v !== 'object') return null;
    const { ogni, gratis } = v as Record<string, unknown>;
    if (!Number.isInteger(ogni) || !Number.isInteger(gratis)) return null;
    if ((ogni as number) < 2 || (ogni as number) > 1000 || (gratis as number) < 1 || (gratis as number) >= (ogni as number)) return null;
    return { ogni: ogni as number, gratis: gratis as number };
}

/**
 * Per ciascun atleta del nuovo gruppo: è in omaggio? Si conta su tutte le
 * iscrizioni della società alla gara: con "ogni 10, 1 gratis" sono gratis la
 * 10ª, la 20ª… (se la società ne aveva già 8, nel nuovo gruppo è gratis il 2°).
 */
export function omaggiNelGruppo(giaIscritti: number, nuovi: number, r: RegolaOmaggi | null): boolean[] {
    return Array.from({ length: nuovi }, (_, i) => {
        if (!r) return false;
        const pos = giaIscritti + i + 1; // posizione tra gli iscritti della società (1, 2, …)
        return (pos - 1) % r.ogni >= r.ogni - r.gratis;
    });
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Riepilogo del gruppo: `quota` per atleta e `maggiorazione` per ogni pagante. */
export function riepilogoGruppo(omaggi: boolean[], quota: number, maggiorazione: number) {
    const iscritti = omaggi.length;
    const nOmaggi = omaggi.filter(Boolean).length;
    const paganti = iscritti - nOmaggi;
    return {
        iscritti,
        omaggi: nOmaggi,
        paganti,
        quota: round2(quota),
        maggiorazione: round2(maggiorazione),
        totale: round2(paganti * (quota + maggiorazione)),
    };
}
