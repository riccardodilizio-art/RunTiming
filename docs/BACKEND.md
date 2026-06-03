# RunTiming — Architettura Backend (blueprint)

> Stack deciso: **NestJS + Prisma + PostgreSQL**, **monorepo**, **cloud gestito**.
> Documento vivo: si raffina prima e durante l'implementazione.

## 1. Stack
- **Linguaggio**: TypeScript (frontend + backend).
- **Framework API**: NestJS (modulare, DI, guard per ruoli, validazione con class-validator).
- **DB**: PostgreSQL.
- **ORM**: Prisma (schema + migrazioni type-safe).
- **Code/lavori asincroni**: Redis + BullMQ (import FIDAL, import classifica, export Excel, generazione attestati).
- **Storage file**: object storage S3-compatibile (certificati, volantini, sfondi attestati, PDF).
- **Auth**: JWT (access + refresh) con hashing password **argon2**; ruoli RBAC.
- **Excel**: SheetJS/exceljs. **PDF**: pdf-lib.

## 2. Hosting (cloud gestito) — proposta
- App container (API) su **Render / Railway / Fly.io** (deploy da repo, autoscaling orizzontale).
- **PostgreSQL gestito** (incluso nelle piattaforme sopra, oppure Neon/Supabase).
- **Redis gestito** (Upstash o incluso).
- **Object storage**: Cloudflare R2 (economico, S3-compatibile) o S3.
- Segreti via env (DB URL, JWT secret, S3 keys). Stateless → si replicano istanze ai picchi iscrizioni.

## 3. Monorepo — layout proposto
```
/RunTiming
  /run-timing-frontend     # SPA React (esistente)
  /backend                 # NestJS API
  /shared                  # tipi/DTO TS condivisi (Event, Race, enums…)
  /docs                    # specifiche
```
- `shared/` evita disallineamenti di tipi tra FE e BE.
- Lo `useAdminStore` del FE verrà reindirizzato da localStorage → chiamate API.

## 4. Modello dati (entità principali)
> Sintesi; i dettagli vanno nello `schema.prisma`.

- **Account** — auth: `id, email, passwordHash, role (ADMIN|ORGANIZER|ATHLETE|SOCIETY), createdAt`.
- **Athlete** — può esistere anche **senza account** (inserito da società/organizzatore):
  `id, accountId?, nome, cognome, dataNascita, sesso, codiceFiscale (dedup), email?, telefono?`
  → relazioni: `affiliations[]`, `registrations[]`.
- **Affiliation** (tesseramento) — **molti per atleta**:
  `id, athleteId, ente (FIDAL|UISP|CSI|...), societyId?, societaNome, numeroTessera, certScadenza?, certStatus, source (FIDAL_DB|MANUAL)`.
- **Society** — `id, nome, ente, codiceFidal?, presidentAccountId`; roster via Affiliation/membership.
- **Event** — `id, title, slug, organizerName, coverImage, flyerUrl?, regulationUrl?, description?, sport, location, city, province, lat, lng, isFeatured, isLive, commission?(jsonb), createdById`.
- **EventDay** — `id, eventId, date, label` (un evento ha **1+ giornate**).
- **Race** — `id, eventDayId, name, distance, raceType, ente (FIDAL|PROMO|NON_COMP), requiresMedicalCert, minAge?, maxAge?, maxParticipants, isOpen, basePrice, paymentMode (NONE|ONLINE|ONSITE|BOTH), commission?(jsonb), publicColumns(jsonb)`.
- **Category** — `id, raceId, name, gender?, minAge?, maxAge?`.
- **PriceStep** — `id, raceId, label, price, deadline, commission?(jsonb)`.
- **FormFieldDef** — campi **extra gara**: `id, raceId, key, type, label, required, options(jsonb)`.
- **DiscountCode** — `id, scope, code, type, value, maxUses?, usedCount, expiresAt?, isActive`.
- **EventPass** (multi-giorno, opzionale) — pacchetto scontato che copre più giornate/gare.
- **Registration** — `id, raceId, athleteId, affiliationSnapshot(jsonb), assignedCategory?, extraData(jsonb), pricePaid, discountCodeId?, paymentMethod, paymentStatus, paymentMode, registeredBy (ATHLETE|SOCIETY|ORGANIZER|ADMIN), societyId?, athleteSnapshot(jsonb), submittedAt`.
- **FidalAthlete** (dataset importato) — `tessera, ente, nome, cognome, dataNascita, sesso, societa, codiceSocieta, certScadenza?` (per lookup/auto-import).
- **ResultUpload** + **ResultRow** — classifica caricata: `upload(id, raceId, fileName, columnMapping jsonb, uploadedAt)`, `row(id, uploadId, section, position, data jsonb)`.
- **CertificateTemplate** — `id, raceId|eventId, backgroundUrl, fields(jsonb: chiave,x,y,font,size,color)`.
- **GeneratedCertificate** — `id, registrationId, pdfUrl, generatedAt`.

## 5. Moduli NestJS
`auth`, `accounts`, `athletes`, `affiliations`, `societies`, `events` (+days), `races` (+categories, price-steps, form-fields), `discounts`, `registrations`, `fidal` (dataset+lookup), `results` (import classifica), `certificates` (template + generazione), `export` (Excel iscritti), `payments` (opzionale), `storage` (S3), `jobs` (BullMQ processors).

## 6. Auth & ruoli (RBAC)
- **ADMIN**: tutto.
- **ORGANIZER**: solo eventi assegnati; può modificare **info generali** + iscrizione manuale (no quote/categorie/moduli).
- **ATHLETE**: proprio profilo, iscrizioni, attestati.
- **SOCIETY** (presidente): roster + iscrizioni dei propri atleti.
- Guard NestJS + decoratori `@Roles()`; ownership check (es. organizer ↔ evento, società ↔ atleta).

## 7. Lavori asincroni (BullMQ)
- `fidal-import`: import/aggiornamento dataset FIDAL (CSV/Excel).
- `results-import`: parsing Excel classifica + mapping colonne + righe-sezione.
- `certificates-generate`: dopo import classifica → PDF per ogni atleta (pdf-lib) → storage.
- `entrants-export`: generazione .xlsx nel tracciato fisso del cronometraggio.

## 8. API (REST, alto livello)
`/auth`, `/events`, `/events/:id/days`, `/races/:id`, `/races/:id/registrations`,
`/athletes`, `/athletes/:id/affiliations`, `/societies`, `/societies/:id/roster`,
`/fidal/lookup`, `/races/:id/results` (upload/get), `/races/:id/certificate-template`,
`/registrations/:id/certificate`, `/races/:id/export`.
- Validazione DTO, paginazione su liste, filtri.

## 9. Piano di implementazione (fasi)
1. **Setup**: monorepo, NestJS, Prisma, Postgres, Docker compose dev (Postgres+Redis), `shared/`.
2. **Auth + Account/ruoli**.
3. **Core dominio**: Event→Day→Race, Category, PriceStep, FormField, Discount (CRUD admin).
4. **Atleti + Affiliazioni + FIDAL lookup/import**.
5. **Registrazioni** (atleta singolo) + regole ente/tesseramento + pagamento opzionale.
6. **Società** (roster + iscrizione massiva).
7. **Export iscritti .xlsx** + **import classifica** + **attestati**.
8. **Storage file** reale + hardening (rate limit, log, backup) + deploy.

## 10. Migrazione dal prototipo
- I tipi attuali (`types/index.ts`) sono la base per `shared/` e per lo schema Prisma.
- `useAdminStore` / accessor: sostituire `localStorage` con un client API (`fetch`), mantenendo le stesse firme dove possibile.
