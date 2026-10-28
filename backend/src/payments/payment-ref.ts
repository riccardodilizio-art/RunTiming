import { randomInt } from 'crypto';

// Alfabeto senza caratteri ambigui (0/O, 1/I/L): la causale si copia a mano.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Codice pagamento univoco, es. "RT-7KQ4M9XP": causale del bonifico e chiave per pagare in seguito. */
export function newPaymentRef(): string {
    let s = '';
    for (let i = 0; i < 8; i++) s += ALPHABET[randomInt(ALPHABET.length)];
    return `RT-${s}`;
}
