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
- **Auth**: `POST /api/auth/register` (solo ATHLETE/SOCIETY) · `POST /api/auth/login` · `GET /api/auth/me` · `POST /api/auth/password`.
  Admin iniziale creato al primo avvio da `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
- **Eventi**: `GET /api/events?when=upcoming|past|all&q=&page=` (calendario leggero, cache 60s) · `GET /api/events/:slug`
  · `POST` / `PUT /api/events/:id` (admin, evento completo con giornate e gare: aggiorna, crea, elimina;
  una gara con iscrizioni non si può eliminare) · `PATCH /api/events/:id/info` (admin o organizzatore) ·
  `DELETE /api/events/:id` · `PATCH /api/races/:id/open`
- **Profili**: `GET|PUT /api/athletes/me` (tesseramenti FIDAL verificati su WISE lato server) ·
  `GET /api/athletes?pending=1` + `PATCH /api/athletes/:id/cert` (admin, verifica certificati) ·
  `GET|PUT /api/societies/me` · `GET|POST|PATCH /api/accounts` (admin: account admin/organizzatori)
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

- **Classifiche**: `GET /api/races/:id/results` (pubblica, cache 15s, stato `live`/`final`) ·
  `PUT /api/races/:id/results` (staff, import Excel → ufficiale) · `POST /api/races/:id/sync-key` (staff) ·
  `POST /api/sync/races/:id/results` (programma semi-live, header `X-Sync-Key`, body `{ csv, status? }`:
  la lista Race Result in CSV viene convertita lato server riconoscendo le colonne — vedi `src/results/rr-csv.ts`
  e `tools/rr-semilive/`)

Auth: header `Authorization: Bearer <token>`; `AuthGuard` + `@Roles(...)` in `src/common/auth.ts`.
Test: `npm test` — regole di prezzo/categoria (`rules.spec.ts`) e smoke test dell'app con auth/ruoli/validazione (`app.spec.ts`).

## Moduli da completare (stessa struttura di `events`)
athletes · affiliations · societies · races (CRUD admin) · payments online ·
results (import classifica) · certificates · fidal (lookup/import) ·
storage (S3/R2) · jobs (BullMQ: export iscritti, attestati).
