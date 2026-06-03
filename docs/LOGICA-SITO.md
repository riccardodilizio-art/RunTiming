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

## 4. Admin

CRUD completo su eventi e gare + gestione trasversale piattaforma.

### 4.1 CRUD eventi/gare  ✅ (in gran parte già implementato)
- **Crea** un evento da zero, **aggiorna**, **elimina** (es. in caso di errore).
- Ogni evento contiene **più sottogare** (vedi §4.6).

### 4.2 Dati in creazione evento
Già presenti: titolo, immagine di copertina, società organizzatrice, luogo/coordinate, data/ora, descrizione, regolamento (PDF), percorso/altimetria, categoria sport, flag "in evidenza"/"live".
- 🔧 **GAP**: campo **volantino/flyer** dedicato (oggi c'è solo `regulationUrl`). Da aggiungere `flyerUrl`.

### 4.3 Visibilità pubblica elenco iscritti (per gara)
L'admin sceglie quali colonne sono visibili al visitatore nell'elenco iscritti di una gara: nome, cognome, data di nascita, categoria, **stato pagamento (ok/ko)**, **stato certificato (ok/ko)**, + eventuali campi extra della gara.
- ✅ Esiste `publicFields` (scelta campi extra del modulo).
- 🔧 **GAP**: esporre come colonne pubbliche opzionali anche **categoria assegnata**, **stato pagamento** e **stato certificato** (oggi la pagina pubblica iscritti non li mostra).

### 4.4 Quote, commissioni, sconti (per gara)  ✅ implementato
- Fasce di costo scaglionate (`priceSteps`), commissioni a cascata (step → gara → evento → globale), codici sconto.

### 4.5 Categorie (per gara)  ✅ implementato
- Preset standard (FIDAL / UISP / CSI / non competitiva) o personalizzate, in base all'ente/scelte della gara. Import CSV/JSON.

### 4.6 Sottogare (per evento)  ✅ implementato
- Un evento → più gare: competitiva, non competitiva, ragazzi, ecc. Ogni gara ha proprie categorie, quote, modulo extra, requisiti certificato.

### 4.7 Eventi multi-giorno / a tappe  🚧 NUOVO — da progettare
Caso reale: **"10 in 10 al Lago d'Orta"** → 10 giornate, ogni giorno **maratona + mezza maratona**. L'atleta può iscriversi a **tutte** le giornate o solo ad **alcune**.
- Il modello attuale (`Event` con `date` singola + `Race[]`) **non basta**: serve il concetto di **giornata/tappa** con data propria, e ogni giornata può avere le sue gare.
- Decisioni aperte: vedi domande sotto.

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
- **Eventi multi-giorno (§4.7)**:
  - Modello: una "giornata/tappa" è un contenitore con **data propria** che raggruppa gare? (Event → Day[] → Race[])
  - Iscrizione: l'atleta sceglie **singole giornate**, **l'intero evento (pass)**, o **entrambe**?
  - Esiste un **prezzo cumulativo / pass scontato** per chi fa tutte le giornate?
  - Serve una **classifica generale multi-tappa** (somma tempi/punti) oltre alle classifiche per giornata?
