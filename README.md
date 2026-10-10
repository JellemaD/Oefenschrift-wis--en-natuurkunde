# Esra's oefenschrift

Oefensite wiskunde en natuurkunde havo 3 (Moderne Wiskunde 13e editie, Nova natuurkunde) met uitleg van Professor Delta en Volta.
Live: https://jellemad.github.io/Oefenschrift-wis--en-natuurkunde/

## Wat staat waar

| Bestand | Inhoud |
|---|---|
| `index.html` | De hele site (HTML, CSS, JavaScript). Versienummer: `const VERSIE` |
| `tests/test.js` | Vaste testset: nakijken, invoer, alle oefeningen, uitleg, koppelingen |
| `CHANGELOG.md` | Wat er per versie is veranderd |
| `tools/release.js` | Nieuwe versie testen, taggen en publiceren |
| `tools/rollback.js` | Terug naar een eerdere versie |
| `.github/workflows/pages.yml` | GitHub test bij elke push en publiceert alleen bij groen |

De AI-docent (Cloudflare Worker) staat apart, in Drive: `03 Vraag stellen (AI-uitbreiding)`.

## Publiceren

1. Pas `index.html` aan en hoog `const VERSIE` op (formaat `JJJJ.MM.DD-n`).
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
en het tabblad *Versies* in de Google Sheet "Backlog bijlesproduct".

Nood (zonder Node): op GitHub de vorige commit van `index.html` openen, inhoud kopiëren en als nieuwe commit opslaan.
