// Conversione tra i dati del backend (Prisma/Postgres) e i tipi del frontend.
// Il backend usa la stessa struttura Evento → Giornata → Gara, quindi la
// conversione è quasi 1:1: cambiano date (ISO), contatori e maiuscole degli enum.

import type {
    CertStatus, Event, EventDay, PaymentStatus, Race, RegistrationSubmission, SportCategory,
} from '../types';

// ─── Tipi delle risposte API ─────────────────────────────────────────────────

export interface ApiRace {
    id: string;
    name: string;
    distance: string;
    raceType?: string;
    ente?: string | null;
    paymentMode?: string | null;
    requiresMedicalCert?: boolean;
    minAge?: number | null;
    maxAge?: number | null;
    price: number;
    maxParticipants: number;
    isOpen: boolean;
    formSchema?: unknown;
    priceSteps?: unknown;
    publicFields?: string[];
    publicColumns?: string[];
    categories?: unknown;
    commission?: unknown;
    certificateTemplate?: unknown;
    _count?: { registrations: number; resultRows?: number };
}

export interface ApiDay {
    id: string;
    date: string;
    label?: string | null;
    races: ApiRace[];
}

export interface ApiEvent {
    id: string;
    title: string;
    slug: string;
    category: string;
    location: string;
    city: string;
    province: string;
    lat: number;
    lng: number;
    coverImage?: string | null;
    flyerUrl?: string | null;
    regulationUrl?: string | null;
    description?: string | null;
    isFeatured: boolean;
    isLive: boolean;
    organizer: string;
    commission?: unknown;
    routeInfo?: unknown;
    createdById?: string | null;
    days: ApiDay[];
}

export interface ApiRegistration {
    id: string;
    raceId: string;
    eventId: string;
    athleteId?: string | null;
    societyId?: string | null;
    cognome: string;
    nome: string;
    sesso: string;
    dataNascita?: string | null;
    societa?: string | null;
    codiceSocieta?: string | null;
    tessera?: string | null;
    email?: string | null;
    formData: Record<string, string | boolean>;
    pricePaid: number;
    discountAmount?: number;
    discountCode?: string | null;
    paymentMethod?: string | null;
    paymentStatus: 'PENDING' | 'CONFIRMED' | 'REJECTED';
    assignedCategory?: string | null;
    fidalVerified: boolean;
    addedByOrganizer: boolean;
    certStatus?: 'NON_RICHIESTO' | 'IN_ATTESA' | 'VERIFICATO' | 'RIFIUTATO' | null;
    submittedAt: string;
}

export interface Paged<T> {
    total: number;
    page: number;
    pageSize: number;
    items: T[];
}

// ─── Backend → frontend ──────────────────────────────────────────────────────

const opt = <T>(v: T | null | undefined): T | undefined => (v === null ? undefined : v);

export function toRace(r: ApiRace): Race {
    return {
        id: r.id,
        name: r.name,
        distance: r.distance,
        raceType: (r.raceType ?? 'linear') as Race['raceType'],
        ente: opt(r.ente) as Race['ente'],
        paymentMode: opt(r.paymentMode) as Race['paymentMode'],
        requiresMedicalCert: r.requiresMedicalCert ?? false,
        minAge: opt(r.minAge),
        maxAge: opt(r.maxAge),
        price: r.price,
        maxParticipants: r.maxParticipants,
        participants: r._count?.registrations ?? 0,
        resultsCount: r._count?.resultRows,
        isOpen: r.isOpen,
        formSchema: opt(r.formSchema) as Race['formSchema'],
        priceSteps: opt(r.priceSteps) as Race['priceSteps'],
        publicFields: r.publicFields,
        publicColumns: r.publicColumns as Race['publicColumns'],
        categories: opt(r.categories) as Race['categories'],
        commission: opt(r.commission) as Race['commission'],
        certificateTemplate: opt(r.certificateTemplate) as Race['certificateTemplate'],
    };
}

export function toDay(d: ApiDay): EventDay {
    return { id: d.id, date: d.date, label: opt(d.label), races: d.races.map(toRace) };
}

export function toEvent(e: ApiEvent): Event {
    return {
        id: e.id,
        title: e.title,
        slug: e.slug,
        category: e.category as SportCategory,
        location: e.location,
        city: e.city,
        province: e.province,
        lat: e.lat,
        lng: e.lng,
        coverImage: e.coverImage ?? '',
        flyerUrl: opt(e.flyerUrl),
        regulationUrl: opt(e.regulationUrl),
        description: opt(e.description),
        isFeatured: e.isFeatured,
        isLive: e.isLive,
        organizer: e.organizer,
        commission: opt(e.commission) as Event['commission'],
        routeInfo: opt(e.routeInfo) as Event['routeInfo'],
        days: (e.days ?? []).map(toDay),
    };
}

const PAY: Record<ApiRegistration['paymentStatus'], PaymentStatus> = {
    PENDING: 'pending', CONFIRMED: 'confirmed', REJECTED: 'rejected',
};
const CERT: Record<NonNullable<ApiRegistration['certStatus']>, CertStatus> = {
    NON_RICHIESTO: 'non_richiesto', IN_ATTESA: 'in_attesa', VERIFICATO: 'verificato', RIFIUTATO: 'rifiutato',
};

export function toRegistration(r: ApiRegistration): RegistrationSubmission {
    return {
        id: r.id,
        eventId: r.eventId,
        raceId: r.raceId,
        submittedAt: r.submittedAt,
        formData: r.formData ?? {},
        pricePaid: r.pricePaid,
        discountCode: opt(r.discountCode),
        discountAmount: r.discountAmount || undefined,
        paymentMethod: (r.paymentMethod === 'online' ? 'card' : r.paymentMethod ?? undefined) as RegistrationSubmission['paymentMethod'],
        paymentStatus: PAY[r.paymentStatus],
        assignedCategory: opt(r.assignedCategory),
        fidalVerified: r.fidalVerified,
        addedByOrganizer: r.addedByOrganizer,
        athleteAccountId: opt(r.athleteId),
        athleteName: `${r.cognome} ${r.nome}`.trim() || undefined,
        societyId: opt(r.societyId),
        certStatus: r.certStatus ? CERT[r.certStatus] : undefined,
    };
}

export const toApiPayment = (s: PaymentStatus) => s.toUpperCase() as ApiRegistration['paymentStatus'];
export const toApiCert = (s: CertStatus) => s.toUpperCase() as NonNullable<ApiRegistration['certStatus']>;

// ─── Frontend → backend ──────────────────────────────────────────────────────

/** Evento nel formato di PUT/POST /api/events (giornate e gare incluse). */
export function fromEvent(e: Event, days: EventDay[]) {
    const nn = <T>(v: T | undefined) => (v === undefined ? undefined : v);
    return {
        title: e.title,
        slug: e.slug || undefined,
        category: e.category,
        location: e.location,
        city: e.city,
        province: e.province,
        lat: Number(e.lat) || 0,
        lng: Number(e.lng) || 0,
        coverImage: e.coverImage || undefined,
        flyerUrl: e.flyerUrl || undefined,
        regulationUrl: e.regulationUrl || undefined,
        description: e.description || undefined,
        organizer: e.organizer,
        routeInfo: nn(e.routeInfo),
        isFeatured: e.isFeatured,
        isLive: e.isLive,
        commission: nn(e.commission),
        days: days.map(d => ({
            // id locali generati dal browser (non ancora salvati) vengono ignorati dal server
            id: d.id,
            date: new Date(d.date).toISOString(),
            label: d.label || undefined,
            races: d.races.map(r => ({
                id: r.id,
                name: r.name,
                distance: r.distance,
                raceType: r.raceType,
                ente: r.ente,
                paymentMode: r.paymentMode,
                requiresMedicalCert: r.requiresMedicalCert,
                minAge: r.minAge,
                maxAge: r.maxAge,
                price: Number(r.price) || 0,
                maxParticipants: Number(r.maxParticipants) || 0,
                isOpen: r.isOpen,
                formSchema: r.formSchema,
                priceSteps: r.priceSteps,
                publicFields: r.publicFields,
                publicColumns: r.publicColumns,
                categories: r.categories,
                commission: r.commission,
                certificateTemplate: r.certificateTemplate,
            })),
        })),
    };
}
