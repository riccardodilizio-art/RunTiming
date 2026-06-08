// Logica certificato medico — centralizzata.
//
// Principio (richiesto dal flusso operativo): il certificato si verifica UNA
// volta per atleta e vale per TUTTE le gare, non gara-per-gara.
//   • Atleta tesserato FIDAL  → verifica AUTOMATICA (la federazione garantisce
//     il certificato agonistico): non entra mai nella coda di verifica admin.
//   • Atleta non-FIDAL        → l'admin verifica il certificato una sola volta
//     sull'account; lo stato viene propagato a tutte le iscrizioni.
//
// Questo modulo è l'unico punto in cui si decide se un certificato è "auto-ok".

import type { Affiliation, AthleteAccount, CertStatus, RaceEnte } from '../types';

/** True se l'affiliazione scelta è di tipo FIDAL (cert agonistico garantito). */
export function isFidalEnte(ente: RaceEnte | undefined): boolean {
    return ente === 'fidal';
}

/** True se l'atleta possiede almeno un tesseramento FIDAL. */
export function hasFidalAffiliation(account: Pick<AthleteAccount, 'affiliations' | 'fidalTessera'>): boolean {
    if (account.fidalTessera) return true;
    return (account.affiliations ?? []).some(a => a.ente === 'fidal');
}

/**
 * Sceglie il tesseramento da usare per iscriversi a una gara di un dato ente.
 * Se la gara è FIDAL serve il tesseramento FIDAL; per gli altri enti si prende
 * quello dell'ente corrispondente, altrimenti il primo disponibile.
 */
export function pickAffiliationForEnte(
    affiliations: Affiliation[],
    ente: RaceEnte | undefined,
): Affiliation | null {
    if (!affiliations.length) return null;
    if (ente === 'fidal') return affiliations.find(a => a.ente === 'fidal') ?? null;
    return affiliations.find(a => a.ente === ente) ?? affiliations[0];
}

/**
 * Stato certificato da assegnare a una NUOVA iscrizione, dato:
 *  - se la gara richiede il certificato,
 *  - l'affiliazione usata per l'iscrizione (può essere FIDAL → auto-ok),
 *  - lo stato del certificato già presente sull'account atleta (verifica unica),
 *  - se l'iscrizione arriva da una società (il presidente garantisce i certificati
 *    dei propri atleti → nessuna verifica admin richiesta).
 */
export function resolveCertStatus(opts: {
    requiresMedicalCert: boolean;
    affiliation?: Pick<Affiliation, 'ente'> | null;
    accountCertStatus?: CertStatus;
    societyVouched?: boolean;
}): CertStatus {
    if (!opts.requiresMedicalCert) return 'non_richiesto';
    if (isFidalEnte(opts.affiliation?.ente)) return 'verificato';   // FIDAL → automatico
    if (opts.accountCertStatus === 'verificato') return 'verificato'; // già verificato una volta
    if (opts.societyVouched) return 'verificato';                    // garantito dalla società
    return 'in_attesa';
}
