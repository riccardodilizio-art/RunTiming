export type SportCategory = 'running' | 'cycling' | 'triathlon' | 'swimming' | 'trail' | 'other';

// ─── Form builder types ───────────────────────────────────────────────────────

export type CatalogKey =
    | 'nome' | 'cognome' | 'data_nascita' | 'anno_nascita' | 'sesso'
    | 'email' | 'telefono' | 'codice_fiscale'
    | 'societa' | 'codice_societa'
    | 'tessera_fidal' | 'tessera_runcard' | 'tessera_fci'
    | 'tessera_csi' | 'tessera_uisp' | 'tessera_fitri' | 'tessera_fin'
    | 'tipo_certificato' | 'num_certificato' | 'scadenza_certificato' | 'gruppo_sanguigno'
    | 'upload_cert_medico' | 'upload_tessera'
    | 'taglia_maglia' | 'note'
    | 'privacy' | 'regolamento' | 'liberatoria' | 'marketing';

export type FieldType = 'text' | 'email' | 'tel' | 'date' | 'number' | 'select' | 'checkbox' | 'textarea' | 'file';

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
    readOnly?: boolean;
    accept?: string;   // per file: es. "application/pdf,image/*"
}

export interface PriceStep {
    id: string;
    label: string;
    price: number;
    deadline: string;
}

export type PaymentStatus = 'pending' | 'confirmed' | 'rejected';

/** Stato verifica certificato medico */
export type CertStatus = 'non_richiesto' | 'in_attesa' | 'verificato' | 'rifiutato';

/** Dati certificato medico inseriti dall'atleta (non-FIDAL) */
export interface CertInfo {
    tipo: 'agonistico' | 'non_agonistico' | 'esenzione';
    scadenza: string;       // ISO date YYYY-MM-DD
    numero?: string;
    /** Nome file selezionato (UI only — storage gestito dal backend) */
    fileName?: string;
}

export interface RegistrationSubmission {
    id: string;
    eventId: string;
    raceId: string;
    submittedAt: string;
    formData: Record<string, string | boolean>;
    pricePaid: number;
    discountCode?: string;
    discountAmount?: number;
    paymentMethod?: 'paypal' | 'card' | 'free' | 'manual';
    paymentStatus: PaymentStatus;
    assignedCategory?: string;
    fidalVerified?: boolean;
    addedByOrganizer?: boolean;
    athleteAccountId?: string;   // collegato all'account atleta se loggato
    certStatus?: CertStatus;
    certInfo?: CertInfo;
    certRejectionReason?: string;
}

// ─── Athlete account (public users) ──────────────────────────────────────────

export interface AthleteAccount {
    id: string;
    email: string;
    password: string;           // plain text — backend lo hashierà
    name: string;
    surname: string;
    birthDate: string;          // ISO YYYY-MM-DD (anno calcolato da questo)
    gender: 'M' | 'F';
    phone?: string;
    club?: string;
    codFiscale?: string;
    fidalTessera?: string;
    runcardTessera?: string;
    /** Certificato medico — verificato una volta, valido per tutte le gare */
    certType?: 'agonistico' | 'non_agonistico' | 'esenzione';
    certExpiry?: string;        // ISO YYYY-MM-DD
    certNumber?: string;
    certStatus?: CertStatus;    // verificato dall'admin una volta sola
    certFileName?: string;      // UI-only fino al backend
    createdAt: string;
}

export interface DiscountCode {
    id: string;
    code: string;
    description?: string;
    type: 'fixed' | 'percent';
    value: number;
    maxUses?: number;
    usedCount: number;
    expiresAt?: string;
    isActive: boolean;
}

export interface CommissionConfig {
    fixedFee: number;
    percentFee: number;
    appliedTo: 'buyer' | 'organizer';
}

// ─── Race categories ──────────────────────────────────────────────────────────

export interface RaceCategory {
    id: string;
    name: string;          // es. "Senior M", "Master 40 F", "Assoluta"
    gender?: 'M' | 'F';   // undefined = tutti i sessi
    minAge?: number;
    maxAge?: number;
}

/** Restituisce la categoria corrispondente all'atleta, o null se nessuna corrisponde */
export function assignCategory(
    categories: RaceCategory[],
    birthYear: number,
    gender: string
): RaceCategory | null {
    const age = new Date().getFullYear() - birthYear;
    for (const cat of categories) {
        if (cat.gender && cat.gender !== gender) continue;
        if (cat.minAge !== undefined && age < cat.minAge) continue;
        if (cat.maxAge !== undefined && age > cat.maxAge) continue;
        return cat;
    }
    return null;
}

export type RaceType =
    | 'linear'
    | 'laps_fixed'
    | 'laps_timed';

export interface LapSplit {
    lap: number;
    split: string;
    cum: string;
}

export interface Race {
    id: string;
    name: string;
    distance: string;
    raceType: RaceType;
    lapDistanceKm?: number;
    totalLaps?: number;
    timeLimitMinutes?: number;
    minAge?: number;
    maxAge?: number;
    requiresMedicalCert: boolean;
    price: number;
    maxParticipants: number;
    participants: number;
    isOpen: boolean;
    formSchema?: FormField[];
    priceSteps?: PriceStep[];
    publicFields?: string[];
    categories?: RaceCategory[];   // categorie agonistiche per questa gara
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
    lapsCompleted?: number;
    lapSplits?: LapSplit[];
}

export interface SpecialAward {
    label: string;
    result: Result;
}

export interface RaceClassification {
    raceId: string;
    specials?: SpecialAward[];
}

export interface ElevationPoint {
    km: number;
    elev: number;
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
    email?: string;
    phone?: string;
    gender?: 'M' | 'F';
    notes?: string;
}

// ─── Auth / Users ─────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'organizer';

export interface AppUser {
    id: string;
    username: string;
    /** stored as plain string — in production this would be hashed */
    password: string;
    displayName: string;
    role: UserRole;
    /** IDs of events the organizer is allowed to manage (ignored for admin) */
    assignedEventIds: string[];
    isActive: boolean;
}
