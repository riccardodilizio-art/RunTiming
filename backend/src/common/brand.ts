/**
 * Nome del sito: UN solo punto da cambiare (variabile SITE_NAME nel .env).
 * Lo usano email, messaggi e PayPal (nome mostrato al pagamento).
 */
export function siteName(): string {
    return process.env.SITE_NAME?.trim() || 'RunTiming';
}

/** Firma delle email e nome del mittente (MAIL_FROM_NAME, altrimenti "Segreteria – <nome sito>"). */
export function signature(): string {
    return process.env.MAIL_FROM_NAME?.trim() || `Segreteria – ${siteName()}`;
}
