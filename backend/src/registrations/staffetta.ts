// Staffette: regole "pure" in un punto solo.
//
// Decisioni della segreteria:
// - un capitano iscrive tutta la squadra (nome squadra + dati di ogni frazionista)
//   con un solo modulo e un solo pagamento; il capitano è la frazione 1;
// - la quota è per squadra;
// - pettorale: un numero per squadra + frazione (es. 101-1, 101-2), come Race Result;
// - i frazionisti si possono cambiare fino alla chiusura delle iscrizioni.
// Le iscrizioni delle altre frazioni non si pagano da sole: seguono il capitano.

/** Metodo di pagamento delle frazioni 2..n (seguono il capitano). */
export const METODO_STAFFETTA = 'staffetta';

/** Numero di frazioni valido (2..10), altrimenti null (gara individuale). */
export function frazioniGara(v: unknown): number | null {
    const n = Number(v);
    return Number.isInteger(n) && n >= 2 && n <= 10 ? n : null;
}

/** Categoria della squadra dai sessi dei frazionisti. */
export function categoriaStaffetta(sessi: string[]): string {
    const set = new Set(sessi.map(s => s.toUpperCase()));
    if (set.size === 1 && set.has('M')) return 'Maschile';
    if (set.size === 1 && set.has('F')) return 'Femminile';
    return 'Mista';
}

/** Pettorale di una frazione per il cronometraggio, es. "101-2" (vuoto se la squadra non ha ancora il numero). */
export function pettoraleFrazione(numero: number | null | undefined, frazione: number | null | undefined): string {
    if (numero == null) return '';
    return frazione ? `${numero}-${frazione}` : String(numero);
}

/** Problemi della composizione: numero di frazionisti, nome squadra, doppioni. */
export function staffettaProblem(frazioni: number, squadra: string, atleti: { nome: string; cognome: string; dataNascita: string }[]): string | null {
    if (!squadra.trim()) return 'Indica il nome della squadra';
    if (atleti.length !== frazioni) return `La staffetta ha ${frazioni} frazioni: servono ${frazioni} frazionisti`;
    const key = (a: { nome: string; cognome: string; dataNascita: string }) =>
        `${a.cognome.trim().toUpperCase()}|${a.nome.trim().toUpperCase()}|${a.dataNascita.slice(0, 10)}`;
    if (new Set(atleti.map(key)).size !== atleti.length) return 'Lo stesso atleta compare in due frazioni';
    return null;
}
