export type SportCategory = 'running' | 'cycling' | 'triathlon' | 'swimming' | 'trail' | 'other';

// ─── Form builder types ───────────────────────────────────────────────────────

export type CatalogKey =
    | 'nome' | 'cognome' | 'data_nascita' | 'anno_nascita' | 'sesso'
    | 'email' | 'telefono'
    | 'societa' | 'codice_societa'
    | 'tessera_fidal' | 'tessera_runcard' | 'tessera_fci'
    | 'tessera_csi' | 'tessera_uisp' | 'tessera_fitri' | 'tessera_fin'
    | 'tipo_certificato' | 'num_certificato' | 'scadenza_certificato' | 'gruppo_sanguigno'
    | 'taglia_maglia' | 'note'
    | 'privacy' | 'regolamento' | 'liberatoria' | 'marketing';

export type FieldType = 'text' | 'email' | 'tel' | 'date' | 'number' | 'select' | 'checkbox' | 'textarea';

export interface FieldOption {
    value: string;
    label: string;
}

export interface FormField {
    id: string;
    catalogKey?: CatalogKey;
    type: FieldType;
    label: string;
    placeholder?: string;
    required: boolean;
    options?: FieldOption[];
    helperText?: string;
    readOnly?: boolean; // e.g. anno_nascita (auto-derived)
}

export interface PriceStep {
    id: string;
    label: string;    // "Early Bird", "Standard", "Iscrizione tardiva"
    price: number;
    deadline: string; // ISO date "YYYY-MM-DD"
}

export interface RegistrationSubmission {
    id: string;
    eventId: string;
    raceId: string;
    submittedAt: string;
    formData: Record<string, string | boolean>;
    pricePaid: number;
}

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
    formSchema?: FormField[];
    priceSteps?: PriceStep[];
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

export interface ElevationPoint {
    km: number;
    elev: number; // metres ASL
}

export interface RouteInfo {
    elevationGainM: number;
    maxElevationM: number;
    minElevationM: number;
    terrain: string;
    profile: ElevationPoint[];
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
    lat: number;
    lng: number;
    coverImage: string;
    races: Race[];
    isFeatured: boolean;
    isLive: boolean;
    organizer: string;
    description?: string;
    regulationUrl?: string;
    routeInfo?: RouteInfo;
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
