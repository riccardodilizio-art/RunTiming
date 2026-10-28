// Verifica anti-bot (Cloudflare Turnstile) per iscrizioni senza account e
// creazione account. Si attiva solo se VITE_TURNSTILE_SITE_KEY è impostata
// (e lato server TURNSTILE_SECRET_KEY): senza chiavi non mostra nulla.

export const SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ?? '';
export const CAPTCHA_ENABLED = !!SITE_KEY;

interface TurnstileApi {
    render(el: HTMLElement, opts: Record<string, unknown>): string;
    reset(id?: string): void;
    remove(id: string): void;
}
declare global {
    interface Window { turnstile?: TurnstileApi }
}

// Un solo widget attivo per pagina: token e id a livello di modulo, così le
// chiamate API possono prenderlo senza passarlo attraverso i componenti.
let token = '';
let widgetId: string | null = null;

export function setCaptchaToken(t: string) { token = t; }
export function setCaptchaWidget(id: string | null) { widgetId = id; }
export function captchaWidget() { return widgetId; }

/** Prende il token (monouso) e prepara il widget per una nuova verifica. */
export function takeCaptchaToken(): string | undefined {
    if (!CAPTCHA_ENABLED) return undefined;
    const t = token;
    token = '';
    if (widgetId) window.turnstile?.reset(widgetId);
    return t || undefined;
}

let scriptPromise: Promise<void> | null = null;
export function loadCaptchaScript(): Promise<void> {
    if (window.turnstile) return Promise.resolve();
    scriptPromise ??= new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => { scriptPromise = null; reject(new Error('Verifica anti-bot non disponibile')); };
        document.head.appendChild(s);
    });
    return scriptPromise;
}
