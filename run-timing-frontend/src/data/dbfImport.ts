// Lettore minimale di file .DBF (dBASE III/IV) lato browser.
//
// Usato per l'anagrafica società FIDAL (DILIZIO_SOCIETA_DBASE.DBF): la chiave
// COD_SOC collega ogni società al codice società presente nel DB atleti, così
// possiamo mostrare la denominazione reale invece del solo comune.
//
// Formato: header 32 byte → descrittori campo da 32 byte (terminati da 0x0D) →
// record a larghezza fissa (1 byte flag cancellazione + campi concatenati).

export interface SocietyInfo {
    codice: string;       // COD_SOC, es. "AL001"
    denom: string;        // DENOM, denominazione completa
    denomBreve?: string;  // DENOMBREVE
    citta?: string;       // SEDE_LOCA
    prov?: string;        // SEDE_PROV
    regione?: string;     // COD_REG
}

interface DbfField { name: string; length: number; }

const latin1 = new TextDecoder('latin1');

/** Legge un .DBF in array di record (nome campo → valore stringa trimmato). */
export function parseDbf(buffer: ArrayBuffer): Record<string, string>[] {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    const numRecords = view.getUint32(4, true);
    const headerLen = view.getUint16(8, true);
    const recordLen = view.getUint16(10, true);

    // Descrittori dei campi
    const fields: DbfField[] = [];
    let pos = 32;
    while (pos < headerLen - 1 && bytes[pos] !== 0x0d) {
        const name = latin1.decode(bytes.subarray(pos, pos + 11)).replace(/\0.*$/, '').trim();
        const length = bytes[pos + 16];
        fields.push({ name, length });
        pos += 32;
    }

    const out: Record<string, string>[] = [];
    let rec = headerLen;
    for (let i = 0; i < numRecords; i++, rec += recordLen) {
        if (rec + recordLen > bytes.length) break;
        if (bytes[rec] === 0x2a) continue; // record cancellato
        let off = rec + 1;
        const row: Record<string, string> = {};
        for (const f of fields) {
            row[f.name] = latin1.decode(bytes.subarray(off, off + f.length)).trim();
            off += f.length;
        }
        out.push(row);
    }
    return out;
}

/** Converte i record DBF dell'anagrafica società in SocietyInfo[]. */
export function parseSocietyDbf(buffer: ArrayBuffer): SocietyInfo[] {
    const rows = parseDbf(buffer);
    const byCode = new Map<string, SocietyInfo>();
    for (const r of rows) {
        const codice = (r['COD_SOC'] ?? '').toUpperCase();
        if (!codice) continue;
        byCode.set(codice, {
            codice,
            denom: r['DENOM'] ?? '',
            denomBreve: r['DENOMBREVE'] || undefined,
            citta: r['SEDE_LOCA'] || undefined,
            prov: r['SEDE_PROV'] || undefined,
            regione: r['COD_REG'] || undefined,
        });
    }
    return [...byCode.values()];
}
