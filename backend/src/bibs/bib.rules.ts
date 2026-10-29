// Pettorali: regole "pure" (senza DB), in un punto solo.
// Criterio della segreteria: per gara, poi società, poi cognome e nome.

export interface BibReg {
    id: string;
    societa: string | null;
    cognome: string;
    nome: string;
    pettorale: number | null;
}

const norm = (s: string | null | undefined) =>
    (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();

/** Ordine: società (senza società in fondo), cognome, nome. */
export function ordinePettorali(a: BibReg, b: BibReg): number {
    const sa = norm(a.societa), sb = norm(b.societa);
    if (!sa !== !sb) return sa ? -1 : 1;
    return sa.localeCompare(sb, 'it') || norm(a.cognome).localeCompare(norm(b.cognome), 'it') || norm(a.nome).localeCompare(norm(b.nome), 'it');
}

/**
 * Assegna i pettorali alla gara.
 * - "tutti": riassegna a tutti gli iscritti, da `da` in poi;
 * - "nuovi": tiene quelli già dati e assegna solo a chi non ce l'ha, dopo l'ultimo usato.
 * `occupati` = pettorali usati da altre gare dell'evento: si saltano.
 * Restituisce id → pettorale per chi cambia.
 */
export function assegnaPettorali(
    regs: BibReg[], opts: { da: number; modo: 'tutti' | 'nuovi'; occupati: Set<number> },
): Map<string, number> {
    const out = new Map<string, number>();
    const usati = new Set(opts.occupati);
    let targets: BibReg[];
    let n = opts.da;
    if (opts.modo === 'tutti') {
        targets = [...regs].sort(ordinePettorali);
    } else {
        const gia = regs.filter(r => r.pettorale != null).map(r => r.pettorale as number);
        gia.forEach(p => usati.add(p));
        targets = regs.filter(r => r.pettorale == null).sort(ordinePettorali);
        if (gia.length) n = Math.max(n, Math.max(...gia) + 1);
    }
    for (const r of targets) {
        while (usati.has(n)) n++;
        if (r.pettorale !== n) out.set(r.id, n);
        usati.add(n);
        n++;
    }
    return out;
}
