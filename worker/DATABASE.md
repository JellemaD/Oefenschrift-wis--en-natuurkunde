# Database: vragen en voortgang (B30–B32)

Cloudflare D1, database `oefenschrift` (regio West-Europa). Tabellen: `schema.sql`.

## Wat wordt bewaard, en wanneer

| Tabel | Inhoud | Bewaard | Wanneer |
|---|---|---|---|
| `gesprekken` | Vraag van de leerling, antwoord van de professor, de opgave zoals zij die zag, oefening, steunniveau, model, kosten | 90 dagen | Alleen als bewaren aan staat |
| `voortgang` | Per som of meetvraag: zelf goed / met hulp / fout, aantal fouten, hint, uitwerking, professor gebruikt, seconden | 400 dagen (ruim een schooljaar) | Alleen als bewaren aan staat |
| `meldingen` | "Klopt er iets niet?" met de som | 365 dagen | Altijd |
| `teller`, `kosten` | Aantallen per dag en kosten per maand | teller 60 dagen | Altijd |

- **Geen naam en geen code** in de database. De leerling heet er `l` + 12 tekens: een pseudoniem dat uit de code is berekend. Alleen jij weet welke code bij wie hoort.
- **De docentinfo wordt niet bewaard**: het juiste antwoord en de uitwerking zitten al in de site.
- **Opruimen gaat automatisch**, elke nacht om 03:00 UTC. De termijnen pas je aan met de variabelen `BEWAAR_DAGEN_GESPREKKEN` en `BEWAAR_DAGEN_VOORTGANG` in `wrangler.toml`.

## Aanzetten (pas na de afspraak met leerling en ouder, B07)

1. Leerlingcodes instellen (B04): `npx -y wrangler@4 secret put LEERLINGCODES` (bijv. `esra-xxxx`).
   Zonder codes blijft bewaren altijd uit. Anders zijn leerlingen niet uit elkaar te houden en kan iedereen gegevens insturen.
2. In `wrangler.toml` de regel `BEWAREN = "uit"` veranderen in `BEWAREN = "aan"`.
3. Deployen: `$env:CLOUDFLARE_API_TOKEN = ''; npx -y wrangler@4 deploy`.

De site ziet dat vanzelf. De melding boven de chat verandert dan in: *"Je vragen en je voortgang worden bewaard onder je code, zonder je naam …"*. De voortgang die al op het apparaat staat, wordt in één keer meegestuurd. Uitzetten: terug naar `"uit"` en opnieuw deployen.

## Zoekopdrachten

Uitvoeren in Cloudflare → D1 → `oefenschrift` → Console, of met `npx -y wrangler@4 d1 execute oefenschrift --remote --command "…"`.

**Pseudoniem bij een code** (lokaal, in deze map):
```
node -e "crypto.subtle.digest('SHA-256',new TextEncoder().encode('oefenschrift:'+process.argv[1])).then(h=>console.log('l'+Buffer.from(h).subarray(0,6).toString('hex')))" esra-xxxx
```

### Voortgang

Zelf goed per week en per vak: wordt ze zelfstandiger?
```sql
SELECT leerling, vak, strftime('%Y-%W', tijd) AS week, COUNT(*) AS sommen,
       ROUND(100.0 * SUM(uitkomst = 'zelf') / COUNT(*)) AS pct_zelf,
       SUM(ai) AS met_professor
FROM voortgang WHERE soort = 'som' GROUP BY leerling, vak, week ORDER BY leerling, vak, week;
```

Per paragraaf: begin tegenover nu (eerste 5 tegenover laatste 5 sommen).
```sql
WITH g AS (SELECT leerling, vak, par, uitkomst,
  ROW_NUMBER() OVER (PARTITION BY leerling, par ORDER BY t) AS nr,
  ROW_NUMBER() OVER (PARTITION BY leerling, par ORDER BY t DESC) AS terug FROM voortgang WHERE soort = 'som')
SELECT leerling, vak, par, COUNT(*) AS sommen,
  SUM(nr <= 5 AND uitkomst = 'zelf') AS zelf_eerste5, SUM(terug <= 5 AND uitkomst = 'zelf') AS zelf_laatste5
FROM g GROUP BY leerling, vak, par ORDER BY leerling, vak, par;
```

Meting (B12): week 0, 2 en 4 naast elkaar.
```sql
SELECT leerling, vak, doel, date(tijd) AS dag, SUM(uitkomst = 'zelf') AS goed, COUNT(*) AS vragen
FROM voortgang WHERE soort = 'meting' GROUP BY leerling, vak, doel, dag ORDER BY leerling, vak, doel, dag;
```

Waar loopt ze vast? Veel fouten of veel hulp.
```sql
SELECT leerling, oefening, COUNT(*) AS sommen, SUM(uitkomst = 'fout') AS fout, SUM(uitkomst = 'hulp') AS met_hulp
FROM voortgang WHERE tijd > date('now', '-14 days') GROUP BY leerling, oefening
HAVING sommen >= 3 ORDER BY (fout + met_hulp) * 1.0 / sommen DESC LIMIT 10;
```

### Leren van de gesprekken (B32)

Steekproef: 10 gesprekken zonder oordeel.
```sql
SELECT id, date(tijd) AS dag, oefening, steun, vraag, antwoord FROM gesprekken
WHERE oordeel IS NULL ORDER BY RANDOM() LIMIT 10;
```

Oordeel vastleggen: `goed`, `fout` of `kan-beter`, met een korte notitie.
```sql
UPDATE gesprekken SET oordeel = 'fout', notitie = 'rekent x-top verkeerd uit' WHERE id = 42;
```

Bij welke oefeningen is de professor het meest nodig? Daar is de uitleg of hint in de site te zwak.
```sql
SELECT oefening, COUNT(*) AS vragen, COUNT(DISTINCT leerling) AS leerlingen FROM gesprekken
WHERE tijd > date('now', '-30 days') GROUP BY oefening ORDER BY vragen DESC LIMIT 10;
```

Kwaliteit per versie: percentage foute antwoorden.
```sql
SELECT versie, COUNT(*) AS beoordeeld, SUM(oordeel = 'fout') AS fout, SUM(oordeel = 'kan-beter') AS kan_beter
FROM gesprekken WHERE oordeel IS NOT NULL GROUP BY versie ORDER BY versie;
```

**Leerlus.** Elk antwoord met oordeel `fout` of `kan-beter` krijgt één oorzaak, en daarmee één verbetering:

1. **De professor weet iets niet of zegt het verkeerd.** Pas de instructie in `worker.js` aan (`NIVEAUS` / `STEUN`).
2. **De vraag komt doordat de site onduidelijk is.** Verbeter de uitleg, de hint of de uitwerking in `index.html`.
3. **De som zelf klopt niet.** Herstel de oefening en voeg een test toe aan `tests/test.js`.

Neem het gesprek daarna op in de vaste AI-toets (B29/B32), zodat dezelfde fout na een wijziging van de instructie of het model niet terugkomt.

### Verwijderen op verzoek (recht op verwijdering)

```sql
DELETE FROM gesprekken WHERE leerling = 'l…';
DELETE FROM voortgang WHERE leerling = 'l…';
```
Daarna de code uit `LEERLINGCODES` halen. Op het apparaat zelf: de sitegegevens in de browser wissen ("Scores wissen" wist alleen de scores, niet het logboek).
