# Esra's oefenschrift

Bijles en oefenen wiskunde en natuurkunde havo 3 (Moderne Wiskunde 13e editie, Nova natuurkunde) met uitleg van Professor Delta en Volta (AI).
Live: https://jellemad.github.io/Oefenschrift-wis--en-natuurkunde/ · Toekomstige naam: **Bijlesprofessor** (nog niet live)

## Start hier

| | |
|---|---|
| **Doel nu** | Pilot met één leerling (Esra, 3 havo): aantonen dat zij met de site zelfstandig beter wordt |
| **Scope** | 3 havo × wiskunde + natuurkunde × één leerling. Geen nieuwe vakken of accounts vóór het pilotbesluit |
| **Eigenaar** | Durk Jellema |
| **Actuele versie** | bovenste regel in `CHANGELOG.md` en onderaan de site |
| **Wat er in de site zit** | `INVENTARIS.md` (automatisch uit de code, bij elke release bijgewerkt) |
| **Plan en backlog** | Drive: `06 Review/01 Verbeterplan en backlog/` + Google Sheet "Oefenschrift – backlog en versiegeschiedenis" |
| **Handleiding voor Esra en ouder** | Drive: `01 Website/Handleiding – Esra's oefenschrift` |

Technische documentatie (code, tests, publiceren, versies) staat **hier in Git**; afspraken, handleiding en plannen staan in Google Drive.

## Wat staat waar

| Bestand | Inhoud |
|---|---|
| `index.html` | De hele site (HTML, CSS, JavaScript). Versienummer: `const VERSIE` |
| `tests/test.js` | Vaste testset: nakijken, invoer, alle oefeningen, uitleg, koppelingen |
| `INVENTARIS.md` | Paragrafen, uitleggen en oefeningen per vak — automatisch |
| `tools/inventaris.js` | Maakt `INVENTARIS.md` (draait vanzelf bij een release) |
| `CHANGELOG.md` | Wat er per versie is veranderd |
| `tools/release.js` | Nieuwe versie testen, taggen en publiceren |
| `tools/rollback.js` | Terug naar een eerdere versie |
| `.github/workflows/pages.yml` | GitHub test bij elke push en publiceert alleen bij groen |
| `worker/` | Kopie van de AI-docent (Cloudflare Worker) + workertests |

AI-docent: bewerken in Drive `03 Vraag stellen (AI-uitbreiding)`, kopie in `worker/`. Deployen vanuit die Drive-map:
`$env:CLOUDFLARE_API_TOKEN = ''; npx -y wrangler@4 deploy`. Opslag: Cloudflare D1 `oefenschrift` (teller, kosten, meldingen).

## Publiceren — de enige route

Werkkopie: Drive `01 Website/index.html`. Bron van waarheid: deze GitHub-repo. Niets uploaden via de browser.

1. Pas `index.html` aan (Drive), hoog `const VERSIE` op en kopieer het bestand naar deze repo (formaat `JJJJ.MM.DD-n`).
2. `node tests/test.js` moet eindigen met **ALLES GROEN**.
3. `node tools/release.js "Wat er veranderd is" B03,B05`
   → test, zet de versie in CHANGELOG.md, commit, tag `v<versie>` en push.
4. GitHub Actions draait de testset opnieuw en zet de site pas live als die groen is (± 1 minuut).
   Rood? Dan blijft de vorige versie gewoon online staan.

## Terug naar een eerdere versie (rollback)

```
node tools/rollback.js 2026.10.10-3          # laat zien wat er gebeurt
node tools/rollback.js 2026.10.10-3 --ja     # voert het uit
```

De oude versie wordt als **nieuwe** versie gepubliceerd (bijv. `2026.10.11-1`, "Rollback naar 2026.10.10-3").
Er wordt niets gewist; ook een rollback kun je weer terugdraaien.

Alle versies: `git tag -l "v*"` of op GitHub onder *Tags*. Overzicht met wijzigingen: `CHANGELOG.md`
en het tabblad *Versies* in de Google Sheet "Oefenschrift – backlog en versiegeschiedenis".

**Noodroute** (geen computer met Node bij de hand): op GitHub de vorige commit van `index.html` openen, inhoud kopiëren en als nieuwe commit opslaan.
