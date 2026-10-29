import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/auth';
import { EventAccess } from '../common/access';
import { todayRome } from '../registrations/rules';
import { regolaOmaggi } from '../groups/group.rules';
import { combinateEvento, rimappaCombinate } from '../registrations/combinata';
import { daysBetween, nextEditionDate, nextEditionTitle, shiftPriceSteps } from './copy';
import { DayDto, EventDto, EventInfoDto, EventsQueryDto, RaceDto } from './events.dto';

type Tx = Prisma.TransactionClient;
const J = (v: unknown) => (v === undefined ? undefined : v === null ? Prisma.JsonNull : (v as Prisma.InputJsonValue));

/** Iscritti attivi per gara (esclusi i rifiutati), per mostrare "posti rimasti". */
const raceCount = {
    _count: {
        select: {
            registrations: { where: { paymentStatus: { not: PaymentStatus.REJECTED } } },
            resultRows: true, // > 0 = classifica pubblicata
        },
    },
} as const;

/** Toglie i campi interni (chiave semi-live delle gare, account di chi ha creato l'evento) prima di rispondere. */
function publicEvent<E extends { createdById?: string | null; days: { races: { syncKey?: string | null }[] }[] }>(ev: E) {
    const { createdById: _c, ...rest } = ev;
    void _c;
    return {
        ...rest,
        days: ev.days.map(d => ({
            ...d,
            races: d.races.map(({ syncKey: _k, ...r }) => { void _k; return r; }),
        })),
    };
}

export function slugify(s: string): string {
    return s
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'evento';
}

function raceData(r: RaceDto) {
    return {
        name: r.name,
        distance: r.distance,
        raceType: r.raceType,
        ente: r.ente ?? null,
        ammessi: [...new Set(r.ammessi ?? [])],
        gruppoOmaggi: J(regolaOmaggi(r.gruppoOmaggi)),
        paymentMode: r.paymentMode ?? null,
        requiresMedicalCert: r.requiresMedicalCert ?? false,
        minAge: r.minAge ?? null,
        maxAge: r.maxAge ?? null,
        price: r.price ?? 0,
        maxParticipants: r.maxParticipants ?? 0,
        isOpen: r.isOpen ?? true,
        chiusuraIscrizioni: r.chiusuraIscrizioni ? new Date(r.chiusuraIscrizioni) : null,
        maxPerSocieta: r.maxPerSocieta ?? 0,
        pettoraleDa: r.pettoraleDa ?? null,
        formSchema: J(r.formSchema ?? null),
        priceSteps: J(r.priceSteps ?? null),
        publicFields: r.publicFields ?? [],
        publicColumns: r.publicColumns ?? [],
        categories: J(r.categories ?? null),
        commission: J(r.commission ?? null),
        certificateTemplate: J(r.certificateTemplate ?? null),
    };
}

function infoData(e: EventInfoDto) {
    return {
        title: e.title,
        category: e.category,
        location: e.location,
        city: e.city,
        province: e.province,
        lat: e.lat,
        lng: e.lng,
        coverImage: e.coverImage,
        flyerUrl: e.flyerUrl,
        regulationUrl: e.regulationUrl,
        description: e.description,
        organizer: e.organizer,
        routeInfo: J(e.routeInfo),
    };
}

@Injectable()
export class EventsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly access: EventAccess,
    ) {}

    // ─── Pubblico ──────────────────────────────────────────────────────────

    /**
     * Calendario leggero e paginato: niente moduli, quote o descrizioni,
     * solo quanto serve alle card (la pagina evento carica il resto).
     */
    async list(q: EventsQueryDto) {
        const page = q.page ?? 1;
        const pageSize = Math.min(q.pageSize ?? 24, 100);
        const today = new Date(`${todayRome()}T00:00:00Z`);
        const when = q.when ?? 'upcoming';
        const where: Prisma.EventWhereInput = {};
        if (when === 'upcoming') where.days = { some: { date: { gte: today } } };
        if (when === 'past') where.days = { every: { date: { lt: today } }, some: {} };
        if (q.q?.trim()) {
            const t = q.q.trim();
            where.OR = [
                { title: { contains: t, mode: 'insensitive' } },
                { city: { contains: t, mode: 'insensitive' } },
            ];
        }
        const [total, rows] = await Promise.all([
            this.prisma.event.count({ where }),
            this.prisma.event.findMany({
                where,
                select: {
                    id: true, title: true, slug: true, category: true, city: true, province: true,
                    location: true, lat: true, lng: true, coverImage: true, isFeatured: true, isLive: true,
                    organizer: true,
                    days: {
                        orderBy: { date: 'asc' },
                        select: {
                            id: true, date: true, label: true,
                            races: {
                                select: {
                                    id: true, name: true, distance: true, price: true, isOpen: true,
                                    maxParticipants: true, ...raceCount,
                                },
                            },
                        },
                    },
                },
            }),
        ]);
        // Ordina per prima data (crescente per i prossimi, decrescente per i passati)
        const first = (e: (typeof rows)[number]) => e.days[0]?.date.getTime() ?? 0;
        rows.sort((a, b) => (when === 'past' ? first(b) - first(a) : first(a) - first(b)));
        return { total, page, pageSize, items: rows.slice((page - 1) * pageSize, page * pageSize) };
    }

    async findOne(slug: string) {
        const ev = await this.prisma.event.findUnique({
            where: { slug },
            include: {
                days: {
                    orderBy: { date: 'asc' },
                    include: { races: { include: raceCount, orderBy: { name: 'asc' } } },
                },
            },
        });
        if (!ev) throw new NotFoundException('Evento non trovato');
        return publicEvent(ev);
    }

    // ─── Gestione ──────────────────────────────────────────────────────────

    private async uniqueSlug(tx: Tx, base: string, exceptId?: string): Promise<string> {
        let slug = slugify(base);
        for (let i = 2; ; i++) {
            const hit = await tx.event.findUnique({ where: { slug }, select: { id: true } });
            if (!hit || hit.id === exceptId) return slug;
            slug = `${slugify(base)}-${i}`;
        }
    }

    async create(user: AuthUser, dto: EventDto) {
        return this.prisma.$transaction(async tx => {
            const ev = await tx.event.create({
                data: {
                    ...infoData(dto),
                    title: dto.title,
                    slug: await this.uniqueSlug(tx, dto.slug ?? dto.title),
                    category: dto.category ?? 'running',
                    location: dto.location ?? '',
                    city: dto.city ?? '',
                    province: dto.province ?? '',
                    lat: dto.lat ?? 0,
                    lng: dto.lng ?? 0,
                    organizer: dto.organizer ?? '',
                    isFeatured: dto.isFeatured ?? false,
                    isLive: dto.isLive ?? false,
                    commission: J(dto.commission ?? null),
                    createdById: user.sub,
                },
            });
            const ids = await this.syncDays(tx, ev.id, dto.days);
            await this.saveCombinate(tx, ev.id, dto.combinate, ids);
            return ev.id;
        }).then(id => this.byId(id));
    }

    /** Sostituzione completa (admin): info, flag, giornate e gare. */
    async update(id: string, dto: EventDto) {
        await this.byId(id);
        await this.prisma.$transaction(async tx => {
            await tx.event.update({
                where: { id },
                data: {
                    ...infoData(dto),
                    slug: dto.slug ? await this.uniqueSlug(tx, dto.slug, id) : undefined,
                    isFeatured: dto.isFeatured,
                    isLive: dto.isLive,
                    commission: J(dto.commission ?? null),
                },
            });
            const ids = await this.syncDays(tx, id, dto.days);
            await this.saveCombinate(tx, id, dto.combinate, ids);
        });
        return this.byId(id);
    }

    /** Solo informazioni generali: consentito anche all'organizzatore dell'evento. */
    async updateInfo(user: AuthUser, id: string, dto: EventInfoDto) {
        const ev = await this.prisma.event.findUnique({ where: { id }, select: { createdById: true } });
        if (!ev) throw new NotFoundException('Evento non trovato');
        await this.access.assert(user, id, ev.createdById);
        await this.prisma.event.update({ where: { id }, data: infoData(dto) });
        return this.byId(id);
    }

    /**
     * Nuova edizione dell'evento (admin): tutto come l'anno prima, date alla stessa
     * domenica dell'anno dopo, scaglioni spostati di conseguenza. Non si copiano
     * iscritti, classifiche, chiavi semi-live e codici sconto. Le gare partono
     * chiuse: si aprono dopo aver controllato l'evento. Gli organizzatori
     * assegnati restano assegnati anche alla nuova edizione.
     */
    async copy(id: string) {
        const src = await this.prisma.event.findUnique({
            where: { id },
            include: { days: { orderBy: { date: 'asc' }, include: { races: { orderBy: { id: 'asc' } } } } },
        });
        if (!src) throw new NotFoundException('Evento non trovato');
        if (!src.days.length) throw new ConflictException("L'evento non ha giornate da copiare");
        const first = src.days[0].date;
        const firstNew = nextEditionDate(first);
        const shift = daysBetween(first, firstNew);
        const fromYear = first.getUTCFullYear();
        const title = nextEditionTitle(src.title, fromYear, fromYear + 1);

        const newId = await this.prisma.$transaction(async tx => {
            const { id: _i, slug: _s, createdAt: _c, days, ...info } = src;
            void _i; void _s; void _c;
            const ev = await tx.event.create({
                data: {
                    ...info,
                    title,
                    slug: await this.uniqueSlug(tx, title),
                    isLive: false,
                    isFeatured: false,
                    commission: J(info.commission),
                    routeInfo: J(info.routeInfo),
                    combinate: Prisma.JsonNull, // impostate sotto, con gli id delle gare nuove
                },
            });
            const raceMap = new Map<string, string>();
            for (const d of days) {
                const day = await tx.eventDay.create({
                    data: {
                        eventId: ev.id,
                        // Stessa distanza dalla prima giornata (es. sabato + domenica restano tali)
                        date: new Date(d.date.getTime() + shift * 86_400_000),
                        label: d.label,
                    },
                });
                for (const r of d.races) {
                    const { id: _r, dayId: _d, syncKey: _k, ...race } = r;
                    void _d; void _k;
                    const nr = await tx.race.create({
                        data: {
                            ...race,
                            dayId: day.id,
                            isOpen: false,
                            chiusuraIscrizioni: race.chiusuraIscrizioni
                                ? new Date(race.chiusuraIscrizioni.getTime() + shift * 86_400_000) : null,
                            formSchema: J(race.formSchema),
                            priceSteps: J(shiftPriceSteps(race.priceSteps, shift)),
                            categories: J(race.categories),
                            commission: J(race.commission),
                            certificateTemplate: J(race.certificateTemplate),
                            gruppoOmaggi: J(race.gruppoOmaggi),
                        },
                    });
                    raceMap.set(_r, nr.id);
                }
            }
            const combinate = rimappaCombinate(combinateEvento(src.combinate), raceMap);
            if (combinate.length) await tx.event.update({ where: { id: ev.id }, data: { combinate: J(combinate) } });
            // Organizzatori assegnati all'evento: anche alla nuova edizione
            const orgs = await tx.account.findMany({ where: { assignedEventIds: { has: id } }, select: { id: true } });
            for (const o of orgs) {
                await tx.account.update({ where: { id: o.id }, data: { assignedEventIds: { push: ev.id } } });
            }
            return ev.id;
        });
        return this.byId(newId);
    }

    async remove(id: string) {
        await this.byId(id);
        const regs = await this.prisma.registration.count({ where: { eventId: id } });
        if (regs) throw new ConflictException(`Impossibile eliminare: l'evento ha ${regs} iscrizioni`);
        await this.prisma.event.delete({ where: { id } });
        return { ok: true };
    }

    async setRaceOpen(user: AuthUser, raceId: string, isOpen: boolean) {
        const race = await this.prisma.race.findUnique({
            where: { id: raceId },
            include: { day: { include: { event: { select: { id: true, createdById: true } } } } },
        });
        if (!race) throw new NotFoundException('Gara non trovata');
        await this.access.assert(user, race.day.event.id, race.day.event.createdById);
        const { syncKey: _k, ...r } = await this.prisma.race.update({ where: { id: raceId }, data: { isOpen } });
        void _k;
        return r;
    }

    private async byId(id: string) {
        const ev = await this.prisma.event.findUnique({
            where: { id },
            include: { days: { orderBy: { date: 'asc' }, include: { races: { include: raceCount } } } },
        });
        if (!ev) throw new NotFoundException('Evento non trovato');
        return publicEvent(ev);
    }

    /**
     * Allinea giornate e gare a quanto inviato: aggiorna quelle con id noto,
     * crea le nuove, elimina le mancanti. Una gara con iscrizioni non si
     * elimina mai (errore 409), così non si perdono dati per sbaglio.
     */
    /** Combinate dell'evento: id provvisori delle gare nuove → id veri; solo gare dell'evento. */
    private async saveCombinate(tx: Tx, eventId: string, raw: unknown[] | undefined, ids: Map<string, string>) {
        if (raw === undefined) return;
        const races = await tx.race.findMany({ where: { day: { eventId } }, select: { id: true } });
        const list = combinateEvento(rimappaCombinate(combinateEvento(raw), ids), new Set(races.map(r => r.id)));
        await tx.event.update({ where: { id: eventId }, data: { combinate: J(list.length ? list : null) } });
    }

    /** Restituisce gli id assegnati alle gare nuove (id inviato → id creato). */
    private async syncDays(tx: Tx, eventId: string, days: DayDto[]): Promise<Map<string, string>> {
        const created = new Map<string, string>();
        const existing = await tx.eventDay.findMany({
            where: { eventId },
            include: { races: { include: { _count: { select: { registrations: true } } } } },
        });
        const dayIds = new Set(existing.map(d => d.id));
        const raceById = new Map(existing.flatMap(d => d.races).map(r => [r.id, r]));
        const keptRaces = new Set<string>();
        const keptDays = new Set<string>();

        for (const d of days) {
            const dayData = { date: new Date(d.date), label: d.label ?? null };
            const day = d.id && dayIds.has(d.id)
                ? await tx.eventDay.update({ where: { id: d.id }, data: dayData })
                : await tx.eventDay.create({ data: { ...dayData, eventId } });
            keptDays.add(day.id);
            for (const r of d.races) {
                if (r.id && raceById.has(r.id)) {
                    await tx.race.update({ where: { id: r.id }, data: { ...raceData(r), dayId: day.id } });
                    keptRaces.add(r.id);
                } else {
                    const nr = await tx.race.create({ data: { ...raceData(r), dayId: day.id } });
                    if (r.id) created.set(r.id, nr.id);
                }
            }
        }

        const toDelete = [...raceById.values()].filter(r => !keptRaces.has(r.id));
        const blocked = toDelete.filter(r => r._count.registrations > 0);
        if (blocked.length) {
            throw new ConflictException(
                `Non puoi eliminare gare con iscrizioni: ${blocked.map(r => r.name).join(', ')}. Chiudile invece di eliminarle.`,
            );
        }
        if (toDelete.length) await tx.race.deleteMany({ where: { id: { in: toDelete.map(r => r.id) } } });
        const daysToDelete = existing.filter(d => !keptDays.has(d.id)).map(d => d.id);
        if (daysToDelete.length) await tx.eventDay.deleteMany({ where: { id: { in: daysToDelete } } });
        return created;
    }
}
