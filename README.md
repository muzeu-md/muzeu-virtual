# Muzeul Virtual al Republicii Moldova

Site 100% static: GitHub Pages + Pages CMS — harta muzeelor din 37 raioane, 6
săli tematice, dosare de arhivă pentru obiecte. Structura repo = structura
site-ului; Pages servește rădăcina repo-ului la
`https://muzeu-md.github.io/muzeu-virtual/`.

## Structură

```
.github/workflows/build-index.yml   # completare automată: sate + dosarId + index.json
.nojekyll                           # viteza: fără build Jekyll
.pages.yml                          # configurația Pages CMS (conținut + media)
css/ · js/ · index.html · favicon.svg
content/obiecte/                    # fișele obiectelor (JSON, generate + manuale)
public/images/                      # imaginile încărcate din CMS (cale publică: /muzeu-virtual/public/images/…)
scripts/                            # gen-sate · atribuie-dosar · build-index (python3, fără dependențe)
```

## Conținut / CMS

Fișele obiectelor se editează din [Pages CMS](https://pagescms.org): repo-ul
citește `.pages.yml` (collections + media). Fișele pot avea imagini ca
argumente de external (picsum) sau ca `/muzeu-virtual/public/images/…`
(încărcate din CMS).

## Automatizare

Workflow-ul `build-index.yml` rulează la orice modificare din
`content/obiecte/**` sau `js/raioane.js`: regenerează lista de sate în
`.pages.yml` (din `js/raioane.js`), completează `dosarId`/`raion` în fișele noi
și reface `content/obiecte/index.json`; dacă a schimbat ceva, comite singur.
