import type { FidalAthlete } from './mockFidal';

// Dataset FIDAL importato dall'admin.
//
// Il DB reale (~40 MB, 200k+ atleti) NON sta nel localStorage, quindi è
// persistito in IndexedDB. Per mantenere SINCRONE le ricerche già esistenti
// (lookupByTessera/Name/Society), all'avvio carichiamo i record in un indice
// in memoria; IndexedDB serve solo per persistere tra i reload.
//
// Provvisorio: quando arriverà il backend, l'import andrà su Postgres
// (tabella FidalAthlete) e le ricerche passeranno dalle API.

const DB_NAME = 'rt_fidal';
const STORE = 'athletes';
const META = 'meta';
const META_KEY = 'current';
const DB_VERSION = 1;

export interface FidalMeta {
    fileName: string;
    count: number;
    importedAt: string;   // ISO
}

// ─── Indice in memoria ──────────────────────────────────────────────────────────
let memByTessera = new Map<string, FidalAthlete>();
let memList: FidalAthlete[] = [];
let meta: FidalMeta | null = null;

function rebuildMemory(records: FidalAthlete[], m: FidalMeta | null) {
    memList = records;
    memByTessera = new Map(records.map(r => [r.tessera.toUpperCase(), r]));
    meta = m;
}

// ─── IndexedDB ──────────────────────────────────────────────────────────────────

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'tessera' });
            if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function txDone(tx: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}

/** Carica all'avvio il dataset da IndexedDB nell'indice in memoria. */
export async function initFidalDataset(): Promise<void> {
    try {
        const db = await openDb();
        const tx = db.transaction([STORE, META], 'readonly');
        const records = await new Promise<FidalAthlete[]>((resolve, reject) => {
            const r = tx.objectStore(STORE).getAll();
            r.onsuccess = () => resolve(r.result as FidalAthlete[]);
            r.onerror = () => reject(r.error);
        });
        const m = await new Promise<FidalMeta | null>((resolve) => {
            const r = tx.objectStore(META).get(META_KEY);
            r.onsuccess = () => resolve((r.result as FidalMeta) ?? null);
            r.onerror = () => resolve(null);
        });
        db.close();
        rebuildMemory(records, m);
    } catch {
        // IndexedDB non disponibile → si usa il dataset demo (mockFidal).
        rebuildMemory([], null);
    }
}

/**
 * Sostituisce COMPLETAMENTE il dataset con i record forniti (svuota e riscrive),
 * aggiorna l'indice in memoria e i metadati. `onProgress` riporta i record scritti.
 */
export async function replaceFidalDataset(
    records: FidalAthlete[],
    fileName: string,
    onProgress?: (written: number, total: number) => void,
): Promise<FidalMeta> {
    const db = await openDb();
    const tx = db.transaction([STORE, META], 'readwrite');
    const store = tx.objectStore(STORE);
    store.clear();
    let written = 0;
    const reportEvery = Math.max(1, Math.floor(records.length / 50));
    for (const rec of records) {
        store.put(rec);
        written++;
        if (onProgress && written % reportEvery === 0) onProgress(written, records.length);
    }
    const newMeta: FidalMeta = { fileName, count: records.length, importedAt: new Date().toISOString() };
    tx.objectStore(META).put(newMeta, META_KEY);
    await txDone(tx);
    db.close();
    onProgress?.(records.length, records.length);
    rebuildMemory(records, newMeta);
    return newMeta;
}

/** Svuota il dataset importato (si torna ai dati demo). */
export async function clearFidalDataset(): Promise<void> {
    const db = await openDb();
    const tx = db.transaction([STORE, META], 'readwrite');
    tx.objectStore(STORE).clear();
    tx.objectStore(META).delete(META_KEY);
    await txDone(tx);
    db.close();
    rebuildMemory([], null);
}

// ─── Accessori sincroni (per i lookup) ───────────────────────────────────────────

/** True se è stato importato un dataset reale (altrimenti si usano i dati demo). */
export function datasetActive(): boolean {
    return memList.length > 0;
}

export function getFidalMeta(): FidalMeta | null {
    return meta;
}

export function dsLookupByTessera(tessera: string): FidalAthlete | null {
    return memByTessera.get(tessera.trim().toUpperCase()) ?? null;
}

export function dsLookupBySociety(codiceSocieta: string): FidalAthlete[] {
    const code = codiceSocieta.trim().toLowerCase();
    if (!code) return [];
    return memList.filter(a => a.codiceSocieta.toLowerCase() === code);
}

export function dsLookupByName(cognome: string, nome?: string, limit = 50): FidalAthlete[] {
    const q = cognome.trim().toLowerCase();
    const n = nome?.trim().toLowerCase() ?? '';
    if (!q) return [];
    const out: FidalAthlete[] = [];
    for (const a of memList) {
        if (!a.cognome.toLowerCase().includes(q)) continue;
        if (n && !a.nome.toLowerCase().includes(n)) continue;
        out.push(a);
        if (out.length >= limit) break;
    }
    return out;
}
