// Iscrizioni di gruppo delle società: tipi e formattazione condivisi.

export interface PaymentGroupView {
    id: string;
    paymentRef: string;
    paymentMethod: string;
    paymentStatus: 'PENDING' | 'CONFIRMED' | 'REJECTED';
    societa: string;
    evento: string;
    eventSlug: string;
    gara: string;
    data: string;
    iscritti: number;
    omaggi: number;
    paganti: number;
    quota: number;
    maggiorazione: number;
    totale: number;
    createdAt: string;
    paidAt: string | null;
    causale: string;
    bank: { iban: string; intestatario?: string; banca?: string; giorni: number } | null;
    atleti: { id: string; cognome: string; nome: string; categoria?: string | null; omaggio: boolean; pricePaid: number }[];
}

export const euro = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
