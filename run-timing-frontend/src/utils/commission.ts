import type { CommissionConfig, Event, Race, PriceStep } from '../types';

export const ZERO_COMMISSION: CommissionConfig = { fixedFee: 0, percentFee: 0, appliedTo: 'buyer' };

/**
 * Risolve la commissione effettiva secondo la cascata:
 *   step > gara > evento > globale
 *
 * Il primo livello con `commission` definito vince.
 */
export function resolveCommission(
    global: CommissionConfig,
    event?: Event,
    race?: Race,
    step?: PriceStep,
): CommissionConfig {
    return step?.commission ?? race?.commission ?? event?.commission ?? global;
}

/**
 * Calcola l'importo commissione da aggiungere (o sottrarre dall'organizzatore).
 * `priceAfterDiscount` = prezzo base dopo eventuali sconti.
 */
export function calcCommissionAmount(
    commission: CommissionConfig,
    priceAfterDiscount: number,
): number {
    return Math.round(
        (commission.fixedFee + priceAfterDiscount * commission.percentFee / 100) * 100
    ) / 100;
}
