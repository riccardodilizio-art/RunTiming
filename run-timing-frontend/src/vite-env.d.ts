/// <reference types="vite/client" />

interface ImportMetaEnv {
    /** URL base delle API backend (es. https://api.runtiming.it). Vuoto = stesso host. */
    readonly VITE_API_URL?: string;
    /** Se 'true', il frontend usa le API invece del localStorage (transizione al backend). */
    readonly VITE_USE_API?: string;
    /** Solo modalità demo senza backend: credenziali admin locali (mai nel codice). */
    readonly VITE_DEMO_ADMIN_USER?: string;
    readonly VITE_DEMO_ADMIN_PASSWORD?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
