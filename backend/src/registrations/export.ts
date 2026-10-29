import ExcelJS from 'exceljs';
import { Registration } from '@prisma/client';

// Tracciato FISSO del software di cronometraggio (foglio "Tabelle1"),
// identico a run-timing-frontend/src/pages/admin/exportEntrants.ts.
// In coda alcune colonne utili in più (categoria, pagamento, certificato),
// che il cronometraggio ignora se non mappate.
const TIMING_HEADERS = [
    'Pettorale', 'Titolo', 'Cognome', 'Nome', 'AnnoDiNascita', 'DataDiNascita', 'Genere',
    'Nazione', 'Via', 'Regione', 'CAP', 'Città', 'Paese', 'Gara', 'Società', 'Licenza',
    'Stato', 'Commento', 'Email', 'Telefono', 'Cellulare', 'AccountNum', 'FilialeNum',
    'IBAN', 'BIC', 'MandatoSEPA', 'Banca', 'ProprietarioAccount', 'Transponder1', 'Transponder2',
    'CodiceSocietà', 'Categoria', 'Pagamento', 'Certificato', 'IdIscrizione',
];

export async function entrantsXlsx(raceName: string, rows: Registration[]): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Tabelle1');
    ws.addRow(TIMING_HEADERS);
    ws.getRow(1).font = { bold: true };
    for (const r of rows) {
        const dn = r.dataNascita;
        ws.addRow([
            r.pettorale ?? '', '', r.cognome, r.nome,
            dn ? dn.getUTCFullYear() : '',
            dn ?? '',
            r.sesso.toLowerCase(),
            'ITA', '', '', '', '', 'Italia',
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
        ]);
    }
    ws.getColumn(6).numFmt = 'dd/mm/yyyy';
    ws.columns.forEach(c => (c.width = 14));
    return Buffer.from(await wb.xlsx.writeBuffer());
}
