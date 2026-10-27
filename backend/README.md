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
- `GET  /api/settings/commission` · `PUT` (admin) — commissione globale
- `GET  /api/discounts/check/:code` · CRUD `/api/discounts` (admin)
- **Iscrizioni** (`src/registrations`):
  - `GET  /api/races/:id/quote?code=` — prezzo attuale calcolato dal server (quota attiva + sconto + commissione)
  - `POST /api/registrations` — iscrizione (atleta dal suo profilo; società / organizzatore / admin con `athlete`).
    Controlli: gara aperta, posti (lock per gara), doppioni, età, campi obbligatori, ente FIDAL, codice sconto atomico.
    Categoria assegnata con età sportiva (anno gara − anno nascita); certificato auto-valido per tesserati FIDAL verificati.
  - `GET  /api/registrations/me` — iscrizioni dell'atleta / della società
  - `GET  /api/races/:id/entrants?page=&q=` — elenco **pubblico** paginato, solo colonne rese pubbliche, `Cache-Control: max-age=60`
  - `POST /api/events/:slug/verify` — "Verifica iscrizione" (cognome + data di nascita)
  - `GET  /api/races/:id/registrations` · `GET /api/races/:id/export.xlsx` · `PATCH /api/registrations/:id/payment|cert` — staff

Auth: header `Authorization: Bearer <token>`; `AuthGuard` + `@Roles(...)` in `src/common/auth.ts`.
Test: `npm test` (regole di prezzo/categoria in `src/registrations/rules.spec.ts`).

## Moduli da completare (stessa struttura di `events`)
athletes · affiliations · societies · races (CRUD admin) · payments online ·
results (import classifica) · certificates · fidal (lookup/import) ·
storage (S3/R2) · jobs (BullMQ: export iscritti, attestati).
