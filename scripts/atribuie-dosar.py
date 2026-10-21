#!/usr/bin/env python3
"""Completează automat fișele noi din content/obiecte:

1. dosarId (DOS-xxxxx): următorul număr = MAXIMUL existent + 1 (nu count),
   ca ștergerea unei fișe să nu provoace duplicate. Duplicatele sau
   formatele invalide primesc și ele următorul număr liber.
2. raion: derivat mereu din sat, după js/raioane.js (sursa unică).
   Editorul alege doar satul din dropdown; raionul se scrie singur.

Rulare automată: .github/workflows/build-index.yml, înainte de build-index.py.
Rulare locală:  python3 scripts/atribuie-dosar.py
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIR = ROOT / "content" / "obiecte"
RAIOANE_JS = ROOT / "js" / "raioane.js"
PAT = re.compile(r"^DOS-(\d+)$", re.IGNORECASE)


def numar(dosar_id) -> int:
    m = PAT.match(str(dosar_id or "").strip())
    return int(m.group(1)) if m else 0


def harta_sate():
    """sat_id -> [raion_id, ...], din js/raioane.js.

    Atenție: același id de sat poate exista în mai multe raioane
    (nume reale duplicate). De aceea derivarea preferă raionul
    deja existent în fișă, dacă e printre candidați.
    """
    from collections import defaultdict
    src = RAIOANE_JS.read_text(encoding="utf-8")
    date = json.loads(re.search(r"\{.*\}", src, re.S).group(0))
    harta = defaultdict(list)
    for r in date["raioane"]:
        for s in r.get("sate", []):
            if r["id"] not in harta[s["id"]]:
                harta[s["id"]].append(r["id"])
    return harta


def scrie(f, o) -> None:
    nou = {}
    for cheie in ("id", "dosarId"):
        if cheie in o:
            nou[cheie] = o[cheie]
    for k, v in o.items():
        if k not in nou:
            nou[k] = v
    (DIR / f).write_text(
        json.dumps(nou, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    fisiere = sorted(
        p.name for p in DIR.glob("*.json") if p.name != "index.json"
    )
    obiecte = []
    for f in fisiere:
        o = json.loads((DIR / f).read_text(encoding="utf-8"))
        obiecte.append((f, o))

    # Prima trecere: păstrează prima apariție a fiecărui număr valid.
    vazute = set()
    de_atribuit = []
    for f, o in obiecte:
        n = numar(o.get("dosarId"))
        if n and n not in vazute:
            vazute.add(n)
        else:
            de_atribuit.append((f, o))

    # A doua trecere: atribuie crescător de la maximul existent.
    max_n = max(vazute) if vazute else 0
    for f, o in de_atribuit:
        max_n += 1
        o["dosarId"] = f"DOS-{max_n:05d}"
        print(f"{f}: atribuit {o['dosarId']}")

    if not de_atribuit:
        print("nimic de atribuit — toate fișele au dosarId unic")

    # A treia trecere: raionul se derivează din sat (js/raioane.js).
    sat_la_raioane = harta_sate()
    for f, o in obiecte:
        sid = str(o.get("sat") or "").strip()
        if not sid:
            print(f"AVERTISMENT {f}: lipsește satul, raionul nu poate fi derivat")
            continue
        candidati = sat_la_raioane.get(sid, [])
        if not candidati:
            print(f"AVERTISMENT {f}: satul '{sid}' nu există în js/raioane.js, raion neschimbat")
            continue
        actual = o.get("raion")
        if actual in candidati:
            continue  # deja corect (inclusiv sate cu nume duplicat)
        rid = candidati[0]
        o["raion"] = rid
        extra = f" (candidați multipli: {', '.join(candidati)})" if len(candidati) > 1 else ""
        print(f"{f}: raion → {rid} (din satul {sid}){extra}")

    for f, o in obiecte:
        scrie(f, o)


if __name__ == "__main__":
    main()
