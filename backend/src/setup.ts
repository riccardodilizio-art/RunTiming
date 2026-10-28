import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json } from 'express';

/**
 * Configurazione comune dell'app (usata da main.ts e dai test).
 * L'app va creata con { bodyParser: false }: i limiti dei body sono qui.
 */
export function configureApp(app: NestExpressApplication): void {
    // Dietro un proxy (nginx, piattaforma cloud) l'IP vero arriva da X-Forwarded-For:
    // serve al limite di richieste per IP. TRUST_PROXY=1 = un proxy davanti.
    app.set('trust proxy', process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY : false);

    // Limiti dei body: grandi SOLO per classifiche (staff / chiave semi-live) e
    // roster società; 1 MB per tutto il resto (iscrizioni comprese).
    app.use(/^\/api\/(sync\/races\/[^/]+\/results|races\/[^/]+\/results)$/, json({ limit: '25mb' }));
    app.use('/api/societies/me', json({ limit: '5mb' }));
    app.use(json({ limit: '1mb' }));

    app.setGlobalPrefix('api');

    // CORS: solo le origini dichiarate. Senza CORS_ORIGIN nessuna origine esterna.
    const origins = process.env.CORS_ORIGIN?.split(',').map(s => s.trim()).filter(Boolean);
    app.enableCors({ origin: origins?.length ? origins : false, credentials: true });

    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
}
