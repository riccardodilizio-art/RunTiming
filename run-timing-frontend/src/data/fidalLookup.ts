// Lookup FIDAL: instrada verso il backend (API reale WISE) oppure il dataset
// locale (import .xlsx/.dbf in IndexedDB), a seconda di VITE_USE_API.
//
// Quando l'API è attiva: verifica tessera e ricerca per nome in tempo reale
// contro WISE (tramite il nostro backend). Se l'API non risponde, fa fallback
// al dataset locale così l'iscrizione non si blocca mai.

import { api, USE_API } from '../lib/api';
import { lookupByName, lookupByTessera, type FidalAthlete } from './mockFidal';

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

/** Verifica un atleta per numero tessera. */
export async function verifyTessera(tessera: string): Promise<FidalAthlete | null> {
    if (USE_API) {
        try {
            const r = await api.get<VerifyResponse>(`/api/fidal/verifica?tessera=${encodeURIComponent(tessera)}`);
            return r.atleta ? normalize(r.atleta) : null; // risposta valida: nessun fallback
        } catch {
            return lookupByTessera(tessera); // API irraggiungibile → dataset locale
        }
    }
    return lookupByTessera(tessera);
}

/** Cerca atleti per cognome (+ nome opzionale). */
export async function searchByName(cognome: string, nome?: string): Promise<FidalAthlete[]> {
    if (USE_API) {
        try {
            const q = new URLSearchParams({ cognome });
            if (nome) q.set('nome', nome);
            const list = await api.get<(Partial<FidalAthlete> & { tessera: string })[]>(`/api/fidal/cerca?${q.toString()}`);
            return list.map(normalize);
        } catch {
            return lookupByName(cognome, nome);
        }
    }
    return lookupByName(cognome, nome);
}
