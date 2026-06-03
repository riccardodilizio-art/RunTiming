# RunTiming — Logica del sito (documento vivo)

> Specifica funzionale condivisa. Si aggiorna man mano che definiamo i flussi.
> Stato: **in definizione**. Le sezioni marcate 🚧 sono da completare.

## Attori
- **Visitatore** — non autenticato.
- **Atleta** — utente pubblico registrato.
- **Organizzatore** — gestisce solo i propri eventi. 🚧
- **Admin** — accesso completo alla piattaforma. 🚧

---

## 0. Ambito del sistema  ✅ definito
**Questo è un portale di ISCRIZIONI, non di cronometraggio.**
- Si occupa di: anagrafica atleti, iscrizioni agli eventi, quote/pagamenti, verifica certificati, **esportazione degli iscritti**.
- A iscrizioni chiuse, l'elenco iscritti viene **esportato** (CSV/Excel) e caricato nella **piattaforma di cronometraggio esterna** (di proprietà del committente).
- Le **classifiche** NON vengono calcolate qui: a fine gara l'admin **carica** la classifica finale sul sito per la sola **visualizzazione pubblica** (modalità di caricamento da definire — vedi §4.8).
- Quindi: niente timing live, niente calcolo posizioni/gap, niente classifica generale multi-tappa lato nostro.

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

### 4.7 Eventi multi-giorno / a tappe  🚧 NUOVO — da implementare
Caso reale: **"10 in 10 al Lago d'Orta"** → 10 giornate, ogni giorno **maratona + mezza maratona**. L'atleta può iscriversi a **tutte** le giornate o solo ad **alcune**.

Decisioni prese:
- **Modello**: `Event → Giornata (data propria) → Gare`. Un evento "semplice" è il caso particolare con una sola giornata.
- **Iscrizione**: l'atleta può iscriversi a **singole giornate/gare** oppure all'**intero evento** in un'unica operazione.
- **Pass cumulativo**: **opzionale per evento** — alcuni organizzatori attivano un pass "tutto incluso" scontato, altri no. Configurabile dall'admin.
- Classifica generale multi-tappa: **fuori ambito** (vedi §0, gestita dalla piattaforma di cronometraggio).

### 4.8 Risultati / classifiche  🟡 solo upload finale (Excel, import modulare)
- Le classifiche sono **caricate dall'admin a fine gara** in **Excel (.xlsx)**, per sola visualizzazione pubblica (no calcolo lato sito).
- Il tracciato **varia da gara a gara** → import **modulare** con **mapping colonne guidato dall'admin**: l'admin carica il file, vede le intestazioni e **associa** ogni colonna del file ai campi della classifica (Posizione, Pettorale, Cognome, Nome, Team, Categoria, Tempo, ecc.). Il mapping può essere salvato/riusato per gare simili.
- Un singolo file può contenere **più sezioni** (es. riga "10K" che fa da intestazione di sotto-classifica): da gestire.
- **Esempio reale fornito** (`Class_Generale29.xlsx`), colonne osservate:
  `Pos. | PosSex | Pett. | Cognome | Nome | Team | Sesso | PosCat | Cat. | Media | Time | Partenza | Diff`
  con righe-sezione tipo `10K`.

### 4.9 Esportazione iscritti → cronometraggio  🟡 Excel FISSO
- Export elenco iscritti in **Excel (.xlsx)** con tracciato **fisso** richiesto dal cronometraggio.
- **Tracciato (foglio `Tabelle1`)** — esempio `Esempio101.xlsx`:
  `Pettorale | Titolo | Cognome | Nome | AnnoDiNascita | DataDiNascita | Genere | Nazione | Via | Regione | CAP | Città | Paese | Gara | Società | Licenza | Stato | Commento | Email | Telefono | Cellulare | AccountNum | FilialeNum | IBAN | BIC | MandatoSEPA | Banca | ProprietarioAccount | Transponder1 | Transponder2`
  - Note: `DataDiNascita` seriale Excel; `Genere` minuscolo; **`Gara` lasciato vuoto** (lo definisce l'admin nel proprio portale di cronometraggio); campi bancari/transponder vuoti.
- Oggi c'è export CSV: va aggiunto **export .xlsx in questo tracciato** (libreria `xlsx` già presente).

### 4.10 Generazione attestati  🚧 NUOVO — da progettare
- **Dopo l'import della classifica**, il sistema genera un **attestato/diploma per ogni atleta** della gara.
- L'attestato riporta i dati dell'atleta + risultato (es. nome, gara, posizione, tempo, categoria, data, logo/evento).
- Decisioni aperte: vedi domande sotto (template, dati, distribuzione).

---

## Decisioni prese
- [x] **Ambito**: portale di iscrizioni, NON di cronometraggio (timing esterno).
- [x] Tema UI: arancione "flame" (token `brand`).
- [x] Atleta: registrazione una sola volta + profilo riutilizzabile.
- [x] Tesserato FIDAL: certificato valido in automatico.
- [x] DB FIDAL: dataset interno importato (no dipendenza da API esterna).
- [x] Form per-gara = solo campi extra (il resto dal profilo).
- [x] Multi-giorno: `Event → Giornata → Gare`; iscrizione singola o intero evento; pass scontato opzionale.
- [x] Export iscritti: **Excel (.xlsx)** con tracciato **fisso** (§4.9), colonna `Gara` vuota.
- [x] Import classifica: **Excel (.xlsx)** **modulare**, **mapping colonne guidato dall'admin** (§4.8).
- [x] Dopo l'import classifica → **generazione attestati** per atleta (§4.10).

## Domande aperte / da definire più avanti
- Enti tessera per non-FIDAL (RunCard, UISP, CSI, ACSI…): elenco e regole.
- Gestione pagamenti: provider (PayPal già abbozzato), rimborsi, ricevute.
- Stati iscrizione e loro transizioni complete.
- Permessi fini dell'organizzatore.
- Attestati (§4.10): come si definisce il **template** (immagine di sfondo + posizionamento campi, o layout predefinito configurabile)? È **per evento/gara**?
- Attestati: **quali dati** stampare (posizione, tempo, categoria, logo…) e **chi li scarica** (atleta dal profilo, admin in massa, entrambi)? Generazione **PDF**.
- Import classifica (§4.8): come gestire al meglio le **righe-sezione** nel mapping?
