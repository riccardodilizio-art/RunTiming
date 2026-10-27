// Bus di autenticazione: le tre identità (admin, atleta, società) sono
// mutuamente esclusive. Quando si accede con una, le altre vengono disconnesse,
// evitando sessioni sovrapposte (es. atleta + società attivi insieme).

export type AuthRole = 'admin' | 'athlete' | 'society';

const EVENT = 'rt-auth-login';

const SESSION_KEY: Record<AuthRole, string> = {
    admin:   'rt_session',
    athlete: 'rt_athlete_session',
    society: 'rt_society_session',
};
const ACTIVE_ROLE_KEY = 'rt_active_role';

/** Da chiamare al login/registrazione di una identità. */
export function announceLogin(role: AuthRole) {
    try { localStorage.setItem(ACTIVE_ROLE_KEY, role); } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: role }));
}

/**
 * All'avvio: garantisce UNA sola identità attiva. Se più sessioni sono presenti
 * (stato legacy o test), tiene solo quella dell'ultimo login (rt_active_role);
 * se non è determinabile, le azzera tutte e richiede un nuovo accesso.
 * Da chiamare PRIMA del mount, così i provider leggono lo stato riconciliato.
 */
export function reconcileSessions() {
    try {
        const present = (Object.keys(SESSION_KEY) as AuthRole[])
            .filter(role => localStorage.getItem(SESSION_KEY[role]));
        if (present.length <= 1) {
            // Allinea il marker se manca (utente singolo pre-fix).
            if (present.length === 1 && !localStorage.getItem(ACTIVE_ROLE_KEY)) {
                localStorage.setItem(ACTIVE_ROLE_KEY, present[0]);
            }
            return;
        }
        const active = localStorage.getItem(ACTIVE_ROLE_KEY) as AuthRole | null;
        // Tiene l'ultima identità usata; se non determinabile, priorità
        // all'atleta (utente del sito), poi società, poi admin.
        const priority: AuthRole[] = ['athlete', 'society', 'admin'];
        const keep = (active && present.includes(active))
            ? active
            : (priority.find(r => present.includes(r)) ?? null);
        for (const role of present) {
            if (role !== keep) localStorage.removeItem(SESSION_KEY[role]);
        }
        if (keep) localStorage.setItem(ACTIVE_ROLE_KEY, keep);
    } catch { /* ignore */ }
}

/**
 * Sottoscrive la disconnessione automatica: se viene annunciato il login di
 * un'altra identità, esegue `logout`. Restituisce la funzione di cleanup.
 */
export function onExclusiveLogin(myRole: AuthRole, logout: () => void): () => void {
    const handler = (e: Event) => {
        const role = (e as CustomEvent).detail as AuthRole;
        if (role !== myRole) logout();
    };
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
}
