# RunTiming — Checklist frontend (cosa manca prima del backend)

> Derivata da `LOGICA-SITO.md`. Confronto tra specifica e codice attuale.
> Legenda: ✅ fatto · 🟡 parziale · 🔴 da fare · ⭐ priorità

## A. Modello dati & architettura (fondamenta — da fare per prime)

- ✅ **Eventi multi-giorno** — modello `Evento → Giornata → Gara`, helper, EventEditor a giornate, pagina pubblica con giornate raggruppate e range date. **end-to-end**.
- 🟡 ⭐ **Iscrizione a 3 blocchi + profilo unico** — `RegisterPage`: ✅ profilo riusato (riepilogo + prefill da affiliazioni), ✅ form gara = **solo campi extra** quando loggato, ✅ pagamento per `paymentMode` (incl. **paga in loco**). Resta: **selezione tesseramento per ente gara** (FIDAL obbligatorio) e check requisiti completo.
- ✅ **classificazione campi profilo vs extra** (PROFILE_CATALOG_KEYS in RegisterPage).
- 🟡 **FIDAL**: per tesserato verificato → certificato **valido in automatico** (oggi parziale).
- 🟡 ⭐ **Tesseramenti multipli + ente gara** (§2.4): ✅ campo `ente`+`paymentMode` su gara, ✅ editor affiliazioni nel profilo + prefill all'iscrizione. Resta: forzare il tesseramento corretto per gare FIDAL.

## B. Admin

- 🔴 **Campo volantino/flyer** sull'evento (oggi c'è solo `regulationUrl`).
- ✅ **Colonne pubbliche iscritti**: toggle admin (RaceEditor) per **categoria**, **stato pagamento**, **stato certificato**; rese nella pagina pubblica iscritti (`race.publicColumns`).
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
