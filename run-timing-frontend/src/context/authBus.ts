// Bus di autenticazione: le tre identità (admin, atleta, società) sono
// mutuamente esclusive. Quando si accede con una, le altre vengono disconnesse,
// evitando sessioni sovrapposte (es. atleta + società attivi insieme).

export type AuthRole = 'admin' | 'athlete' | 'society';

const EVENT = 'rt-auth-login';

/** Da chiamare al login/registrazione di una identità. */
export function announceLogin(role: AuthRole) {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: role }));
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
