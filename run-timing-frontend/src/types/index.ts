export type SportCategory = 'running' | 'cycling' | 'triathlon' | 'swimming' | 'trail' | 'other';

export interface Race {
    id: string;
    name: string;
    distance: string;
    minAge?: number;             // undefined = nessun limite inferiore
    maxAge?: number;             // undefined = nessun limite superiore
    requiresMedicalCert: boolean; // certificato medico agonistico
    price: number;
    maxParticipants: number;
    participants: number;
    isOpen: boolean;             // l'admin può aprire/chiudere
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

export interface Result {
    position: number;
    bib: string;
    athleteName: string;
    category: string;
    time: string;
    gap?: string;
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
