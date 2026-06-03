import type { Event, EventDay, Race } from '../types';

/**
 * Normalizza un evento alla struttura multi-giorno canonica.
 * - Se ha `days`, li usa.
 * - Altrimenti costruisce un'unica giornata dai campi legacy `date`/`races`.
 *
 * Tutto il resto dell'app dovrebbe leggere gare/date di un evento tramite
 * questi helper, mai accedendo direttamente a `event.races` / `event.date`.
 */
export function eventDays(e: Event): EventDay[] {
    if (e.days && e.days.length > 0) return e.days;
    return [{
        id: `${e.id}-d1`,
        date: e.date ?? '',
        races: e.races ?? [],
    }];
}

/** Tutte le gare dell'evento, attraverso tutte le giornate. */
export function allRaces(e: Event): Race[] {
    return eventDays(e).flatMap(d => d.races);
}

/** Data di inizio (giornata più vicina). */
export function eventStartDate(e: Event): string {
    const dates = eventDays(e).map(d => d.date).filter(Boolean).sort();
    return dates[0] ?? '';
}

/** Data di fine (giornata più lontana). */
export function eventEndDate(e: Event): string {
    const dates = eventDays(e).map(d => d.date).filter(Boolean).sort();
    return dates[dates.length - 1] ?? '';
}

/** True se l'evento si svolge su più giornate. */
export function isMultiDay(e: Event): boolean {
    return eventDays(e).length > 1;
}

/** Trova una gara per id in qualunque giornata dell'evento. */
export function findRaceInEvent(e: Event, raceId: string): Race | undefined {
    return allRaces(e).find(r => r.id === raceId);
}
