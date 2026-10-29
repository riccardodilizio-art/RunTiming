// Cambi dopo l'iscrizione: regole "pure" (senza DB), in un punto solo.
//
// Decisioni della segreteria:
// - cambio gara: nessun rimborso; se la nuova gara costa di più si paga la differenza;
// - cessione del pettorale (cambio nominativo): con quota di segreteria;
// - trasferimento all'anno dopo: con quota di segreteria; la quota pagata
//   diventa un credito (codice) da usare all'edizione successiva.
// Si fanno dall'atleta fino alla chiusura delle iscrizioni; dopo, solo l'admin.

export type TipoCambio = 'gara' | 'cessione' | 'trasferimento';

export interface QuoteCambi {
    /** Cambio gara/distanza ammesso. */
    cambioGara: boolean;
    /** Quota di segreteria per la cessione; null = cessione non ammessa. */
    cessione: number | null;
    /** Quota di segreteria per il trasferimento all'anno dopo; null = non ammesso. */
    trasferimento: number | null;
}

export const QUOTE_CAMBI_DEFAULT: QuoteCambi = { cambioGara: true, cessione: null, trasferimento: null };

const euro = (v: unknown): number | null => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 && n <= 1000 ? Math.round(n * 100) / 100 : null;
};

/** Impostazioni dell'evento, con i valori predefiniti per quelle mancanti. */
export function quoteCambi(v: unknown): QuoteCambi {
    if (!v || typeof v !== 'object') return { ...QUOTE_CAMBI_DEFAULT };
    const o = v as Record<string, unknown>;
    return {
        cambioGara: o.cambioGara === undefined ? QUOTE_CAMBI_DEFAULT.cambioGara : o.cambioGara === true,
        cessione: euro(o.cessione),
        trasferimento: euro(o.trasferimento),
    };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Quanto già pagato per la quota (senza commissione e maggiorazione del metodo). */
export function quotaPagata(r: { basePrice: number; discountAmount: number }): number {
    return round2(Math.max(0, r.basePrice - r.discountAmount));
}

/** Cambio gara: differenza da pagare (mai rimborsi). */
export function differenzaGara(nuovaQuota: number, pagato: number): number {
    return round2(Math.max(0, nuovaQuota - pagato));
}

/** Codice del credito per l'anno dopo, es. "TR-7KQ4M9XP". */
export function codiceCredito(ref: string): string {
    return `TR-${ref.replace(/^RT-/, '')}`;
}
