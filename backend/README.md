# RunTiming — Backend (NestJS modular monolith)

API REST per il portale iscrizioni. Architettura: monolite modulare,
**stateless**, scalabile in orizzontale (vedi `../docs/BACKEND.md`).

## Stack
NestJS · Prisma · PostgreSQL · (Redis/BullMQ per i job) · JWT + argon2.

## Sviluppo locale
```bash
cp .env.example .env          # imposta DATABASE_URL, JWT_SECRET…
npm install
npm run prisma:generate
npm run prisma:migrate        # crea le tabelle
npm run start:dev             # http://localhost:3000/api
```
Con Docker (dalla root del repo): `docker compose up --build`.

## Endpoint già presenti
- `GET  /api/health` — liveness + stato DB
- `POST /api/auth/register` · `POST /api/auth/login` — JWT
- `GET  /api/events` · `GET /api/events/:slug`

## Moduli da completare (stessa struttura di `events`)
athletes · affiliations · societies · races · discounts · registrations ·
results (import classifica) · certificates · fidal (lookup/import) ·
storage (S3/R2) · jobs (BullMQ: export iscritti, attestati).
