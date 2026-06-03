import * as XLSX from 'xlsx';
import type { Race, RegistrationSubmission, CatalogKey } from '../../types';

// Tracciato FISSO richiesto dal software di cronometraggio (foglio "Tabelle1").
const TIMING_HEADERS = [
    'Pettorale', 'Titolo', 'Cognome', 'Nome', 'AnnoDiNascita', 'DataDiNascita', 'Genere',
    'Nazione', 'Via', 'Regione', 'CAP', 'Città', 'Paese', 'Gara', 'Società', 'Licenza',
    'Stato', 'Commento', 'Email', 'Telefono', 'Cellulare', 'AccountNum', 'FilialeNum',
    'IBAN', 'BIC', 'MandatoSEPA', 'Banca', 'ProprietarioAccount', 'Transponder1', 'Transponder2',
];

/** Legge un valore del modulo per catalogKey (i dati profilo sono mappati ai field id). */
function byCatalog(race: Race, reg: RegistrationSubmission, key: CatalogKey): string {
    const f = (race.formSchema ?? []).find(ff => ff.catalogKey === key);
    if (!f) return '';
    const v = reg.formData[f.id];
    return typeof v === 'boolean' ? (v ? '1' : '') : String(v ?? '');
}

/** Esporta gli iscritti di una gara in Excel nel tracciato del cronometraggio. */
export function exportEntrantsXlsx(race: Race, regs: RegistrationSubmission[]) {
    const rows = regs.map(reg => {
        const dn = byCatalog(race, reg, 'data_nascita');
        const dnDate = dn ? new Date(dn) : '';
        const anno = byCatalog(race, reg, 'anno_nascita')
            || (dn ? String(new Date(dn).getFullYear()) : '');
        const sesso = byCatalog(race, reg, 'sesso').toLowerCase();
        const licenza = byCatalog(race, reg, 'tessera_fidal') || byCatalog(race, reg, 'tessera_runcard');
        return [
            '',                                   // Pettorale (assegnato dal cronometraggio)
            '',                                   // Titolo
            byCatalog(race, reg, 'cognome'),
            byCatalog(race, reg, 'nome'),
            anno,                                 // AnnoDiNascita
            dnDate,                               // DataDiNascita (Date → seriale Excel)
            sesso === 'm' || sesso === 'f' ? sesso : '',
            'ITA',                                // Nazione
            '', '', '', '', 'Italia',            // Via, Regione, CAP, Città, Paese
            '',                                   // Gara (definita nel portale di cronometraggio)
            byCatalog(race, reg, 'societa'),
            licenza,                              // Licenza
            '', '',                               // Stato, Commento
            byCatalog(race, reg, 'email'),
            byCatalog(race, reg, 'telefono'),
            byCatalog(race, reg, 'telefono'),     // Cellulare
            '', '', '', '', '', '', '',          // dati bancari/SEPA
            '', '',                               // Transponder1/2
        ];
    });

    const ws = XLSX.utils.aoa_to_sheet([TIMING_HEADERS, ...rows], { cellDates: true });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tabelle1');
    const fname = `iscritti-cronometraggio-${race.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fname);
}
