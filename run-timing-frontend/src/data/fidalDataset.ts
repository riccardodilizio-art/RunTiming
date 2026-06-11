import type { FidalAthlete } from './mockFidal';
import type { SocietyInfo } from './dbfImport';

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
const SOC_STORE = 'societies';
const META = 'meta';
const META_KEY = 'current';
const SOC_META_KEY = 'societies';
const DB_VERSION = 2;

export interface FidalMeta {
    fileName: string;
    count: number;
    importedAt: string;   // ISO
}

// ─── Indici in memoria ──────────────────────────────────────────────────────────
let memByTessera = new Map<string, FidalAthlete>();
let memList: FidalAthlete[] = [];
let meta: FidalMeta | null = null;

let memSocieties = new Map<string, SocietyInfo>();   // COD_SOC → società
let socMeta: FidalMeta | null = null;

function rebuildMemory(records: FidalAthlete[], m: FidalMeta | null) {
    memList = records;
    memByTessera = new Map(records.map(r => [r.tessera.toUpperCase(), r]));
    meta = m;
}

function rebuildSocieties(societies: SocietyInfo[], m: FidalMeta | null) {
    memSocieties = new Map(societies.map(s => [s.codice.toUpperCase(), s]));
    socMeta = m;
}

/** Sovrascrive il nome società con la denominazione reale, se disponibile. */
function withSocietyName(a: FidalAthlete): FidalAthlete {
    const soc = a.codiceSocieta ? memSocieties.get(a.codiceSocieta.toUpperCase()) : undefined;
    return soc?.denom ? { ...a, societa: soc.denom } : a;
}

// ─── IndexedDB ──────────────────────────────────────────────────────────────────

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'tessera' });
            if (!db.objectStoreNames.contains(SOC_STORE)) db.createObjectStore(SOC_STORE, { keyPath: 'codice' });
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
        const tx = db.transaction([STORE, SOC_STORE, META], 'readonly');
        const getAll = <T>(storeName: string) => new Promise<T[]>((resolve, reject) => {
            const r = tx.objectStore(storeName).getAll();
            r.onsuccess = () => resolve(r.result as T[]);
            r.onerror = () => reject(r.error);
        });
        const getMeta = (key: string) => new Promise<FidalMeta | null>((resolve) => {
            const r = tx.objectStore(META).get(key);
            r.onsuccess = () => resolve((r.result as FidalMeta) ?? null);
            r.onerror = () => resolve(null);
        });
        const [records, societies, m, sm] = await Promise.all([
            getAll<FidalAthlete>(STORE),
            getAll<SocietyInfo>(SOC_STORE),
            getMeta(META_KEY),
            getMeta(SOC_META_KEY),
        ]);
        db.close();
        rebuildMemory(records, m);
        rebuildSocieties(societies, sm);
    } catch {
        // IndexedDB non disponibile → si usa il dataset demo (mockFidal).
        rebuildMemory([], null);
        rebuildSocieties([], null);
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

/** Svuota il dataset atleti importato (si torna ai dati demo). */
export async function clearFidalDataset(): Promise<void> {
    const db = await openDb();
    const tx = db.transaction([STORE, META], 'readwrite');
    tx.objectStore(STORE).clear();
    tx.objectStore(META).delete(META_KEY);
    await txDone(tx);
    db.close();
    rebuildMemory([], null);
}

/** Sostituisce COMPLETAMENTE l'anagrafica società e aggiorna l'indice in memoria. */
export async function replaceSocietyDataset(
    societies: SocietyInfo[],
    fileName: string,
): Promise<FidalMeta> {
    const db = await openDb();
    const tx = db.transaction([SOC_STORE, META], 'readwrite');
    const store = tx.objectStore(SOC_STORE);
    store.clear();
    for (const s of societies) store.put(s);
    const newMeta: FidalMeta = { fileName, count: societies.length, importedAt: new Date().toISOString() };
    tx.objectStore(META).put(newMeta, SOC_META_KEY);
    await txDone(tx);
    db.close();
    rebuildSocieties(societies, newMeta);
    return newMeta;
}

/** Svuota l'anagrafica società importata. */
export async function clearSocietyDataset(): Promise<void> {
    const db = await openDb();
    const tx = db.transaction([SOC_STORE, META], 'readwrite');
    tx.objectStore(SOC_STORE).clear();
    tx.objectStore(META).delete(SOC_META_KEY);
    await txDone(tx);
    db.close();
    rebuildSocieties([], null);
}

export function getSocietyMeta(): FidalMeta | null {
    return socMeta;
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
    const a = memByTessera.get(tessera.trim().toUpperCase());
    return a ? withSocietyName(a) : null;
}

export function dsLookupBySociety(codiceSocieta: string): FidalAthlete[] {
    const code = codiceSocieta.trim().toLowerCase();
    if (!code) return [];
    return memList.filter(a => a.codiceSocieta.toLowerCase() === code).map(withSocietyName);
}

export function dsLookupByName(cognome: string, nome?: string, limit = 50): FidalAthlete[] {
    const q = cognome.trim().toLowerCase();
    const n = nome?.trim().toLowerCase() ?? '';
    if (!q) return [];
    const out: FidalAthlete[] = [];
    for (const a of memList) {
        if (!a.cognome.toLowerCase().includes(q)) continue;
        if (n && !a.nome.toLowerCase().includes(n)) continue;
        out.push(withSocietyName(a));
        if (out.length >= limit) break;
    }
    return out;
}
