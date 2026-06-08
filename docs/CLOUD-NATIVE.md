# RunTiming — Setup cloud-native

Stato e scelte per rendere l'app pronta al cloud (migliaia di atleti, picchi
all'apertura iscrizioni). Architettura: **modular monolith** stateless,
scalabile in orizzontale (NON microservizi, per evitare complessità inutile).

## Struttura monorepo
```
/RunTiming
  run-timing-frontend/   SPA React (Vite) → build statica servita da nginx
    Dockerfile           multi-stage (node build → nginx)
    nginx.conf           SPA fallback + gzip + cache asset
    .env.example         VITE_API_URL, VITE_USE_API
    src/lib/api.ts       client HTTP (fetch + JWT) per il backend
  backend/               NestJS modular monolith
    Dockerfile           multi-stage (build → runtime slim)
    prisma/schema.prisma modello dati relazionale
    src/                 app.module + moduli (auth, events, health, prisma…)
    .env.example         DATABASE_URL, REDIS_URL, JWT_SECRET, CORS_ORIGIN
  docker-compose.yml     db (Postgres) + redis + backend + frontend
  .github/workflows/ci.yml  lint · typecheck · build · docker build
  docs/                  specifica, blueprint backend, checklist
```

## Avvio locale (tutto in container)
```bash
docker compose up --build
# frontend: http://localhost:8080   backend: http://localhost:3000/api/health
```

## Principi 12-factor applicati / da applicare
- **Config via env** (no segreti hardcoded): FE `VITE_API_URL`; BE `DATABASE_URL`, `JWT_SECRET`, `REDIS_URL`, `CORS_ORIGIN`.
- **Stateless**: il backend non tiene stato in memoria → si replicano N istanze dietro load balancer per reggere i picchi.
- **Backing services**: Postgres e Redis come risorse collegate (URL in env), sostituibili con servizi gestiti.
- **Build/Release/Run separati**: immagini Docker immutabili, config iniettata al deploy.
- **Logs su stdout** (raccolti dalla piattaforma).
- **Processi disposable** + healthcheck (`/api/health`, `/healthz` nginx).

## CI/CD (GitHub Actions)
`ci.yml` esegue su push/PR:
1. **frontend**: `npm ci` → `lint` → `tsc -b` → `build`.
2. **backend**: `npm install` → `prisma generate` → `build`.
3. **docker**: build delle due immagini.
Estensione naturale: push immagini su registry + deploy (Render/Railway/Fly/K8s).

## Scalabilità a migliaia di atleti
- API stateless replicabile orizzontalmente; Postgres gestito con pool e indici (già definiti su `Registration`, `FidalAthlete`, `ResultRow`).
- Lavori pesanti (export iscritti .xlsx, import classifica, generazione attestati PDF, import FIDAL) → coda **Redis + BullMQ**, fuori dal ciclo richiesta.
- Asset statici del frontend dietro CDN/cache (header già impostati in `nginx.conf`).
- File (certificati, volantini, sfondi attestati, PDF) su **object storage S3-compatibile** (R2/S3), mai nel DB.

## Da completare (prossimi step backend)
- Moduli REST rimanenti (athletes, registrations, societies, races, discounts, results, certificates, fidal, storage, jobs).
- Migrazione del frontend da `localStorage` alle API (dietro `useAdminStore`, usando `src/lib/api.ts` e `VITE_USE_API`).
- Auth guard/ruoli (RBAC) su tutti gli endpoint; rate limiting; observability (metrics/tracing).
