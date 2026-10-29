import { Logger, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { TokenVerifier } from './common/auth';
import { PrismaService } from './prisma/prisma.service';
import { syncKeyMatches } from './results/results.module';

/**
 * Configurazione comune dell'app (usata da main.ts e dai test).
 * L'app va creata con { bodyParser: false }: i limiti dei body sono qui.
 */
export function configureApp(app: NestExpressApplication): void {
    // Dietro un proxy (nginx) l'IP vero arriva da X-Forwarded-For: serve al limite
    // di richieste per IP. 1 = nginx davanti (anche con Cloudflare: nginx ricava
    // l'IP vero dagli indirizzi Cloudflare). Vuoto = backend esposto direttamente.
    app.set('trust proxy', trustProxy(process.env.TRUST_PROXY));

    // Limiti dei body: grandi SOLO per classifiche (staff / chiave semi-live) e
    // roster società; 1 MB per tutto il resto (iscrizioni comprese).
    // Prima di leggere un body grande serve una credenziale VALIDA (login verificato
    // sul DB, o chiave semi-live della gara): un anonimo non può far elaborare al
    // server 25 MB per volta. I permessi precisi li controllano poi le guardie.
    const tokens = app.get(TokenVerifier, { strict: false });
    const prisma = app.get(PrismaService, { strict: false });
    // Solo i ruoli che possono davvero usare quella rotta: un account atleta
    // (gratuito) non deve poter far leggere al server 25 MB per volta.
    const needsCredential = (roles: string[]) => async (req: Request, res: Response, next: NextFunction) => {
        if (req.method === 'GET' || req.method === 'OPTIONS') return next(); // OPTIONS = preflight CORS
        try {
            const auth = req.headers.authorization;
            if (auth?.startsWith('Bearer ')) {
                const u = await tokens.verify(auth.slice(7));
                if (!roles.includes(u.role)) {
                    res.status(403).json({ statusCode: 403, message: 'Non autorizzato' });
                    return;
                }
                (req as Request & { __throttleUser?: unknown }).__throttleUser = u;
                return next();
            }
            const key = req.headers['x-sync-key'];
            const raceId = /^\/api\/sync\/races\/([^/?]+)\/results/.exec(req.originalUrl)?.[1];
            if (typeof key === 'string' && raceId && (await syncKeyMatches(prisma, decodeURIComponent(raceId), key))) return next();
        } catch { /* credenziale non valida */ }
        res.status(401).json({ statusCode: 401, message: 'Accesso richiesto' });
    };
    // Niente caratteri NUL nell'indirizzo o nei testi (Postgres li rifiuta: errore 500)
    app.use((req: Request, res: Response, next: NextFunction) => {
        if (/%00|\0/.test(req.originalUrl)) { res.status(400).json({ statusCode: 400, message: 'Richiesta non valida' }); return; }
        next();
    });
    const reviver = (_k: string, v: unknown) => {
        if (typeof v === 'string' && v.includes('\0')) throw new SyntaxError('Carattere non valido');
        return v;
    };
    app.use(/^\/api\/(sync\/races\/[^/]+\/results|races\/[^/]+\/results)$/, needsCredential(['ADMIN', 'ORGANIZER']), json({ limit: '25mb', reviver }));
    app.use('/api/societies/me', needsCredential(['SOCIETY']), json({ limit: '5mb', reviver }));
    app.use(json({ limit: '1mb', reviver }));

    app.setGlobalPrefix('api');

    // CORS: solo le origini dichiarate. Senza CORS_ORIGIN nessuna origine esterna.
    const origins = process.env.CORS_ORIGIN?.split(',').map(s => s.trim()).filter(Boolean);
    if (!origins?.length) {
        new Logger('CORS').warn('CORS_ORIGIN non impostato: il backend risponde solo al sito sullo stesso indirizzo (/api)');
    }
    app.enableCors({ origin: origins?.length ? origins : false, credentials: true });

    // Niente "X-Powered-By: Express" nelle risposte
    app.disable('x-powered-by');

    if (process.env.NODE_ENV === 'production' && !process.env.TURNSTILE_SECRET_KEY) {
        new Logger('Sicurezza').warn('TURNSTILE_SECRET_KEY non impostata: iscrizioni anonime e nuovi account senza verifica anti-bot');
    }

    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
}

/** Valore di TRUST_PROXY per Express: numero di proxy, true/false, o elenco di indirizzi. */
export function trustProxy(v: string | undefined): boolean | number | string {
    const t = v?.trim().toLowerCase();
    if (!t || t === 'false' || t === '0') return false;
    if (t === 'true') return 1; // "true" in Express si fiderebbe di qualunque X-Forwarded-For
    if (/^\d+$/.test(t)) return Number(t);
    return v!.trim(); // es. "loopback" o "10.0.0.0/8"
}
