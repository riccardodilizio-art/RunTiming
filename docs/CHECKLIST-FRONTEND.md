# RunTiming — Checklist frontend (cosa manca prima del backend)

> Derivata da `LOGICA-SITO.md`. Confronto tra specifica e codice attuale.
> Legenda: ✅ fatto · 🟡 parziale · 🔴 da fare · ⭐ priorità

## A. Modello dati & architettura (fondamenta — da fare per prime)

- 🟡 ⭐ **Eventi multi-giorno** — modello `Evento → Giornata → Gara` ✅ (modello + helper + EventEditor a giornate). Resta: pagina pubblica evento che mostri le giornate, e iscrizione consapevole della giornata.
- 🔴 ⭐ **Iscrizione a 3 blocchi + profilo unico** — refactor `RegisterPage`:
  profilo riusato (no reinserimento), form per-gara = **solo campi extra**, check requisiti gara, pagamento.
- 🟡 **FormBuilder**: distinguere **campi profilo** (auto/nascosti) da **campi extra gara** (gli unici configurabili).
- 🟡 **FIDAL**: per tesserato verificato → certificato **valido in automatico** (oggi parziale).
- 🔴 ⭐ **Tesseramenti multipli + ente gara** (§2.4): profilo atleta con **lista affiliazioni** (ente+società+tessera+scadenza); aggiungere campo **`ente`** alla gara; all'iscrizione forzare/abilitare la scelta del tesseramento secondo l'ente.

## B. Admin

- 🔴 **Campo volantino/flyer** sull'evento (oggi c'è solo `regulationUrl`).
- 🔴 ⭐ **Colonne pubbliche iscritti**: rendere attivabili dall'admin anche **categoria**, **stato pagamento (ok/ko)**, **stato certificato (ok/ko)** nell'elenco iscritti pubblico (oggi solo campi del modulo).
- 🔴 ⭐ **Export iscritti .xlsx** nel tracciato fisso del cronometraggio (§4.9) — oggi è CSV. (`xlsx` già presente).
- 🔴 ⭐ **Import classifica .xlsx modulare** con **mapping colonne** guidato dall'admin + gestione righe-sezione (§4.8). Sostituisce l'editor risultati attuale.
- 🔴 **Attestati** (§4.10): editor template (sfondo + campi posizionati) → generazione PDF post-import → download dall'atleta.
- ✅ CRUD eventi/gare · quote/commissioni/sconti · categorie (preset + import) · sottogare.

## C. Organizzatore

- 🟡 ⭐ **Vista ristretta**: l'organizzatore vede solo info generali (descrizione, volantino, regolamento) + **iscrizione manuale**; nascondere quote/categorie/modulo/commissioni. (Filtro accessi già esistente.)

## C-bis. Società / Presidente  🔴 NUOVO

- 🔴 ⭐ **Registrazione società** ("Registrati per le società"): account presidente + dati società + codice FIDAL.
- 🔴 ⭐ **Roster atleti**: auto-import da DB FIDAL (mock per ora) + aggiunta manuale atleti non-FIDAL (tessera + scadenza cert).
- 🔴 ⭐ **Iscrizione massiva** degli atleti del roster alle gare (carrello/multi-selezione).
- 🔴 **Dashboard società**: gestione roster + storico iscrizioni.

## D. Atleta / pubblico

- 🟡 **Dashboard atleta**: mostrare attestati scaricabili per gara conclusa.
- 🟡 **Pagamenti**: flusso quota in iscrizione (PayPal abbozzato) — da rifinire.

## E. Trasversale / qualità

- 🟡 **Upload file** (certificato, volantino, sfondo attestato): oggi solo `fileName`; storage reale arriverà col backend.
- 🟡 **Bundle/code-splitting** (xlsx, leaflet) — rinviabile.

---

## Note
- Molte voci (export xlsx, attestati PDF, import) sono prototipabili lato client; storage/auth reali col backend.
- Ordine consigliato: **A** (fondamenta) → **B** (admin) → **C/D** → rifiniture.
