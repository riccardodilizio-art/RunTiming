# RunTiming — Checklist frontend (cosa manca prima del backend)

> Derivata da `LOGICA-SITO.md`. Confronto tra specifica e codice attuale.
> Legenda: ✅ fatto · 🟡 parziale · 🔴 da fare · ⭐ priorità

## A. Modello dati & architettura (fondamenta — da fare per prime)

- ✅ **Eventi multi-giorno** — modello `Evento → Giornata → Gara`, helper, EventEditor a giornate, pagina pubblica con giornate raggruppate e range date. **end-to-end**.
- ✅ ⭐ **Iscrizione a 3 blocchi + profilo unico**: profilo riusato, form = solo extra, pagamento per `paymentMode` (incl. paga in loco), e tesseramento per ente gara (FIDAL obbligatorio).
- ✅ **classificazione campi profilo vs extra** (PROFILE_CATALOG_KEYS in RegisterPage).
- ✅ **FIDAL**: certificato **valido in automatico** per chi si iscrive con tesseramento FIDAL.
- ✅ ⭐ **Tesseramenti multipli + ente gara** (§2.4): campo `ente`+`paymentMode` su gara, editor affiliazioni nel profilo, e all'iscrizione il tesseramento è imposto (FIDAL) o scelto (altri enti) secondo l'ente gara.

## B. Admin

- ✅ **Campo volantino/flyer** sull'evento (EventEditor + pagina pubblica).
- ✅ **Colonne pubbliche iscritti**: toggle admin (RaceEditor) per **categoria**, **stato pagamento**, **stato certificato**; rese nella pagina pubblica iscritti (`race.publicColumns`).
- ✅ **Export iscritti .xlsx** nel tracciato fisso del cronometraggio (foglio Tabelle1), accanto al CSV in RaceEditor.
- ✅ **Import classifica .xlsx modulare**: upload Excel + mapping colonne guidato (auto-guess) + rilevamento righe-sezione, anteprima, salva la classifica della gara.
- ✅ **Attestati** (§4.10): editor template (sfondo + campi trascinabili) in RaceEditor; l'atleta scarica l'attestato dal profilo (render HTML → Stampa/Salva PDF) per le gare con classifica.
- ✅ CRUD eventi/gare · quote/commissioni/sconti · categorie (preset + import) · sottogare.

## C. Organizzatore

- ✅ **Vista ristretta organizzatore**: solo info generali (titolo, descrizione, volantino, regolamento, luogo, media) + gestione iscritti per gara; nascosti quote/categorie/modulo/commissioni/percorso e modifica struttura.

## C-bis. Società / Presidente  ✅

- ✅ **Registrazione società** + login (account presidente, dati società, ente, codice FIDAL).
- ✅ **Roster atleti**: auto-import da DB FIDAL (mock) per codice società + aggiunta/modifica manuale con tesseramenti (AffiliationsEditor) + reimporta.
- ✅ **Iscrizione massiva**: seleziona evento→gara→atleti, crea le iscrizioni (categoria assegnata, in attesa).
- ✅ **Dashboard società**: gestione roster.
- ✅ **Storico iscrizioni società** (le iscrizioni create dalla società sono taggate con `societyId` e mostrate in dashboard).
- ⏭️ Dedup roster↔account atleta individuale: rimandato al **backend** (integrità per CF/tessera).

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
