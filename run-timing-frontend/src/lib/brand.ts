// Nome del sito: UN solo punto da cambiare (variabile VITE_SITE_NAME al momento
// della build, oppure il valore predefinito qui sotto). Tutte le pagine lo leggono da qui.
export const SITE_NAME: string = (import.meta.env.VITE_SITE_NAME as string | undefined)?.trim() || 'RunTiming';

/** Email di contatto mostrata nel sito (VITE_CONTACT_EMAIL). */
export const CONTACT_EMAIL: string = (import.meta.env.VITE_CONTACT_EMAIL as string | undefined)?.trim() || '';

/**
 * Divide il nome in due parti per il logo bicolore: "RunTiming" → ["Run", "Timing"].
 * Si taglia sull'ultima maiuscola dopo la prima lettera; senza, il nome resta intero.
 */
export function brandParts(name = SITE_NAME): [string, string] {
    for (let i = name.length - 1; i > 0; i--) {
        if (/\p{Lu}/u.test(name[i]) && name[i - 1] !== ' ') return [name.slice(0, i), name.slice(i)];
    }
    return [name, ''];
}
