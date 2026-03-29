export type SportCategory = 'running' | 'cycling' | 'triathlon' | 'swimming' | 'trail' | 'other';

export type RaceType =
    | 'linear'       // gara su percorso (default)
    | 'laps_fixed'   // gara a giri fissi (criterium, pista)
    | 'laps_timed';  // gara a tempo fisso (chi fa più giri in X minuti)

export interface LapSplit {
    lap: number;
    split: string;   // tempo del singolo giro  "MM:SS"
    cum: string;     // tempo cumulativo         "H:MM:SS"
}

export interface Race {
    id: string;
    name: string;
    distance: string;
    raceType: RaceType;
    lapDistanceKm?: number;      // km per giro
    totalLaps?: number;          // per laps_fixed
    timeLimitMinutes?: number;   // per laps_timed
    minAge?: number;
    maxAge?: number;
    requiresMedicalCert: boolean;
    price: number;
    maxParticipants: number;
    participants: number;
    isOpen: boolean;
}

export type ResultStatus = 'finisher' | 'dnf' | 'dns' | 'dsq';

export interface Result {
    position: number;
    bib: string;
    athleteName: string;
    category: string;
    team?: string;
    time: string;
    gap?: string;
    status: ResultStatus;
    lapsCompleted?: number;  // per gare a giri
    lapSplits?: LapSplit[];  // tempi di ogni giro
}

export interface SpecialAward {
    label: string;   // es. "Prima donna assoluta", "Primo atleta locale"
    result: Result;
}

export interface RaceClassification {
    raceId: string;
    specials?: SpecialAward[];
}

export interface Event {
    id: string;
    title: string;
    slug: string;
    category: SportCategory;
    date: string;
    location: string;
    city: string;
    province: string;
    coverImage: string;
    races: Race[];
    isFeatured: boolean;
    isLive: boolean;
    organizer: string;
}

export interface Athlete {
    id: string;
    name: string;
    surname: string;
    birthYear: number;
    club?: string;
    avatarUrl?: string;
    totalRaces: number;
    totalPodiums: number;
}
