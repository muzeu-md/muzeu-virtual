#!/usr/bin/env python3
"""Regenerează content/obiecte/index.json din fișierele *.json existente.

Rulare locală:  python3 scripts/build-index.py
Rulare automată: .github/workflows/build-index.yml la fiecare push ce atinge
content/obiecte/**. ID-urile DOS-xxxxx sunt persistate în fișiere de
scripts/atribuie-dosar.py (maximul existent + 1); index.json doar le
listează, în ordine alfabetică stabilă.
"""
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIR = ROOT / "content" / "obiecte"
INDEX = DIR / "index.json"


def main() -> None:
    files = sorted(
        p.name for p in DIR.glob("*.json") if p.name != "index.json"
    )
    payload = {
        "files": files,
        "count": len(files),
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }
    INDEX.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"index.json: {len(files)} fișe")


if __name__ == "__main__":
    main()
