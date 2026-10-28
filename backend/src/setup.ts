import { Logger, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json } from 'express';
import type { NextFunction, Request, Response } from 'express';

/**
 * Configurazione comune dell'app (usata da main.ts e dai test).
 * L'app va creata con { bodyParser: false }: i limiti dei body sono qui.
 */
export function configureApp(app: NestExpressApplication): void {
    // Dietro un proxy (nginx, piattaforma cloud) l'IP vero arriva da X-Forwarded-For:
    // serve al limite di richieste per IP. Numero di proxy davanti al backend:
    // 1 = solo nginx, 2 = Cloudflare + nginx. Vuoto = backend esposto direttamente.
    app.set('trust proxy', trustProxy(process.env.TRUST_PROXY));

    // Limiti dei body: grandi SOLO per classifiche (staff / chiave semi-live) e
    // roster società; 1 MB per tutto il resto (iscrizioni comprese).
    // Prima di leggere un body grande serve almeno una credenziale (token o chiave
    // semi-live): un anonimo non può far elaborare al server 25 MB per volta.
    // La credenziale vera la controllano poi le guardie della rotta.
    const needsCredential = (req: Request, res: Response, next: NextFunction) => {
        if (req.method === 'GET' || req.headers.authorization?.startsWith('Bearer ') || req.headers['x-sync-key']) return next();
        res.status(401).json({ statusCode: 401, message: 'Accesso richiesto' });
    };
    app.use(/^\/api\/(sync\/races\/[^/]+\/results|races\/[^/]+\/results)$/, needsCredential, json({ limit: '25mb' }));
    app.use('/api/societies/me', needsCredential, json({ limit: '5mb' }));
    app.use(json({ limit: '1mb' }));

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
