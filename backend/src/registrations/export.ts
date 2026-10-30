import ExcelJS from 'exceljs';
import { Registration } from '@prisma/client';
import { pettoraleFrazione } from './staffetta';

// Tracciato FISSO del software di cronometraggio (foglio "Tabelle1"),
// identico a run-timing-frontend/src/pages/admin/exportEntrants.ts.
// In coda alcune colonne utili in più (categoria, pagamento, certificato),
// che il cronometraggio ignora se non mappate.
const TIMING_HEADERS = [
    'Pettorale', 'Titolo', 'Cognome', 'Nome', 'AnnoDiNascita', 'DataDiNascita', 'Genere',
    'Nazione', 'Via', 'Regione', 'CAP', 'Città', 'Paese', 'Gara', 'Società', 'Licenza',
    'Stato', 'Commento', 'Email', 'Telefono', 'Cellulare', 'AccountNum', 'FilialeNum',
    'IBAN', 'BIC', 'MandatoSEPA', 'Banca', 'ProprietarioAccount', 'Transponder1', 'Transponder2',
    'CodiceSocietà', 'Categoria', 'Pagamento', 'Certificato', 'IdIscrizione', 'Genitore (minorenne)', 'Squadra', 'Frazione',
];

/** Dichiarazione del genitore di un minorenne: "COGNOME NOME (dichiarazione del 30/10/2026)". */
function genitore(g: unknown): string {
    const x = g as { nome?: string; cognome?: string; at?: string } | null;
    if (!x?.cognome) return '';
    const quando = x.at ? new Date(x.at).toLocaleDateString('it-IT', { timeZone: 'Europe/Rome' }) : '';
    return `${x.cognome} ${x.nome ?? ''}`.trim() + (quando ? ` (dichiarazione del ${quando})` : '');
}

export async function entrantsXlsx(raceName: string, rows: Registration[]): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Tabelle1');
    ws.addRow(TIMING_HEADERS);
    ws.getRow(1).font = { bold: true };
    // Staffette: il numero della squadra è sul capitano; ogni frazione esce come 101-1, 101-2…
    const numeroSquadra = new Map(rows.filter(r => r.frazione === 1).map(r => [r.id, r.pettorale]));
    for (const r of rows) {
        const dn = r.dataNascita;
        const pett = r.frazione
            ? pettoraleFrazione(r.frazione === 1 ? r.pettorale : numeroSquadra.get(r.staffettaCapoId ?? ''), r.frazione)
            : r.pettorale ?? '';
        ws.addRow([
            pett, '', r.cognome, r.nome,
            dn ? dn.getUTCFullYear() : '',
            dn ?? '',
            r.sesso.toLowerCase(),
            r.nazionalita || 'ITA', '', '', '', '', (r.nazionalita || 'ITA') === 'ITA' ? 'Italia' : '',
            raceName,
            r.societa ?? '',
            r.tessera ?? '',
            '', '',
            r.email ?? '', '', '',
            '', '', '', '', '', '', '', '', '',
            r.codiceSocieta ?? '',
            r.assignedCategory ?? '',
            r.paymentStatus,
            r.certStatus ?? '',
            r.id,
            genitore(r.genitore),
            r.squadra ?? '',
            r.frazione ?? '',
        ]);
    }
    ws.getColumn(6).numFmt = 'dd/mm/yyyy';
    ws.columns.forEach(c => (c.width = 14));
    return Buffer.from(await wb.xlsx.writeBuffer());
}
