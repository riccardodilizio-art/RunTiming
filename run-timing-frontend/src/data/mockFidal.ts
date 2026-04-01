/**
 * Mock FIDAL/RunCard athlete database.
 * In produzione questo sarà sostituito da una chiamata API al backend
 * che interrogherà il DB ufficiale FIDAL.
 */

export interface FidalAthlete {
    tessera: string;        // numero tessera FIDAL o RunCard
    tipo: 'fidal' | 'runcard';
    nome: string;
    cognome: string;
    dataNascita: string;    // YYYY-MM-DD
    sesso: 'M' | 'F';
    societa: string;
    codiceSocieta: string;
    certScadenza?: string;  // scadenza certificato medico YYYY-MM-DD (se disponibile nel DB)
}

export const MOCK_FIDAL_DB: FidalAthlete[] = [
    { tessera: 'RM001234', tipo: 'fidal',   nome: 'Marco',      cognome: 'Rossi',     dataNascita: '1985-03-15', sesso: 'M', societa: 'ASD Runners Roma',      codiceSocieta: 'RM001', certScadenza: '2025-12-31' },
    { tessera: 'MI004567', tipo: 'fidal',   nome: 'Laura',      cognome: 'Bianchi',   dataNascita: '1992-07-22', sesso: 'F', societa: 'Atletica Milano',        codiceSocieta: 'MI004', certScadenza: '2025-09-30' },
    { tessera: 'TO008901', tipo: 'fidal',   nome: 'Luca',       cognome: 'Ferrari',   dataNascita: '1978-11-05', sesso: 'M', societa: 'Podistica Torino',       codiceSocieta: 'TO008', certScadenza: '2026-03-15' },
    { tessera: 'BO002345', tipo: 'fidal',   nome: 'Giulia',     cognome: 'Conti',     dataNascita: '1998-04-18', sesso: 'F', societa: 'Run Bologna ASD',        codiceSocieta: 'BO002', certScadenza: '2025-11-20' },
    { tessera: 'FI005678', tipo: 'fidal',   nome: 'Alessandro', cognome: 'Russo',     dataNascita: '1990-09-30', sesso: 'M', societa: 'Firenze Marathon Club',  codiceSocieta: 'FI005', certScadenza: '2026-01-10' },
    { tessera: 'NA009012', tipo: 'fidal',   nome: 'Chiara',     cognome: 'Marino',    dataNascita: '2001-02-14', sesso: 'F', societa: 'ASD Napoli Running',     codiceSocieta: 'NA009' },
    { tessera: 'RC001122', tipo: 'runcard', nome: 'Davide',     cognome: 'Gallo',     dataNascita: '1995-06-08', sesso: 'M', societa: 'Individuale',            codiceSocieta: '' },
    { tessera: 'RC003344', tipo: 'runcard', nome: 'Valentina',  cognome: 'Greco',     dataNascita: '1988-12-25', sesso: 'F', societa: 'ASD Trail Dolomiti',     codiceSocieta: 'BL007' },
    { tessera: 'VR006789', tipo: 'fidal',   nome: 'Stefano',    cognome: 'Moretti',   dataNascita: '1975-08-03', sesso: 'M', societa: 'Maratoneti Veronesi',    codiceSocieta: 'VR006', certScadenza: '2025-07-31' },
    { tessera: 'GE004321', tipo: 'fidal',   nome: 'Francesca',  cognome: 'Ricci',     dataNascita: '2003-05-19', sesso: 'F', societa: 'Atletica Ligure',        codiceSocieta: 'GE004', certScadenza: '2026-05-01' },
];

/** Cerca un atleta per numero tessera (case-insensitive) */
export function lookupByTessera(tessera: string): FidalAthlete | null {
    return MOCK_FIDAL_DB.find(a => a.tessera.toLowerCase() === tessera.trim().toLowerCase()) ?? null;
}

/** Cerca atleti per cognome + nome (parziale, case-insensitive) */
export function lookupByName(cognome: string, nome?: string): FidalAthlete[] {
    const q = cognome.trim().toLowerCase();
    const n = nome?.trim().toLowerCase() ?? '';
    return MOCK_FIDAL_DB.filter(a => {
        const matchCognome = a.cognome.toLowerCase().includes(q);
        const matchNome = n ? a.nome.toLowerCase().includes(n) : true;
        return matchCognome && matchNome;
    });
}
