# RunTiming — Logica del sito (documento vivo)

> Specifica funzionale condivisa. Si aggiorna man mano che definiamo i flussi.
> Stato: **in definizione**. Le sezioni marcate 🚧 sono da completare.

## Attori
- **Visitatore** — non autenticato.
- **Atleta** — utente pubblico registrato.
- **Organizzatore** — gestisce solo i propri eventi. 🚧
- **Admin** — accesso completo alla piattaforma. 🚧

---

## 1. Visitatore  ✅ definito
Può, senza registrarsi:
- Consultare **classifiche/risultati** degli eventi conclusi.
- Sfogliare gli **eventi** con tutte le info: regolamento, volantino, percorso/altimetria, date, luogo.
- Vedere le **pagine pubbliche**: Contatti, Organizzatori.
- **Registrarsi come atleta** (vedi §2).

---

## 2. Atleta

### 2.1 Registrazione — "una volta sola"
Modello confermato: **l'atleta si registra una volta, crea un profilo riutilizzabile**, e poi si iscrive ai vari eventi senza reinserire i dati.

Due rami in fase di registrazione:

- **Tesserato FIDAL / RunCard**
  - Inserisce il **numero tessera** → il sistema interroga il **DB FIDAL** e precompila i dati (nome, cognome, nascita, sesso, società, scadenza certificato).
  - **Certificato medico: considerato valido in automatico** (lo garantisce il tesseramento FIDAL). Nessun upload né verifica admin richiesti.
  - Fonte dati FIDAL: **DB interno importato** (no API garantita). L'admin lo carica/aggiorna (es. CSV/Excel). La lookup è una query interna. Se in futuro arriva l'API ufficiale, si sostituisce solo la sorgente.

- **Non tesserato**
  - Compila manualmente tutti i dati anagrafici.
  - **Allega certificato medico** (+ eventuale tessera di un ente) → stato `in_attesa` finché l'admin non lo **verifica** (`verificato` / `rifiutato`).
  - Il certificato verificato vale **una volta per tutte le gare** (finché non scade).

### 2.2 Iscrizione a una gara — 3 blocchi
1. **Profilo** → preso dall'account, non reinserito.
2. **Requisiti della gara** → check automatico sul profilo:
   - gara **competitiva** → serve tessera FIDAL valida **oppure** certificato agonistico verificato;
   - se manca/è scaduto qualcosa → **solo allora** viene richiesto al volo.
3. **Extra gara + pagamento**:
   - campi extra specifici della gara (es. taglia maglia, tessera di un ente particolare, note) — gli **unici** campi chiesti all'iscrizione;
   - quota, se i pagamenti sono attivi su quella gara (con eventuali quote scaglionate / commissioni).

### 2.3 Decisione architetturale confermata
Nel form builder si distingue nettamente:
- **campi profilo** → auto-compilati, nascosti all'iscrizione;
- **campi extra gara** → gli unici configurati dall'organizzatore e mostrati all'atleta.

---

## 3. Organizzatore  🚧 da definire
_(gestione eventi/gare, categorie, quote, pagamenti, risultati…)_

## 4. Admin  🚧 da definire
_(verifica certificati, gestione account, sconti, commissioni, import DB FIDAL, organizzatori…)_

---

## Decisioni prese
- [x] Tema UI: arancione "flame" (token `brand`).
- [x] Atleta: registrazione una sola volta + profilo riutilizzabile.
- [x] Tesserato FIDAL: certificato valido in automatico.
- [x] DB FIDAL: dataset interno importato (no dipendenza da API esterna).
- [x] Form per-gara = solo campi extra (il resto dal profilo).

## Domande aperte / da definire più avanti
- Enti tessera per non-FIDAL (RunCard, UISP, CSI, ACSI…): elenco e regole.
- Gestione pagamenti: provider (PayPal già abbozzato), rimborsi, ricevute.
- Stati iscrizione e loro transizioni complete.
- Permessi fini dell'organizzatore.
