import { inflateRawSync } from 'zlib';

// Lettore .zip minimale (solo lettura, metodi "stored" e "deflate"), senza
// dipendenze: serve a caricare direttamente gli zip scaricati dal portale FIDAL.

export interface ZipEntry {
    name: string;
    data: Buffer;
}

const MAX_ENTRY = 300 * 1024 * 1024; // 300 MB decompressi per file: oltre è sospetto

export const isZip = (buf: Buffer) => buf.length > 4 && buf.readUInt32LE(0) === 0x04034b50;

/** Estrae i file di uno zip. Lancia un errore se lo zip è danneggiato o non supportato. */
export function unzip(buf: Buffer): ZipEntry[] {
    // Fine della "central directory": cercata negli ultimi 64 KB
    let eocd = -1;
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
        if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('File zip non valido');
    const count = buf.readUInt16LE(eocd + 10);
    let p = buf.readUInt32LE(eocd + 16);
    const out: ZipEntry[] = [];
    for (let n = 0; n < count; n++) {
        if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('File zip non valido');
        const method = buf.readUInt16LE(p + 10);
        const compSize = buf.readUInt32LE(p + 20);
        const size = buf.readUInt32LE(p + 24);
        const nameLen = buf.readUInt16LE(p + 28);
        const extraLen = buf.readUInt16LE(p + 30);
        const commentLen = buf.readUInt16LE(p + 32);
        const localOff = buf.readUInt32LE(p + 42);
        const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
        p += 46 + nameLen + extraLen + commentLen;
        if (name.endsWith('/')) continue; // cartella
        if (size > MAX_ENTRY) throw new Error(`File troppo grande nello zip: ${name}`);
        if (buf.readUInt32LE(localOff) !== 0x04034b50) throw new Error('File zip non valido');
        const start = localOff + 30 + buf.readUInt16LE(localOff + 26) + buf.readUInt16LE(localOff + 28);
        const raw = buf.subarray(start, start + compSize);
        let data: Buffer;
        if (method === 0) data = Buffer.from(raw);
        else if (method === 8) data = inflateRawSync(raw, { maxOutputLength: MAX_ENTRY });
        else throw new Error(`Compressione zip non supportata (${method}) in ${name}`);
        out.push({ name, data });
    }
    return out;
}

/** CSV contenuti in un file caricato: lo zip viene aperto, un CSV resta com'è. */
export function csvFiles(buf: Buffer, filename: string): ZipEntry[] {
    if (isZip(buf)) {
        const files = unzip(buf).filter(e => /\.csv$/i.test(e.name));
        if (files.length === 0) throw new Error('Lo zip non contiene file CSV');
        return files;
    }
    return [{ name: filename, data: buf }];
}
