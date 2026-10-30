// Staffetta: dati del modulo squadra (il capitano iscrive tutti).

export interface Frazionista {
    nome: string;
    cognome: string;
    dataNascita: string;
    sesso: 'M' | 'F' | '';
    tessera: string;
    email: string;
}

export interface Squadra {
    squadra: string;
    frazionisti: Frazionista[];
}

export const nuovoFrazionista = (): Frazionista => ({ nome: '', cognome: '', dataNascita: '', sesso: '', tessera: '', email: '' });

export function squadraVuota(frazioni: number): Squadra {
    return { squadra: '', frazionisti: Array.from({ length: frazioni }, nuovoFrazionista) };
}

/** Errori del modulo squadra (vuoto = ok). L'email serve solo al capitano. */
export function erroriSquadra(s: Squadra, emailCapitano: boolean): string[] {
    const out: string[] = [];
    if (!s.squadra.trim()) out.push('Indica il nome della squadra');
    s.frazionisti.forEach((f, i) => {
        if (!f.nome.trim() || !f.cognome.trim() || !f.dataNascita || !f.sesso) out.push(`Frazione ${i + 1}: nome, cognome, data di nascita e sesso`);
    });
    if (emailCapitano && !s.frazionisti[0]?.email.trim()) out.push("Frazione 1 (capitano): serve l'email per la conferma");
    return out;
}
