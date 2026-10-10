-- Database "oefenschrift" (Cloudflare D1) voor de AI-docent.
-- Toepassen: npx -y wrangler@4 d1 execute oefenschrift --remote --file=schema.sql   (veilig: alles IF NOT EXISTS)

-- Teller per dag (limieten), kosten per maand (kostenstop), meldingen "Dit klopt niet"
CREATE TABLE IF NOT EXISTS teller (sleutel TEXT PRIMARY KEY, n INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS kosten (maand TEXT PRIMARY KEY, millicent INTEGER NOT NULL, vragen INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS meldingen (id INTEGER PRIMARY KEY AUTOINCREMENT, tijd TEXT NOT NULL, versie TEXT, oefening TEXT, gegevens TEXT);

-- B30: gesprekken met de professor (alleen als BEWAREN = "aan"). leerling = pseudoniem, nooit naam of code.
-- oordeel/notitie vult Durk (of het weekrapport) in: goed | fout | kan-beter, om van te leren.
CREATE TABLE IF NOT EXISTS gesprekken (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tijd TEXT NOT NULL, leerling TEXT NOT NULL,
  vak TEXT, oefening TEXT, docent TEXT, steun TEXT, opgave TEXT, vraag TEXT NOT NULL, antwoord TEXT,
  model TEXT, tokens_in INTEGER, tokens_uit INTEGER, millicent INTEGER, versie TEXT,
  oordeel TEXT, notitie TEXT
);
CREATE INDEX IF NOT EXISTS gesprekken_leerling ON gesprekken (leerling, tijd);
CREATE INDEX IF NOT EXISTS gesprekken_oefening ON gesprekken (oefening);

-- B31: voortgang per som of meetvraag (zelf = in één keer goed zonder hulp; hulp = opgelost met hulp; fout)
CREATE TABLE IF NOT EXISTS voortgang (
  leerling TEXT NOT NULL, t INTEGER NOT NULL, tijd TEXT NOT NULL,
  soort TEXT, vak TEXT, par TEXT, oefening TEXT, doel TEXT, uitkomst TEXT,
  fout INTEGER, hint INTEGER, uitwerking INTEGER, ai INTEGER, sec INTEGER, versie TEXT,
  PRIMARY KEY (leerling, t)
);
CREATE INDEX IF NOT EXISTS voortgang_par ON voortgang (leerling, vak, par);
