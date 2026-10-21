#!/usr/bin/env python3
"""Generează lista completă de sate (dropdown) în .pages.yml din js/raioane.js.

Sursa unică de adevăr: js/raioane.js (37 raioane, ~1682 sate).
Opțiunile se scriu între marcajele SATE-GENERAT-START/END; restul
fișierului .pages.yml nu este atins.

Rulare automată: .github/workflows/build-index.yml la schimbarea js/raioane.js.
Rulare locală:  python3 scripts/gen-sate.py
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAIOANE_JS = ROOT / "js" / "raioane.js"
START = "# SATE-GENERAT-START"
END = "# SATE-GENERAT-END"


def gaseste_pages_yml() -> Path:
    """Găsește .pages.yml: la rădăcina repo-ului (lângă muzeu-virtual/),
    cu rezervă în muzeu-virtual/ (layout local de dezvoltare)."""
    candidati = [ROOT.parent / ".pages.yml", ROOT / ".pages.yml"]
    for c in candidati:
        if c.is_file():
            return c
    raise FileNotFoundError(
        "Nu găsesc .pages.yml nici la rădăcina repo-ului, nici în muzeu-virtual/. "
        f"Căutat în: {', '.join(str(c) for c in candidati)}"
    )


def yaml_str(s: str) -> str:
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


def main() -> None:
    src = RAIOANE_JS.read_text(encoding="utf-8")
    date = json.loads(re.search(r"\{.*\}", src, re.S).group(0))
    raioane = date["raioane"]

    linii = []
    for r in raioane:
        for s in r.get("sate", []):
            linii.append(
                f'            - name: {s["id"]}\n'
                f'              label: {yaml_str(r["nume"] + " — " + s["nume"])}'
            )
    bloc = "\n".join(linii)

    yml_path = gaseste_pages_yml()
    yml = yml_path.read_text(encoding="utf-8")
    i, j = yml.index(START), yml.index(END)
    # păstrează linia START, înlocuiește totul până la linia END
    cap = yml[: i + len(START)] + "\n"
    coada = yml[j:]
    nou = cap + bloc + "\n" + " " * 12 + coada
    if nou != yml:
        yml_path.write_text(nou, encoding="utf-8")
        print(f"OK: {len(linii)} sate generate în {yml_path}")
    else:
        print("nimic de actualizat — lista satelor e la zi")


if __name__ == "__main__":
    main()
