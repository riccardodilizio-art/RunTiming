#!/usr/bin/env python3
"""
RunTiming - Semi-live da Race Result OFFLINE.

Gira sul PC di gara (quello con Race Result). Ogni N secondi legge le liste
dalla "Simple API" del web server LOCALE di Race Result (la stessa usata dal
chiosco: http://localhost/_EVENTO/api/CHIAVE) e, se sono cambiate, le invia al
sito. Non serve il servizio online di Race Result: basta che il PC abbia
internet ogni tanto (anche dal telefono). Se la rete cade, riprova da solo.

Uso:
    python rr_semilive.py                      # usa config.json accanto al file
    python rr_semilive.py --config altra.json
    python rr_semilive.py --once               # un solo invio (prova)
    python rr_semilive.py --final              # invia come classifica UFFICIALE e termina

Solo libreria standard Python 3.8+ (niente da installare).
"""

import argparse
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))


def log(msg: str) -> None:
    print(f"[{datetime.now():%H:%M:%S}] {msg}", flush=True)


def load_config(path: str) -> dict:
    with open(path, encoding="utf-8") as f:
        cfg = json.load(f)
    if not cfg.get("sito") or not cfg.get("gare"):
        raise SystemExit("config.json: servono 'sito' e almeno una voce in 'gare'")
    # La chiave della gara viaggia con ogni invio: solo connessioni cifrate
    # (http consentito solo verso questo stesso PC, per le prove)
    u = urllib.parse.urlsplit(cfg["sito"].strip())
    locale = u.scheme == "http" and u.hostname in ("localhost", "127.0.0.1")
    if not (u.scheme == "https" and u.hostname) and not locale:
        raise SystemExit("config.json: 'sito' deve iniziare con https:// (es. https://www.iltuosito.it)")
    for g in cfg["gare"]:
        for k in ("nome", "lista_race_result", "id_gara", "chiave"):
            if not g.get(k):
                raise SystemExit(f"config.json: nella gara {g.get('nome', '?')} manca '{k}'")
    return cfg


def read_rr(url: str, timeout: int = 15) -> str:
    """Legge la lista dal web server locale di Race Result (CSV)."""
    req = urllib.request.Request(url + ("&" if "?" in url else "?") + f"_={int(time.time())}")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read()
    for enc in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: D401
        raise urllib.error.HTTPError(req.full_url, code, f"redirect verso {newurl} rifiutato: controlla 'sito' in config.json", headers, fp)


_NO_REDIRECT = urllib.request.build_opener(_NoRedirect)


def send(site: str, race_id: str, key: str, csv: str, status: str, timeout: int = 60) -> dict:
    """Invia la lista al sito. Il sito riconosce da solo le colonne (Pos., Pett., Cognome, Cat., Team, Time, 10K…)."""
    body = json.dumps({"csv": csv, "status": status}).encode("utf-8")
    req = urllib.request.Request(
        f"{site.rstrip('/')}/api/sync/races/{race_id}/results",
        data=body,
        method="POST",
        headers={"Content-Type": "application/json", "X-Sync-Key": key},
    )
    # Niente redirect: un reindirizzamento porterebbe la chiave a un altro indirizzo
    with _NO_REDIRECT.open(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8") or "{}")


def http_error_text(e: urllib.error.HTTPError) -> str:
    try:
        data = json.loads(e.read().decode("utf-8"))
        msg = data.get("message")
        return "; ".join(msg) if isinstance(msg, list) else str(msg)
    except Exception:
        return str(e)


def cycle(cfg: dict, last: dict, status: str, force: bool) -> None:
    for g in cfg["gare"]:
        nome = g["nome"]
        try:
            csv = read_rr(g["lista_race_result"])
        except Exception as e:  # Race Result chiuso, lista sbagliata, ecc.
            log(f"{nome}: Race Result non risponde ({e})")
            continue
        digest = hashlib.sha256(csv.encode("utf-8")).hexdigest()
        if not force and last.get(nome) == digest:
            continue  # nessun cambiamento: niente traffico
        try:
            r = send(cfg["sito"], g["id_gara"], g["chiave"], csv, status)
            last[nome] = digest
            log(f"{nome}: inviati {r.get('count', '?')} risultati ({r.get('status', status)})")
            if r.get("recognized") and not g.get("_colonne_mostrate"):
                log(f"{nome}: colonne riconosciute -> {', '.join(r['recognized'])}")
                g["_colonne_mostrate"] = True
        except urllib.error.HTTPError as e:
            log(f"{nome}: il sito ha rifiutato l'invio ({e.code}): {http_error_text(e)}")
            if e.code == 401:
                log(f"{nome}: controlla 'id_gara' e 'chiave' in config.json (chiave generata dall'admin)")
        except Exception as e:  # senza internet: riprova al giro dopo
            log(f"{nome}: sito non raggiungibile ({e}) - riprovo tra poco")


def main() -> None:
    ap = argparse.ArgumentParser(description="Semi-live Race Result -> RunTiming")
    ap.add_argument("--config", default=os.path.join(HERE, "config.json"))
    ap.add_argument("--once", action="store_true", help="un solo invio e termina")
    ap.add_argument("--final", action="store_true", help="invia come classifica ufficiale e termina")
    args = ap.parse_args()

    cfg = load_config(args.config)
    interval = max(15, int(cfg.get("intervallo_secondi", 60)))
    last: dict = {}

    if args.final:
        log("Invio classifica UFFICIALE")
        cycle(cfg, last, "final", force=True)
        return
    if args.once:
        cycle(cfg, last, "live", force=True)
        return

    log(f"Semi-live attivo: {len(cfg['gare'])} gare, controllo ogni {interval}s. Ctrl+C per fermare.")
    try:
        while True:
            cycle(cfg, last, "live", force=False)
            time.sleep(interval)
    except KeyboardInterrupt:
        log("Fermato.")


if __name__ == "__main__":
    sys.exit(main())
