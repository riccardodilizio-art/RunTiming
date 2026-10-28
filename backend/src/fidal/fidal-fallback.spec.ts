import { FidalService } from './fidal.service';

// WISE non raggiungibile o non configurato: la verifica usa i file caricati dall'admin.
// Dati inventati.
function setup(row: any, society: any = null) {
    const prisma: any = {
        fidalAthlete: {
            findUnique: async () => row,
            findMany: async () => (row ? [{ tessera: row.tessera, certScadenza: row.certScadenza }] : []),
        },
        fidalSociety: { findMany: async () => (society ? [society] : []) },
    };
    const wise: any = { getJson: async () => { throw new Error('WISE non configurato'); } };
    const config: any = { get: () => undefined };
    return new FidalService(wise, prisma, config);
}

const riga = {
    tessera: 'ZZ900001', tipo: 'fidal', nome: 'GIULIA', cognome: 'PROVAUNO', dataNascita: new Date('1988-04-03T00:00:00Z'),
    sesso: 'F', societa: '', codiceSocieta: 'CH999', certScadenza: new Date('2027-12-31T00:00:00Z'),
};

describe('verifica tessera senza WISE', () => {
    it('usa il database caricato: nome società per esteso e scadenza certificato', async () => {
        const r = await setup(riga, { codice: 'CH999', denominazione: 'ATLETICA PROVA' }).verifyByTessera('zz900001');
        expect(r.tesserato).toBe(true);
        expect(r.atleta).toMatchObject({ societa: 'ATLETICA PROVA', codiceSocieta: 'CH999', certScadenza: '2027-12-31', dataNascita: '1988-04-03' });
    });

    it('società non presente nell\'anagrafica: resta il codice (mai il luogo di nascita)', async () => {
        const r = await setup(riga).verifyByTessera('ZZ900001');
        expect(r.atleta?.societa).toBe('CH999');
    });

    it('tessera assente anche nel database: verifica non disponibile', async () => {
        await expect(setup(null).verifyByTessera('ZZ000000')).rejects.toThrow(/WISE/);
    });
});
