// Lookup FIDAL: instrada verso il backend (API reale WISE) oppure il dataset
// locale (import .xlsx/.dbf in IndexedDB), a seconda di VITE_USE_API.
//
// Quando l'API è attiva: verifica tessera e ricerca per nome in tempo reale
// contro WISE (tramite il nostro backend). Se l'API non risponde, fa fallback
// al dataset locale così l'iscrizione non si blocca mai.

import { api, ApiError, USE_API } from '../lib/api';
import { lookupByName, lookupBySociety, lookupByTessera, type FidalAthlete } from './mockFidal';
import { dsLookupByTessera } from './fidalDataset';

/**
 * WISE (real-time) NON restituisce la scadenza del certificato; il dump FIDAL
 * importato sì. Se manca, la recuperiamo dal dump locale per tessera, così la
 * validità rispetto alla data evento è verificabile.
 */
function enrichCertScadenza(a: FidalAthlete): FidalAthlete {
    if (a.certScadenza) return a;
    const local = dsLookupByTessera(a.tessera);
    return local?.certScadenza ? { ...a, certScadenza: local.certScadenza } : a;
}

interface VerifyResponse {
    tessera: string;
    tesserato: boolean;
    atleta: (Partial<FidalAthlete> & { tessera: string }) | null;
}

/** Normalizza un atleta ricevuto dall'API nella forma FidalAthlete. */
function normalize(a: Partial<FidalAthlete> & { tessera: string }): FidalAthlete {
    return {
        tessera: a.tessera,
        tipo: (a.tipo as FidalAthlete['tipo']) ?? 'fidal',
        nome: a.nome ?? '',
        cognome: a.cognome ?? '',
        dataNascita: a.dataNascita ?? '',
        sesso: (a.sesso as FidalAthlete['sesso']) ?? 'M',
        societa: a.societa ?? '',
        codiceSocieta: a.codiceSocieta ?? '',
        certScadenza: a.certScadenza,
    };
}

/** Fallback al dataset locale solo se il server non è raggiungibile (non se ha risposto "no"). */
function rethrowIfServerAnswered(e: unknown) {
    if (e instanceof ApiError) throw e;
}

/** Ruoli che possono cercare nell'anagrafica FIDAL per nome (dati personali). */
export const FIDAL_SEARCH_ROLES = ['ADMIN', 'ORGANIZER', 'SOCIETY'];

/**
 * Verifica un atleta per numero tessera. Con l'API serve anche il cognome:
 * il server risponde solo se tessera e cognome corrispondono, così la tessera
 * da sola non basta a leggere i dati di qualcun altro.
 */
export async function verifyTessera(tessera: string, cognome = ''): Promise<FidalAthlete | null> {
    if (USE_API) {
        try {
            const q = new URLSearchParams({ tessera, cognome });
            const r = await api.get<VerifyResponse>(`/fidal/verifica?${q.toString()}`);
            return r.atleta ? enrichCertScadenza(normalize(r.atleta)) : null; // risposta valida: nessun fallback
        } catch (e) {
            if (e instanceof ApiError && e.status === 404) return null;
            rethrowIfServerAnswered(e);
            return lookupByTessera(tessera); // API irraggiungibile → dataset locale
        }
    }
    return lookupByTessera(tessera);
}

/** Elenca gli atleti di una società per codice FIDAL (per popolare il roster). */
export async function listBySociety(codiceSocieta: string): Promise<FidalAthlete[]> {
    if (USE_API) {
        try {
            const list = await api.get<(Partial<FidalAthlete> & { tessera: string })[]>(
                `/fidal/societa/${encodeURIComponent(codiceSocieta)}`,
            );
            return list.map(normalize);
        } catch (e) {
            rethrowIfServerAnswered(e);
            return lookupBySociety(codiceSocieta);
        }
    }
    return lookupBySociety(codiceSocieta);
}

/** Cerca atleti per cognome (+ nome opzionale). Con l'API: solo staff. */
export async function searchByName(cognome: string, nome?: string): Promise<FidalAthlete[]> {
    if (USE_API) {
        try {
            const q = new URLSearchParams({ cognome });
            if (nome) q.set('nome', nome);
            const list = await api.get<(Partial<FidalAthlete> & { tessera: string })[]>(`/fidal/cerca?${q.toString()}`);
            return list.map(normalize);
        } catch (e) {
            rethrowIfServerAnswered(e);
            return lookupByName(cognome, nome);
        }
    }
    return lookupByName(cognome, nome);
}
