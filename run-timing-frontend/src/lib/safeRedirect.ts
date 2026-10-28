/**
 * Destinazione dopo login/registrazione presa dal link (?redirect=…): solo
 * percorsi interni al sito. Un link preparato non può portare l'atleta su un
 * altro sito (es. "/\\evil.example" o "//evil.example" o "https://…").
 */
export function safeRedirect(v: string | null | undefined, fallback = '/profilo'): string {
    if (!v || v.length > 500) return fallback;
    if (!/^\/(?![/\\])/.test(v)) return fallback;      // deve iniziare con un solo "/"
    // niente "\\" né caratteri di controllo (tab, a capo…)
    if (v.includes('\\') || [...v].some(c => c.charCodeAt(0) < 32)) return fallback;
    return v;
}
