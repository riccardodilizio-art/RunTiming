// Client HTTP minimale per le API backend. Base URL da env (12-factor).
// Con VITE_USE_API=true il sito legge e scrive sul backend; altrimenti resta
// il prototipo su localStorage (utile per demo senza server).

const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

/** True quando il frontend deve usare le API invece del localStorage. */
export const USE_API = import.meta.env.VITE_USE_API === 'true';

export class ApiError extends Error {
    constructor(public status: number, message: string) {
        super(message);
        this.name = 'ApiError';
    }
}

// ─── Token (JWT) ──────────────────────────────────────────────────────────────
// Un solo token per volta (admin/organizzatore, atleta o società), salvato in
// localStorage per sopravvivere al reload. Il ruolo è dentro il token.

const TOKEN_KEY = 'rt_token';
let authToken: string | null = (() => {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
})();

export function setAuthToken(token: string | null) {
    authToken = token;
    try {
        if (token) localStorage.setItem(TOKEN_KEY, token);
        else localStorage.removeItem(TOKEN_KEY);
    } catch { /* storage non disponibile */ }
}

export function getAuthToken(): string | null {
    return authToken;
}

/** Ruolo contenuto nel token (senza verificarlo: lo verifica il server). */
export function tokenRole(): string | null {
    try {
        const payload = authToken?.split('.')[1];
        if (!payload) return null;
        return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))).role ?? null;
    } catch { return null; }
}

/** Estrae il messaggio leggibile dalle risposte d'errore NestJS. */
function errorMessage(text: string, fallback: string): string {
    try {
        const j = JSON.parse(text);
        const m = j.message;
        if (Array.isArray(m)) return m.join('; ');
        if (typeof m === 'string') return m;
    } catch { /* non JSON */ }
    return text || fallback;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(init?.headers as Record<string, string> | undefined),
    };
    if (authToken) headers.Authorization = `Bearer ${authToken}`;

    const res = await fetch(`${BASE}/api${path}`, { ...init, headers });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        if (res.status === 401 && authToken) setAuthToken(null); // sessione scaduta
        throw new ApiError(res.status, errorMessage(text, res.statusText));
    }
    if (res.status === 204) return undefined as T;
    const text = await res.text(); // risposta vuota (es. profilo non ancora creato) → null
    return (text ? JSON.parse(text) : null) as T;
}

/** Scarica un file binario autenticato (es. export Excel). */
export async function download(path: string, fileName: string): Promise<void> {
    const res = await fetch(`${BASE}/api${path}`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    });
    if (!res.ok) throw new ApiError(res.status, errorMessage(await res.text(), res.statusText));
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
}

/** Upload multipart (file) verso il backend. */
export async function apiUpload<T>(path: string, file: File | File[], field = 'file'): Promise<T> {
    const fd = new FormData();
    for (const f of Array.isArray(file) ? file : [file]) fd.append(field, f);
    const headers: Record<string, string> = {};
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    const res = await fetch(`${BASE}/api${path}`, { method: 'POST', body: fd, headers });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new ApiError(res.status, errorMessage(text, res.statusText));
    }
    return (await res.json()) as T;
}

export const api = {
    get:   <T>(path: string) => request<T>(path),
    post:  <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST',  body: body !== undefined ? JSON.stringify(body) : undefined }),
    patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined }),
    put:   <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT',   body: body !== undefined ? JSON.stringify(body) : undefined }),
    del:   <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
