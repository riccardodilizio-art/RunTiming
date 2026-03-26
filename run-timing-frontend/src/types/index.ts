export type SportCategory = 'running' | 'cycling' | 'triathlon' | 'swimming' | 'trail' | 'other';

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
    participants: number;
    maxParticipants: number;
    distances: string[];
    price: number;
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