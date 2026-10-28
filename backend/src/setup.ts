import { Logger, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json } from 'express';

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
    app.use(/^\/api\/(sync\/races\/[^/]+\/results|races\/[^/]+\/results)$/, json({ limit: '25mb' }));
    app.use('/api/societies/me', json({ limit: '5mb' }));
    app.use(json({ limit: '1mb' }));

    app.setGlobalPrefix('api');

    // CORS: solo le origini dichiarate. Senza CORS_ORIGIN nessuna origine esterna.
    const origins = process.env.CORS_ORIGIN?.split(',').map(s => s.trim()).filter(Boolean);
    if (!origins?.length) {
        new Logger('CORS').warn('CORS_ORIGIN non impostato: il backend risponde solo al sito sullo stesso indirizzo (/api)');
    }
    app.enableCors({ origin: origins?.length ? origins : false, credentials: true });

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
