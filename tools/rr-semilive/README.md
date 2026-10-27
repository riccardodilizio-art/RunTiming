# Semi-live da Race Result offline

Pubblica le classifiche sul sito **durante la gara** senza il servizio online di
Race Result. Il programma gira sul PC di gara, legge le liste dal web server
**locale** di Race Result (la stessa "Simple API" usata dal chiosco) e le invia
al sito solo quando cambiano. Se internet cade (o il telefono si stacca), riprova
da solo al giro successivo: in gara non devi fare niente.

```
Race Result (offline) ──► http://localhost/_EVENTO/api/CHIAVE ──► rr_semilive.py ──► sito
                              (CSV, sul PC di gara)                 (ogni 60 s)        (pagina Risultati LIVE)
```

## Preparazione (una volta per evento)

1. **In Race Result**: crea una *Simple API* per ogni lista da pubblicare (es. la
   classifica generale con 10K/20K), formato **CSV**. L'indirizzo è del tipo
   `http://localhost/_XHLTB/api/GBTW8PS6…` (come per il chiosco).
2. **Sul sito** (admin → evento → gara → Classifica): premi **"Chiave semi-live"**.
   Ti dà `id_gara` e `chiave`.
3. Copia `config.esempio.json` in `config.json` e compila una voce per gara.

Le colonne vengono riconosciute dal nome: `Pos.`, `Pett.`, `Cognome` (anche
"COGNOME, NOME"), `Cat.`, `Team`/`Società`, `Time`/`Tempo`, `Diff`, e gli
intermedi `10K`, `20k`, `Km 5`… Al primo invio il programma stampa le colonne
riconosciute: controllale.

## In gara

- Doppio clic su **AVVIA_SEMILIVE.bat** (oppure `python rr_semilive.py`).
- Prova prima con `python rr_semilive.py --once` (un solo invio).
- A classifica chiusa: `python rr_semilive.py --final` la pubblica come **ufficiale**.
  In alternativa carichi l'Excel definitivo dall'admin: una classifica ufficiale
  caricata dall'admin non viene più sovrascritta dal semi-live.

## Sicurezza

- La chiave vale **solo per quella gara** e solo per inviare la classifica: se
  finisce in mani sbagliate, rigenerala dall'admin (la vecchia smette di funzionare).
- `config.json` contiene le chiavi: non condividerlo e non metterlo su GitHub
  (è già escluso dal `.gitignore`).
- Il programma legge solo da Race Result e scrive solo sul sito: non tocca i file
  dell'evento.
