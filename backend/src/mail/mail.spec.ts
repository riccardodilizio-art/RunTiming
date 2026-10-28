import { MailService } from './mail.service';
import { RegistrationMailer } from './registration-mailer';
import { cancelledMail, passwordResetMail, registrationMail, RegMailData } from './templates';

// Nomi e dati inventati.
const base: RegMailData = {
    nome: 'LUCA', cognome: 'VERDI', evento: 'Corsa di Prova', gara: '10 km', data: new Date('2026-11-15'),
    categoria: 'SM35', importo: 21, metodo: 'bank', stato: 'PENDING', paymentRef: 'RT-ABCD1234', obbligatorio: true,
    bank: { iban: 'IT60X0542811101000000123456', intestatario: 'TimingRun', banca: 'Banca Prova', giorni: 5 },
    siteUrl: 'https://timingrun.it',
};

describe('testi email', () => {
    it('bonifico: IBAN, causale con codice e cognome, importo, link pagamento, avviso pagamento anticipato', () => {
        const m = registrationMail(base);
        expect(m.subject).toBe('Iscrizione ricevuta: dati per il bonifico – Corsa di Prova');
        for (const s of ['IT60X0542811101000000123456', 'RT-ABCD1234 VERDI', '21,00', 'entro 5 giorni', 'https://timingrun.it/pagamento/RT-ABCD1234', 'pagamento anticipato']) {
            expect(m.html).toContain(s);
            expect(m.text).toContain(s);
        }
        expect(m.html).toContain('Segreteria – TimingRun');
    });

    it('iscrizione gratuita / già pagata: confermata, niente dati di pagamento', () => {
        const m = registrationMail({ ...base, stato: 'CONFIRMED', metodo: 'free', paymentRef: null, bank: null });
        expect(m.subject).toBe('Iscrizione confermata – Corsa di Prova');
        expect(m.html).not.toContain('IBAN');
    });

    it('pagamento sul posto', () => {
        const m = registrationMail({ ...base, metodo: 'onsite', bank: null, obbligatorio: false });
        expect(m.text).toContain('si paga sul posto');
    });

    it('[sicurezza] i dati inseriti da chi si iscrive non diventano HTML o link', () => {
        const m = registrationMail({ ...base, nome: '<a href="https://phishing.example">clicca</a>', evento: 'Gara <script>x</script>' });
        expect(m.html).not.toContain('<a href="https://phishing.example">');
        expect(m.html).not.toContain('<script>');
        expect(m.html.toLowerCase()).toContain('&lt;a href=&quot;https://phishing.example&quot;&gt;');
    });

    it('[sicurezza] niente a capo nell\'oggetto (nessuna intestazione aggiunta)', () => {
        const m = cancelledMail({ ...base, evento: 'Gara\r\nBcc: tutti@example.com' }, 'mancato_pagamento');
        expect(m.subject).not.toMatch(/[\r\n]/);
    });

    it('recupero password: link e durata', () => {
        const m = passwordResetMail('https://timingrun.it/reimposta-password?token=abc', 60);
        expect(m.html).toContain('https://timingrun.it/reimposta-password?token=abc');
        expect(m.text).toContain('60 minuti');
    });
});

// ─── Coda di invio ───────────────────────────────────────────────────────────

function outboxStub() {
    const rows: any[] = [];
    let n = 0;
    const prisma: any = {
        emailOutbox: {
            create: jest.fn(async ({ data }: any) => {
                if (data.dedupeKey && rows.some(r => r.dedupeKey === data.dedupeKey)) {
                    const { Prisma } = jest.requireActual('@prisma/client');
                    throw new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' });
                }
                const defined = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
                const row = { id: `m${++n}`, attempts: 0, status: 'pending', sendAfter: new Date(0), createdAt: new Date(), ...defined };
                rows.push(row);
                return row;
            }),
            findMany: async () => rows.filter(r => r.status === 'pending' && r.sendAfter <= new Date()),
            count: async ({ where }: any) => rows.filter(r => r.to === where.to).length,
            deleteMany: async () => ({ count: 0 }),
            updateMany: async ({ where, data }: any) => {
                if (!where.id) return { count: 0 };
                const r = rows.find(x => x.id === where.id && x.status === where.status);
                if (!r) return { count: 0 };
                r.status = data.status;
                r.attempts += data.attempts?.increment ?? 0;
                return { count: 1 };
            },
            update: async ({ where, data }: any) => Object.assign(rows.find(x => x.id === where.id), data),
        },
    };
    return { prisma, rows };
}

describe('coda email', () => {
    const env = { ...process.env };
    afterEach(() => { process.env = { ...env }; });
    const configure = () => Object.assign(process.env, { MAIL_FROM: 'iscrizioni@timingrun.it', AWS_ACCESS_KEY_ID: 'x', AWS_SECRET_ACCESS_KEY: 'y' });
    const mail = { subject: 'Oggetto', html: '<p>x</p>', text: 'x' };

    it('senza configurazione: in coda come "disabled", nessun invio', async () => {
        delete process.env.MAIL_FROM;
        const { prisma, rows } = outboxStub();
        const svc = new MailService(prisma);
        await svc.enqueue('a@example.com', mail, { kind: 'iscrizione' });
        expect(rows[0].status).toBe('disabled');
        expect(await svc.tick()).toBe(0);
    });

    it('indirizzo mancante o non valido: nessuna email (e nessun errore)', async () => {
        const { prisma, rows } = outboxStub();
        const svc = new MailService(prisma);
        await svc.enqueue(null, mail, { kind: 'iscrizione' });
        await svc.enqueue('non-un-indirizzo', mail, { kind: 'iscrizione' });
        expect(rows).toHaveLength(0);
    });

    it('stessa chiave: una sola email (es. promemoria)', async () => {
        const { prisma, rows } = outboxStub();
        const svc = new MailService(prisma);
        await svc.enqueue('a@example.com', mail, { kind: 'promemoria', dedupeKey: 'promemoria:r1' });
        await svc.enqueue('a@example.com', mail, { kind: 'promemoria', dedupeKey: 'promemoria:r1' });
        expect(rows).toHaveLength(1);
    });

    it('il database non risponde: l\'errore non arriva all\'iscrizione', async () => {
        const { prisma } = outboxStub();
        prisma.emailOutbox.create = async () => { throw new Error('db giù'); };
        await expect(new MailService(prisma).enqueue('a@example.com', mail, { kind: 'iscrizione' })).resolves.toBeUndefined();
    });

    it('invio riuscito → "sent"; SES non risponde → si riprova più tardi; errore definitivo → "failed"', async () => {
        configure();
        const { prisma, rows } = outboxStub();
        const svc = new MailService(prisma);
        const send = jest.spyOn(svc as any, 'send');
        await svc.enqueue('ok@example.com', mail, { kind: 'iscrizione' });
        await svc.enqueue('lento@example.com', mail, { kind: 'iscrizione' });
        await svc.enqueue('rifiutato@example.com', mail, { kind: 'iscrizione' });
        send.mockImplementation(async (to: any) => {
            if (to === 'lento@example.com') throw Object.assign(new Error('timeout'), { name: 'TooManyRequestsException' });
            if (to === 'rifiutato@example.com') throw Object.assign(new Error('indirizzo rifiutato'), { name: 'MessageRejected' });
        });
        expect(await svc.tick()).toBe(1);
        const by = (to: string) => rows.find(r => r.to === to);
        expect(by('ok@example.com').status).toBe('sent');
        expect(by('lento@example.com').status).toBe('pending');
        expect(by('lento@example.com').sendAfter.getTime()).toBeGreaterThan(Date.now());
        expect(by('rifiutato@example.com').status).toBe('failed');
    });
});

// ─── Promemoria pagamento anticipato ─────────────────────────────────────────

describe('anti-spam e link password', () => {
    const env = { ...process.env };
    afterEach(() => { process.env = { ...env }; });
    const mail = { subject: 'Oggetto', html: '<p>x</p>', text: 'x' };

    it('massimo 15 email al giorno allo stesso indirizzo (anche se scritto in maiuscolo)', async () => {
        const { prisma, rows } = outboxStub();
        const svc = new MailService(prisma);
        for (let i = 0; i < 30; i++) await svc.enqueue(i % 2 ? 'Vittima@Example.com' : 'vittima@example.com', mail, { kind: 'iscrizione' });
        expect(rows).toHaveLength(MailService.MAX_PER_ADDRESS_DAY);
    });

    it('casella riempita con iscrizioni finte: il recupero password parte lo stesso', async () => {
        const { prisma, rows } = outboxStub();
        prisma.emailOutbox.count = async ({ where }: any) => rows.filter(r => r.to === where.to && r.kind !== 'password').length;
        const svc = new MailService(prisma);
        for (let i = 0; i < 20; i++) await svc.enqueue('vittima@example.com', mail, { kind: 'iscrizione' });
        await svc.enqueue('vittima@example.com', mail, { kind: 'password' });
        expect(rows.filter(r => r.kind === 'password')).toHaveLength(1);
    });

    it('email password con invio non attivo: il link non viene conservato', async () => {
        delete process.env.MAIL_FROM;
        const { prisma, rows } = outboxStub();
        await new MailService(prisma).enqueue('a@example.com', { subject: 'x', html: 'token=SEGRETO', text: 'token=SEGRETO' }, { kind: 'password' });
        expect(JSON.stringify(rows)).not.toContain('SEGRETO');
    });

    it('email password inviata: il link viene cancellato dalla coda', async () => {
        Object.assign(process.env, { MAIL_FROM: 'iscrizioni@timingrun.it', AWS_ACCESS_KEY_ID: 'x', AWS_SECRET_ACCESS_KEY: 'y' });
        const { prisma, rows } = outboxStub();
        const svc = new MailService(prisma);
        jest.spyOn(svc as any, 'send').mockResolvedValue(undefined);
        await svc.enqueue('a@example.com', { subject: 'x', html: 'token=SEGRETO', text: 'token=SEGRETO' }, { kind: 'password' });
        await svc.tick();
        expect(rows[0].status).toBe('sent');
        expect(JSON.stringify(rows)).not.toContain('SEGRETO');
    });

    it('in produzione con email attive serve SITE_URL https', () => {
        Object.assign(process.env, { NODE_ENV: 'production', MAIL_FROM: 'i@timingrun.it', AWS_ACCESS_KEY_ID: 'x', AWS_SECRET_ACCESS_KEY: 'y', SITE_URL: 'http://localhost:8080' });
        expect(() => new MailService({} as any).onModuleInit()).toThrow(/SITE_URL/);
    });
});

describe('promemoria pagamento', () => {
    it('una sola volta per iscrizione, anche se il controllo gira più volte', async () => {
        const reg: any = {
            id: 'r1', email: 'luca@example.com', nome: 'LUCA', cognome: 'VERDI', pricePaid: 21, paymentMethod: 'bank',
            paymentStatus: 'PENDING', paymentRef: 'RT-ABCD1234', assignedCategory: null, certStatus: null, reminderSentAt: null,
            race: { name: '10 km', paymentMode: 'online', day: { date: new Date('2099-05-01'), event: { title: 'Corsa di Prova' } } },
        };
        const prisma: any = {
            registration: {
                findMany: async () => (reg.reminderSentAt ? [] : [reg]),
                updateMany: async ({ data }: any) => {
                    if (reg.reminderSentAt) return { count: 0 };
                    reg.reminderSentAt = data.reminderSentAt;
                    return { count: 1 };
                },
            },
        };
        const settings: any = { payments: async () => ({ iban: 'IT00', intestatario: 'TimingRun', banca: '', bankDays: 5 }) };
        const mail: any = { enqueue: jest.fn(async () => undefined) };
        const m = new RegistrationMailer(prisma, settings, mail);
        expect(await m.sendReminders()).toBe(1);
        expect(await m.sendReminders()).toBe(0);
        expect(mail.enqueue).toHaveBeenCalledTimes(1);
        expect(mail.enqueue.mock.calls[0][2]).toMatchObject({ kind: 'promemoria' });
    });
});
