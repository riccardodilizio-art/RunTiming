// Copia di un evento per l'edizione successiva: regole "pure" (senza DB),
// così sono testabili e si possono cambiare in un punto solo.

const DAY = 86_400_000;

/**
 * Data dell'edizione dopo: stesso giorno della settimana, nella stessa posizione
 * del mese ("la 4ª domenica di ottobre"). Se la data era anche l'ultima del mese,
 * tra "n-esima" e "ultima" si sceglie la più vicina alla stessa data dell'anno dopo
 * (domenica 25/10/2026 → domenica 24/10/2027). Così le date non scivolano negli anni.
 * L'ora resta la stessa.
 */
export function nextEditionDate(d: Date): Date {
    const year = d.getUTCFullYear() + 1;
    const month = d.getUTCMonth();
    const weekday = d.getUTCDay();
    const time = d.getTime() - Date.UTC(d.getUTCFullYear(), month, d.getUTCDate());
    const nth = Math.ceil(d.getUTCDate() / 7); // 1..5
    const daysIn = (y: number) => new Date(Date.UTC(y, month + 1, 0)).getUTCDate();
    const isLast = d.getUTCDate() + 7 > daysIn(d.getUTCFullYear());

    const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
    const firstDay = 1 + ((weekday - first + 7) % 7);
    const lastDay = firstDay + 7 * Math.floor((daysIn(year) - firstDay) / 7);
    const candidates = [Math.min(firstDay + 7 * (nth - 1), lastDay)];
    if (isLast) candidates.push(lastDay);
    const target = d.getUTCDate();
    const day = candidates.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a));
    return new Date(Date.UTC(year, month, day) + time);
}

/** Sposta una data ISO YYYY-MM-DD di n giorni (scaglioni di prezzo, scadenze). */
export function shiftYmd(ymd: string, days: number): string {
    if (!/^\d{4}-\d{2}-\d{2}/.test(ymd)) return ymd;
    const d = new Date(`${ymd.slice(0, 10)}T00:00:00Z`);
    return new Date(d.getTime() + days * DAY).toISOString().slice(0, 10);
}

/** Giorni interi tra due date (solo la parte di calendario). */
export function daysBetween(from: Date, to: Date): number {
    const f = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
    const t = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
    return Math.round((t - f) / DAY);
}

/** Titolo della nuova edizione: l'anno vecchio diventa il nuovo, altrimenti si aggiunge. */
export function nextEditionTitle(title: string, fromYear: number, toYear: number): string {
    const re = new RegExp(`\\b${fromYear}\\b`, 'g');
    return re.test(title) ? title.replace(re, String(toYear)) : `${title} ${toYear}`;
}

/** Scaglioni di prezzo con le scadenze spostate. */
export function shiftPriceSteps(steps: unknown, days: number): unknown {
    if (!Array.isArray(steps)) return steps ?? null;
    return steps.map(s => (s && typeof s === 'object' && typeof (s as { deadline?: unknown }).deadline === 'string'
        ? { ...s, deadline: shiftYmd((s as { deadline: string }).deadline, days) }
        : s));
}
