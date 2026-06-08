// Client HTTP minimale per le API backend.
// Quando il backend sarà pronto, i data-source (oggi su localStorage in
// useAdminStore) potranno chiamare questi metodi. Base URL da env (12-factor).

const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

/** True quando il frontend deve usare le API invece del localStorage. */
export const USE_API = import.meta.env.VITE_USE_API === 'true';

export class ApiError extends Error {
    constructor(public status: number, message: string) {
        super(message);
        this.name = 'ApiError';
    }
}

let authToken: string | null = null;
/** Imposta il bearer token (JWT) usato nelle richieste autenticate. */
export function setAuthToken(token: string | null) {
    authToken = token;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(init?.headers as Record<string, string> | undefined),
    };
    if (authToken) headers.Authorization = `Bearer ${authToken}`;

    const res = await fetch(`${BASE}${path}`, { ...init, headers });
    if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new ApiError(res.status, text || res.statusText);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
}

export const api = {
    get:   <T>(path: string) => request<T>(path),
    post:  <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST',  body: body !== undefined ? JSON.stringify(body) : undefined }),
    patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined }),
    put:   <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT',   body: body !== undefined ? JSON.stringify(body) : undefined }),
    del:   <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
