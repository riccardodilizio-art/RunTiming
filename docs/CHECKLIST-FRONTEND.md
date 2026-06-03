# RunTiming — Checklist frontend (cosa manca prima del backend)

> Derivata da `LOGICA-SITO.md`. Confronto tra specifica e codice attuale.
> Legenda: ✅ fatto · 🟡 parziale · 🔴 da fare · ⭐ priorità

## A. Modello dati & architettura (fondamenta — da fare per prime)

- 🔴 ⭐ **Eventi multi-giorno** — introdurre `Evento → Giornata (data propria) → Gare`.
  L'evento semplice = una sola giornata. Impatta model, editor admin, pagina evento, iscrizione.
- 🔴 ⭐ **Iscrizione a 3 blocchi + profilo unico** — refactor `RegisterPage`:
  profilo riusato (no reinserimento), form per-gara = **solo campi extra**, check requisiti gara, pagamento.
- 🟡 **FormBuilder**: distinguere **campi profilo** (auto/nascosti) da **campi extra gara** (gli unici configurabili).
- 🟡 **FIDAL**: per tesserato verificato → certificato **valido in automatico** (oggi parziale).

## B. Admin

- 🔴 **Campo volantino/flyer** sull'evento (oggi c'è solo `regulationUrl`).
- 🔴 ⭐ **Colonne pubbliche iscritti**: rendere attivabili dall'admin anche **categoria**, **stato pagamento (ok/ko)**, **stato certificato (ok/ko)** nell'elenco iscritti pubblico (oggi solo campi del modulo).
- 🔴 ⭐ **Export iscritti .xlsx** nel tracciato fisso del cronometraggio (§4.9) — oggi è CSV. (`xlsx` già presente).
- 🔴 ⭐ **Import classifica .xlsx modulare** con **mapping colonne** guidato dall'admin + gestione righe-sezione (§4.8). Sostituisce l'editor risultati attuale.
- 🔴 **Attestati** (§4.10): editor template (sfondo + campi posizionati) → generazione PDF post-import → download dall'atleta.
- ✅ CRUD eventi/gare · quote/commissioni/sconti · categorie (preset + import) · sottogare.

## C. Organizzatore

- 🟡 ⭐ **Vista ristretta**: l'organizzatore vede solo info generali (descrizione, volantino, regolamento) + **iscrizione manuale**; nascondere quote/categorie/modulo/commissioni. (Filtro accessi già esistente.)

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
