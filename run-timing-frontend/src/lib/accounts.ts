// Account atleta e società sul backend: conversione dei profili e chiamate.
// Usato dai context AthleteAuth / SocietyAuth quando USE_API è attivo.

import type { Affiliation, AppUser, AthleteAccount, CertStatus, RaceEnte, RosterAthlete, SocietyAccount } from '../types';
import { affiliationsFromLegacy } from '../components/athlete/affiliations';
import { ApiError, api, setAuthToken } from './api';
import { takeCaptchaToken } from './captcha';
import { listBySociety } from '../data/fidalLookup';
import { fidalToRoster } from '../pages/society/rosterUtils';

interface ApiAffiliation {
    id: string;
    ente: string;
    societaNome: string;
    codiceSocieta?: string | null;
    numeroTessera?: string | null;
    certScadenza?: string | null;
    source?: string | null;
}

interface ApiAthleteProfile {
    id: string;
    nome: string;
    cognome: string;
    dataNascita: string;
    sesso: string;
    codFiscale?: string | null;
    phone?: string | null;
    club?: string | null;
    certType?: string | null;
    certExpiry?: string | null;
    certStatus?: 'NON_RICHIESTO' | 'IN_ATTESA' | 'VERIFICATO' | 'RIFIUTATO' | null;
    affiliations: ApiAffiliation[];
}

interface ApiSociety {
    id: string;
    societaNome: string;
    ente: string;
    codiceFidal?: string | null;
    roster: RosterAthlete[];
    createdAt: string;
}

interface ApiMe {
    id: string;
    email: string;
    role: string;
    displayName?: string | null;
    createdAt: string;
}

const day = (iso?: string | null) => (iso ? iso.slice(0, 10) : undefined);

// ─── Atleta ──────────────────────────────────────────────────────────────────

export function toAthlete(me: ApiMe, p: ApiAthleteProfile | null): AthleteAccount {
    const [name = '', ...rest] = (me.displayName ?? '').split(' ');
    return {
        // L'id è quello del PROFILO: le iscrizioni del server lo usano come athleteId
        id: p?.id ?? me.id,
        email: me.email,
        password: '',
        name: p?.nome ?? name,
        surname: p?.cognome ?? rest.join(' '),
        birthDate: day(p?.dataNascita) ?? '',
        gender: (p?.sesso as 'M' | 'F') ?? 'M',
        phone: p?.phone ?? undefined,
        club: p?.club ?? undefined,
        codFiscale: p?.codFiscale ?? undefined,
        affiliations: (p?.affiliations ?? []).map(a => ({
            id: a.id,
            ente: a.ente as RaceEnte,
            societaNome: a.societaNome,
            codiceSocieta: a.codiceSocieta ?? undefined,
            numeroTessera: a.numeroTessera ?? undefined,
            certScadenza: day(a.certScadenza),
            source: (a.source as Affiliation['source']) ?? 'manual',
        })),
        certType: (p?.certType as AthleteAccount['certType']) ?? undefined,
        certExpiry: day(p?.certExpiry),
        certStatus: p?.certStatus ? (p.certStatus.toLowerCase() as CertStatus) : undefined,
        createdAt: me.createdAt,
    };
}

function profileBody(a: AthleteAccount) {
    const affs = a.affiliations ?? affiliationsFromLegacy(a.fidalTessera, a.runcardTessera, a.club);
    return {
        nome: a.name,
        cognome: a.surname,
        dataNascita: a.birthDate,
        sesso: a.gender,
        codFiscale: a.codFiscale || undefined,
        phone: a.phone || undefined,
        club: a.club || undefined,
        certType: a.certType || undefined,
        certExpiry: a.certType ? a.certExpiry || undefined : undefined,
        affiliations: affs.map(x => ({
            ente: x.ente,
            societaNome: x.societaNome || a.club || 'N/D',
            codiceSocieta: x.codiceSocieta || undefined,
            numeroTessera: x.numeroTessera || undefined,
            certScadenza: x.certScadenza || undefined,
        })),
    };
}

/** Rilegge account + profilo dal server. */
export async function fetchAthlete(): Promise<AthleteAccount> {
    const me = await api.get<ApiMe>('/auth/me');
    const p = await api.get<ApiAthleteProfile | null>('/athletes/me');
    return toAthlete(me, p);
}

export async function loginAthleteApi(email: string, password: string): Promise<AthleteAccount | null> {
    try {
        const r = await api.post<{ accessToken: string; role: string }>('/auth/login', { email, password });
        if (r.role !== 'ATHLETE') return null;
        setAuthToken(r.accessToken);
        return await fetchAthlete();
    } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
    }
}

export async function registerAthleteApi(data: Omit<AthleteAccount, 'id' | 'createdAt'>): Promise<AthleteAccount> {
    const r = await api.post<{ accessToken: string }>('/auth/register', {
        email: data.email,
        password: data.password,
        displayName: `${data.name} ${data.surname}`.trim(),
        role: 'ATHLETE',
        captchaToken: takeCaptchaToken(),
    });
    setAuthToken(r.accessToken);
    await api.put('/athletes/me', profileBody({ ...data, id: '', createdAt: '' }));
    return fetchAthlete();
}

export async function saveAthleteApi(a: AthleteAccount): Promise<AthleteAccount> {
    await api.put('/athletes/me', profileBody(a));
    return fetchAthlete();
}

// ─── Società ─────────────────────────────────────────────────────────────────

function toSociety(me: ApiMe, s: ApiSociety | null): SocietyAccount {
    const [presidentName = '', ...rest] = (me.displayName ?? '').split(' ');
    return {
        id: s?.id ?? me.id,
        email: me.email,
        password: '',
        presidentName,
        presidentSurname: rest.join(' '),
        societaNome: s?.societaNome ?? '',
        ente: (s?.ente as RaceEnte) ?? 'fidal',
        codiceFidal: s?.codiceFidal ?? undefined,
        roster: s?.roster ?? [],
        createdAt: s?.createdAt ?? me.createdAt,
    };
}

const societyBody = (s: Pick<SocietyAccount, 'societaNome' | 'ente' | 'codiceFidal' | 'roster'>) => ({
    societaNome: s.societaNome,
    ente: s.ente,
    codiceFidal: s.codiceFidal || undefined,
    roster: s.roster,
});

export async function fetchSociety(): Promise<SocietyAccount> {
    const me = await api.get<ApiMe>('/auth/me');
    const s = await api.get<ApiSociety | null>('/societies/me');
    return toSociety(me, s);
}

export async function loginSocietyApi(email: string, password: string): Promise<SocietyAccount | null> {
    try {
        const r = await api.post<{ accessToken: string; role: string }>('/auth/login', { email, password });
        if (r.role !== 'SOCIETY') return null;
        setAuthToken(r.accessToken);
        return await fetchSociety();
    } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
    }
}

export async function registerSocietyApi(
    data: Omit<SocietyAccount, 'id' | 'createdAt' | 'roster'> & { roster?: RosterAthlete[] },
): Promise<SocietyAccount> {
    const r = await api.post<{ accessToken: string }>('/auth/register', {
        email: data.email,
        password: data.password,
        displayName: `${data.presidentName} ${data.presidentSurname}`.trim(),
        role: 'SOCIETY',
        captchaToken: takeCaptchaToken(),
    });
    setAuthToken(r.accessToken);
    let roster = data.roster ?? [];
    // L'anagrafica FIDAL si legge solo da autenticati: il roster della società
    // si importa ora che l'account esiste (e solo per il proprio codice)
    if (!roster.length && data.ente === 'fidal' && data.codiceFidal) {
        await api.put('/societies/me', societyBody({ ...data, roster: [] }));
        try { roster = (await listBySociety(data.codiceFidal)).map(fidalToRoster); } catch { /* importabile dalla dashboard */ }
    }
    await api.put('/societies/me', societyBody({ ...data, roster }));
    return fetchSociety();
}

export async function saveSocietyApi(s: SocietyAccount): Promise<SocietyAccount> {
    await api.put('/societies/me', societyBody(s));
    return fetchSociety();
}

// ─── Admin: atleti e account staff ───────────────────────────────────────────

/** Tutti gli atleti registrati (per la verifica dei certificati). */
export async function listAthletesApi(): Promise<AthleteAccount[]> {
    const out: AthleteAccount[] = [];
    for (let page = 1; ; page++) {
        const rows = await api.get<(ApiAthleteProfile & { account: { email: string } })[]>(`/athletes?page=${page}`);
        out.push(...rows.map(p => toAthlete({ id: p.id, email: p.account.email, role: 'ATHLETE', createdAt: '' }, p)));
        if (rows.length < 50) break;
    }
    return out;
}

export function decideCertApi(athleteId: string, status: 'verificato' | 'rifiutato') {
    return api.patch(`/athletes/${athleteId}/cert`, { certStatus: status.toUpperCase() });
}

interface ApiStaff {
    id: string;
    email: string;
    role: string;
    displayName?: string | null;
    assignedEventIds: string[];
}

export async function listOrganizersApi(): Promise<AppUser[]> {
    const rows = await api.get<ApiStaff[]>('/accounts');
    return rows
        .filter(r => r.role === 'ORGANIZER')
        .map(r => ({
            id: r.id,
            username: r.email,
            password: '',
            displayName: r.displayName || r.email,
            role: 'organizer' as const,
            assignedEventIds: r.assignedEventIds,
            isActive: true,
        }));
}

/** Crea (email + password) o aggiorna (nome ed eventi assegnati) un organizzatore. */
export async function saveOrganizerApi(u: AppUser, isNew: boolean): Promise<void> {
    if (isNew) {
        await api.post('/accounts', {
            email: u.username,
            password: u.password,
            role: 'ORGANIZER',
            displayName: u.displayName,
            assignedEventIds: u.assignedEventIds,
        });
    } else {
        await api.patch(`/accounts/${u.id}`, { displayName: u.displayName, assignedEventIds: u.assignedEventIds });
    }
}
