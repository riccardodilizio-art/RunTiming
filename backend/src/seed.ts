/* eslint-disable no-console */
// Dati DIMOSTRATIVI per provare il sito in locale: due eventi (uno in arrivo
// con iscrizioni aperte, uno concluso con classifica), iscritti inventati,
// un codice sconto e tre account di prova (organizzatore, atleta, società).
//
// Uso (con docker compose avviato):
//     docker compose exec backend node dist/seed.js
// oppure in sviluppo:  npm run build && node dist/seed.js
//
// - Le password NON sono nel codice: si usa DEMO_PASSWORD se impostata,
//   altrimenti ne viene generata una casuale e stampata a fine esecuzione.
// - Rieseguibile: cancella e ricrea solo i dati demo (eventi "demo-…" e
//   account "@runtiming.test"), il resto del database non viene toccato.
// - Rifiuta di girare in produzione salvo ALLOW_DEMO_SEED=true.

import { CertStatus, PaymentStatus, Prisma, PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();
const J = (v: unknown) => v as Prisma.InputJsonValue;
const DOMAIN = '@runtiming.test';
const days = (n: number) => {
    const d = new Date();
    d.setUTCHours(9, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() + n);
    return d;
};
const ymd = (d: Date) => d.toISOString().slice(0, 10);

// ─── Moduli e categorie (stessa forma del frontend) ─────────────────────────

const field = (id: string, catalogKey: string, type: string, label: string, required: boolean, options?: string[][]) => ({
    id, catalogKey, type, label, required,
    ...(options ? { options: options.map(([value, l]) => ({ value, label: l })) } : {}),
});
const FORM = [
    field('f_nome', 'nome', 'text', 'Nome', true),
    field('f_cognome', 'cognome', 'text', 'Cognome', true),
    field('f_nascita', 'data_nascita', 'date', 'Data di nascita', true),
    field('f_sesso', 'sesso', 'select', 'Sesso', true, [['M', 'Maschio'], ['F', 'Femmina']]),
    field('f_email', 'email', 'email', 'Email', true),
    field('f_societa', 'societa', 'text', 'Società sportiva', false),
    field('f_tessera', 'tessera_fidal', 'text', 'Tessera FIDAL / Runcard', false),
    field('f_taglia', 'taglia_maglia', 'select', 'Taglia maglia', false, [['S', 'S'], ['M', 'M'], ['L', 'L'], ['XL', 'XL']]),
    field('f_privacy', 'privacy', 'checkbox', 'Accetto il trattamento dei dati personali', true),
];
const mf = (name: string, minAge?: number, maxAge?: number) => [
    { id: `${name}-M`, name: `${name} M`, gender: 'M', minAge, maxAge },
    { id: `${name}-F`, name: `${name} F`, gender: 'F', minAge, maxAge },
];
const FIDAL_CATS = [
    ...mf('Senior', 18, 34), ...mf('Master 35', 35, 39), ...mf('Master 40', 40, 44), ...mf('Master 45', 45, 49),
    ...mf('Master 50', 50, 54), ...mf('Master 55', 55, 59), ...mf('Master 60', 60, 64), ...mf('Master 65', 65),
];

// ─── Persone inventate ───────────────────────────────────────────────────────

const PEOPLE: [string, string, string, string, string][] = [
    // cognome, nome, sesso, nascita, società
    ['ROSSI', 'MARIO', 'M', '1980-04-12', 'ASD DEMO RUNNERS'],
    ['BIANCHI', 'LAURA', 'F', '1988-09-03', 'ATLETICA ESEMPIO'],
    ['VERDI', 'PAOLO', 'M', '1975-01-25', 'ASD DEMO RUNNERS'],
    ['NERI', 'GIULIA', 'F', '1992-06-17', 'PODISTI DI PROVA'],
    ['GALLI', 'MARCO', 'M', '1969-11-30', 'ATLETICA ESEMPIO'],
    ['COSTA', 'ELENA', 'F', '1979-02-08', 'ASD DEMO RUNNERS'],
    ['FONTANA', 'LUCA', 'M', '1995-08-21', 'PODISTI DI PROVA'],
    ['MARINI', 'SARA', 'F', '1984-12-02', 'ATLETICA ESEMPIO'],
    ['RIZZO', 'ANDREA', 'M', '1961-05-14', 'ASD DEMO RUNNERS'],
    ['LOMBARDI', 'CHIARA', 'F', '1999-03-11', 'PODISTI DI PROVA'],
    ['MORETTI', 'DAVIDE', 'M', '1987-07-07', 'ATLETICA ESEMPIO'],
    ['BARBIERI', 'ANNA', 'F', '1970-10-19', 'ASD DEMO RUNNERS'],
];

function category(sex: string, birth: string, raceDate: Date) {
    const age = raceDate.getUTCFullYear() - Number(birth.slice(0, 4));
    return FIDAL_CATS.find(c => c.gender === sex && age >= (c.minAge ?? 0) && age <= (c.maxAge ?? 200))?.name;
}

const fmt = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h}h${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

// ─── Pulizia dei soli dati demo ──────────────────────────────────────────────

async function cleanup() {
    const events = await prisma.event.findMany({ where: { slug: { startsWith: 'demo-' } }, select: { id: true } });
    const ids = events.map(e => e.id);
    if (ids.length) {
        const races = await prisma.race.findMany({ where: { day: { eventId: { in: ids } } }, select: { id: true } });
        const raceIds = races.map(r => r.id);
        await prisma.resultRow.deleteMany({ where: { raceId: { in: raceIds } } });
        await prisma.resultUpload.deleteMany({ where: { raceId: { in: raceIds } } });
        await prisma.registration.deleteMany({ where: { eventId: { in: ids } } });
        await prisma.event.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.discountCode.deleteMany({ where: { code: 'DEMO10' } });
    // Le cascade cancellano profili, tesseramenti e società degli account demo
    await prisma.account.deleteMany({ where: { email: { endsWith: DOMAIN } } });
}

async function main() {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== 'true') {
        // L'immagine Docker gira con NODE_ENV=production anche in locale:
        // in quel caso serve il consenso esplicito (vedi docker-compose.yml).
        throw new Error('Seed demo bloccato in produzione. Imposta ALLOW_DEMO_SEED=true solo su un ambiente di prova.');
    }
    const password = process.env.DEMO_PASSWORD || randomBytes(9).toString('base64url');
    if (password.length < 8) throw new Error('DEMO_PASSWORD deve avere almeno 8 caratteri');
    const hash = await argon2.hash(password);

    await cleanup();

    // ── Evento 1: in arrivo, iscrizioni aperte ──
    const d1 = days(30);
    const ev1 = await prisma.event.create({
        data: {
            title: 'DEMO – Corri tra i Trabocchi',
            slug: 'demo-corri-tra-i-trabocchi',
            category: 'running',
            location: 'Lungomare',
            city: 'Ortona',
            province: 'CH',
            lat: 42.3555,
            lng: 14.4036,
            organizer: 'ASD Demo Organizzazione',
            description: 'Evento dimostrativo per provare iscrizioni, elenco iscritti e area organizzatore. I dati sono inventati.',
            isFeatured: true,
            days: {
                create: [{
                    date: d1,
                    races: {
                        create: [
                            {
                                name: 'Mezza maratona',
                                distance: '21,097 km',
                                raceType: 'linear',
                                ente: 'fidal',
                                paymentMode: 'both',
                                requiresMedicalCert: true,
                                minAge: 18,
                                price: 25,
                                maxParticipants: 500,
                                formSchema: J(FORM),
                                priceSteps: J([
                                    { id: 'early', label: 'Early bird', price: 18, deadline: ymd(days(10)) },
                                    { id: 'std', label: 'Quota standard', price: 22, deadline: ymd(days(25)) },
                                ]),
                                categories: J(FIDAL_CATS),
                                publicFields: ['f_cognome', 'f_nome', 'f_societa'],
                                publicColumns: ['category'],
                            },
                            {
                                name: 'Non competitiva 5 km',
                                distance: '5 km',
                                raceType: 'linear',
                                ente: 'non_competitiva',
                                paymentMode: 'onsite',
                                price: 8,
                                maxParticipants: 0,
                                formSchema: J(FORM.filter(f => f.catalogKey !== 'tessera_fidal')),
                                publicFields: ['f_cognome', 'f_nome'],
                                publicColumns: [],
                            },
                        ],
                    },
                }],
            },
        },
        include: { days: { include: { races: true } } },
    });
    const [half, fun] = ev1.days[0].races;

    // ── Evento 2: concluso, con classifica ufficiale ──
    const d2 = days(-10);
    const ev2 = await prisma.event.create({
        data: {
            title: "DEMO – Trofeo d'autunno",
            slug: 'demo-trofeo-d-autunno',
            category: 'running',
            location: 'Centro storico',
            city: 'Lanciano',
            province: 'CH',
            lat: 42.2306,
            lng: 14.3897,
            organizer: 'ASD Demo Organizzazione',
            description: 'Evento dimostrativo concluso: serve a provare la pagina Risultati.',
            days: {
                create: [{
                    date: d2,
                    races: {
                        create: [{
                            name: '10 km',
                            distance: '10 km',
                            raceType: 'linear',
                            ente: 'fidal',
                            paymentMode: 'onsite',
                            price: 10,
                            isOpen: false,
                            formSchema: J(FORM),
                            categories: J(FIDAL_CATS),
                            publicFields: ['f_cognome', 'f_nome', 'f_societa'],
                            publicColumns: ['category'],
                        }],
                    },
                }],
            },
        },
        include: { days: { include: { races: true } } },
    });
    const tenK = ev2.days[0].races[0];

    // ── Account di prova ──
    const organizer = await prisma.account.create({
        data: {
            email: `organizzatore${DOMAIN}`, passwordHash: hash, role: Role.ORGANIZER,
            displayName: 'Organizzatore Demo', assignedEventIds: [ev1.id, ev2.id],
        },
    });
    const athleteAcc = await prisma.account.create({
        data: { email: `atleta${DOMAIN}`, passwordHash: hash, role: Role.ATHLETE, displayName: 'Mario Rossi' },
    });
    const athlete = await prisma.athleteProfile.create({
        data: {
            accountId: athleteAcc.id, nome: 'Mario', cognome: 'Rossi', dataNascita: new Date('1980-04-12'),
            sesso: 'M', club: 'ASD DEMO RUNNERS', certType: 'agonistico', certExpiry: days(200),
            certStatus: CertStatus.VERIFICATO,
            affiliations: {
                create: [{ ente: 'fidal', societaNome: 'ASD DEMO RUNNERS', codiceSocieta: 'CH000', numeroTessera: 'DEMO0001', source: 'manual' }],
            },
        },
    });
    const societyAcc = await prisma.account.create({
        data: { email: `societa${DOMAIN}`, passwordHash: hash, role: Role.SOCIETY, displayName: 'Paolo Verdi' },
    });
    await prisma.society.create({
        data: {
            accountId: societyAcc.id, societaNome: 'ASD DEMO RUNNERS', ente: 'fidal', codiceFidal: 'CH000',
            roster: J(PEOPLE.filter(p => p[4] === 'ASD DEMO RUNNERS').map(([cognome, nome, sesso, nascita], i) => ({
                id: `demo-roster-${i}`, nome, cognome, dataNascita: nascita, sesso, source: 'manual',
                affiliations: [{ id: `demo-aff-${i}`, ente: 'fidal', societaNome: 'ASD DEMO RUNNERS', codiceSocieta: 'CH000', numeroTessera: `DEMO${1000 + i}` }],
            }))),
        },
    });

    // ── Iscrizioni all'evento 1 ──
    const regs = PEOPLE.slice(0, 8).map(([cognome, nome, sesso, nascita, societa], i) => {
        const race = i < 6 ? half : fun;
        const isAthlete = cognome === 'ROSSI';
        return {
            raceId: race.id, eventId: ev1.id, athleteId: isAthlete ? athlete.id : null,
            cognome, nome, sesso, dataNascita: new Date(nascita), societa,
            tessera: race === half ? `DEMO${2000 + i}` : null,
            email: `${nome.toLowerCase()}.${cognome.toLowerCase()}${DOMAIN}`,
            formData: J({ f_nome: nome, f_cognome: cognome, f_nascita: nascita, f_sesso: sesso, f_societa: societa, f_taglia: 'M', f_privacy: true }),
            basePrice: race.price, pricePaid: race.price,
            paymentMethod: race === half ? 'online' : 'onsite',
            paymentStatus: i % 3 === 2 ? PaymentStatus.PENDING : PaymentStatus.CONFIRMED,
            assignedCategory: race === half ? category(sesso, nascita, d1) : null,
            fidalVerified: race === half,
            certStatus: race === half ? CertStatus.VERIFICATO : CertStatus.NON_RICHIESTO,
        };
    });
    await prisma.registration.createMany({ data: regs });

    // ── Classifica ufficiale dell'evento 2 (con intermedio a 5 km) ──
    const finishers = PEOPLE.map(([cognome, nome, sesso, nascita, societa], i) => {
        const total = 2280 + i * 97 + (sesso === 'F' ? 140 : 0);
        return { cognome, nome, sesso, nascita, societa, total, half: Math.round(total * 0.49) };
    }).sort((a, b) => a.total - b.total);
    const best = finishers[0].total;
    const results = [
        ...finishers.map((p, i) => ({
            position: i + 1, bib: String(101 + PEOPLE.findIndex(x => x[0] === p.cognome)),
            athleteName: `${p.cognome}, ${p.nome}`, category: category(p.sesso, p.nascita, d2) ?? '',
            team: p.societa, time: fmt(p.total), gap: i ? `+${fmt(p.total - best).replace(/^0h/, '')}` : '--',
            status: 'finisher', lapSplits: [{ lap: 1, split: '5K', cum: fmt(p.half) }],
        })),
        { position: 0, bib: '199', athleteName: 'ESPOSITO, FABIO', category: 'Master 40 M', team: 'PODISTI DI PROVA', time: '', status: 'dnf', lapSplits: [{ lap: 1, split: '5K', cum: '0h24:10' }] },
    ];
    const up = await prisma.resultUpload.create({
        data: { raceId: tenK.id, fileName: 'demo', columnMapping: J({}), status: 'final', source: 'upload' },
    });
    await prisma.resultRow.createMany({
        data: results.map((r, i) => ({ uploadId: up.id, raceId: tenK.id, section: r.category || null, position: i + 1, data: J(r) })),
    });

    await prisma.discountCode.create({
        data: { code: 'DEMO10', description: 'Sconto dimostrativo 10%', type: 'percent', value: 10, isActive: true },
    });

    console.log('\n✔ Dati dimostrativi creati');
    console.log(`  Eventi: "${ev1.title}" (iscrizioni aperte) e "${ev2.title}" (concluso, classifica)`);
    console.log(`  Iscritti demo: ${regs.length} · Classifica: ${results.length} righe · Codice sconto: DEMO10`);
    console.log(`  Organizzatore: ${organizer.email}  (eventi assegnati: entrambi)`);
    console.log('\n  Account di prova (stessa password per tutti):');
    console.log(`    organizzatore  ${organizer.email}`);
    console.log(`    atleta         ${athleteAcc.email}`);
    console.log(`    società        ${societyAcc.email}`);
    console.log(`    password       ${password}${process.env.DEMO_PASSWORD ? '  (da DEMO_PASSWORD)' : '  (generata ora: annotala)'}`);
    console.log("\n  L'admin è quello di ADMIN_EMAIL / ADMIN_PASSWORD nel .env.\n");
}

main()
    .catch(e => {
        console.error('✘ Seed non riuscito:', e instanceof Error ? e.message : e);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
