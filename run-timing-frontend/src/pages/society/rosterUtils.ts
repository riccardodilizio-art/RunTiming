import type { FidalAthlete } from '../../data/mockFidal';
import type { RosterAthlete, Affiliation } from '../../types';

export function newRosterId() {
    return `ros_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

/** Converte un atleta del DB FIDAL in una voce del roster società. */
export function fidalToRoster(a: FidalAthlete): RosterAthlete {
    const aff: Affiliation = {
        id: `aff_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        ente: a.tipo === 'fidal' ? 'fidal' : 'altro',
        societaNome: a.societa,
        codiceSocieta: a.codiceSocieta,
        numeroTessera: a.tessera,
        certScadenza: a.certScadenza,
        source: 'fidal_db',
    };
    return {
        id: newRosterId(),
        nome: a.nome,
        cognome: a.cognome,
        dataNascita: a.dataNascita,
        sesso: a.sesso,
        affiliations: [aff],
        source: 'fidal_db',
    };
}
