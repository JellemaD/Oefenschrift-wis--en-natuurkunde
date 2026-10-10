// Cloudflare Worker: AI-bijlesdocent voor Esra's oefenschrift
// Geheim nodig:  ANTHROPIC_API_KEY
// Optioneel:     LEERLINGCODES (geheim, komma-gescheiden). Ingesteld = zonder geldige code geen AI.
// Database:      D1-binding DB (tabellen teller, kosten, meldingen) — zonder database geen AI (veilig dicht).
// Endpoints:     POST /         vraag aan de professor
//                POST /melding  "Dit klopt niet"-melding over een som (geen AI)

const TOEGESTAAN = ["https://jellemad.github.io"]; // alleen de oefensite mag vragen sturen
// Modellen. Gekozen op 9-10-2026 na een test met 10 vaste vragen: Sonnet 5.5, 10/10 juist, beste didactiek.
const MODELLEN = {
  haiku45: { model: "claude-haiku-4-5-20251001", max_tokens: 400 },
  haiku55: { model: "claude-haiku-5-5", max_tokens: 2000, output_config: { effort: "low" } },
  // "fallbacks": weigert Sonnet een vraag, dan beantwoordt een ander model hem automatisch.
  sonnet55: { model: "claude-sonnet-5-5", max_tokens: 2000, output_config: { effort: "low" }, fallbacks: "default", beta: "server-side-fallback-2026-07-01",
    prijs: { in: 2, uit: 10 } } // dollar per miljoen tokens
};
const STANDAARD_MODEL = "sonnet55";
const MODELTEST = false;       // true = body.modeltest mag een model kiezen (alleen voor een vergelijkingstest)
const MAX_BERICHTEN = 6;       // alleen de laatste 6 berichten gaan mee (scheelt tokens)
const MAX_LENGTE = 1000;       // maximaal aantal tekens per bericht
const MAX_CONTEXT = 2500;      // opgave zoals de leerling hem ziet
const MAX_DOCENTINFO = 2500;   // juiste antwoord en uitwerking (alleen voor de professor)
const MAX_BODY = 30000;        // maximale grootte van een verzoek in bytes
const MAX_PER_DAG = 40;        // vragen per leerling(code) per dag
const MAX_TOTAAL_PER_DAG = 120; // vragen voor iedereen samen per dag
const MAX_CENT_PER_MAAND = 1000; // kostenstop: 1000 dollarcent = $ 10 per maand (overschrijfbaar met variabele MAX_CENT_PER_MAAND)
const TIMEOUT_MS = 30000;      // na 30 seconden geven we het op

const DOCENTEN = {
  delta: "Professor Delta, een vriendelijke en geduldige bijlesdocent wiskunde",
  volta: "Professor Volta, een enthousiaste en geduldige bijlesdocent natuurkunde"
};

// Wat de professor weet over het niveau van de leerling. Voeg later mavo en vmbo toe.
const NIVEAUS = {
  havo3: `De leerling zit in havo 3 (14 tot 15 jaar) en gebruikt de boeken Moderne Wiskunde 13e editie (wiskunde) en Nova (natuurkunde); gebruik de woorden van die boeken. Gebruik helder Nederlands op ongeveer B1/B2-niveau met korte zinnen. Vaktermen zoals richtingscoëfficiënt, weerstand en spanning gebruik je gewoon, en je legt ze kort uit als ze nieuw kunnen zijn. Spreek de leerling aan met je en jij: vriendelijk en serieus, niet kinderachtig. Blijf binnen de stof van havo 3: geen differentiëren of integreren en geen formules uit hogere klassen. Verwacht dat ze formules kan invullen en omschrijven, en help haar dat zelf te doen. Gebruik bij lineaire formules y = ax + b deze woorden: a is de richtingscoëfficiënt (afgekort rc; noem één keer dat het ook hellingsgetal heet, en gebruik dat woord als de leerling het zelf zo noemt), b is het startgetal (de y bij x = 0, waar de lijn de y-as snijdt). Leg a uit als "per stap van x gaat y zoveel omhoog of omlaag" en in een tabel als de toename per stap. Zeg lineaire formule, niet lineaire functie. Een vergelijking los je op met de balansmethode: wat je aan de ene kant doet, doe je ook aan de andere kant. Gebruik het woord hellingsdriehoek niet. Controleer elke berekening en elke bewering voordat je antwoordt; een fout antwoord is erger dan een kort antwoord. Een dalparabool (a positief) gaat aan beide kanten omhoog, de top is het laagste punt; een bergparabool (a negatief) gaat aan beide kanten omlaag, de top is het hoogste punt. Schrijf correct Nederlands. Bij parabolen (y = ax² + bx + c) zeg je dalparabool (a positief) en bergparabool (a negatief), top, x-top en y-top, symmetrieas; x-top = −b / 2a. De drie vormen zijn y = ax² + bx + c, y = a(x − p)² + q (top (p, q)) en y = a(x − d)(x − e) (snijpunten met de x-as bij x = d en x = e). Bij natuurkunde: de draden heten fasedraad (bruin), nuldraad (blauw), aarddraad (geel-groen) en schakeldraad (zwart).`
};

// Hoeveel hulp heeft de leerling nodig bij dit onderwerp? De site bepaalt dit uit zelfstandig goed gemaakte sommen.
const STEUN = {
  nieuw: "Dit onderwerp is nieuw voor de leerling: begin met één alledaags voorbeeld, leg het idee uit in twee of drie korte zinnen en laat haar één kleine stap zelf doen. Maximaal 5 zinnen.",
  veel: "De leerling heeft moeite met dit onderwerp: werk in heel kleine stappen, één stap per bericht, met een concreet voorbeeld. Controleer na elke stap met een korte vraag of het klopt en benoem wat al goed gaat. Maximaal 5 korte zinnen.",
  normaal: "Geef eerst een hint of een tegenvraag. Komt de leerling er dan nog niet uit, laat de uitwerking dan stap voor stap zien. Maximaal 4 zinnen.",
  weinig: "De leerling beheerst dit onderwerp al goed: antwoord kort (maximaal 3 zinnen), geef alleen een duwtje in de goede richting en daag haar uit met een lastiger variant als ze het goed heeft."
};

const systeem = (wie, niveau, steun, naam) =>
  `Je bent ${wie}. ${naam ? `Je helpt ${naam}. ` : ""}Je bent een AI-hulp; zeg dat eerlijk als de leerling ernaar vraagt. Help alleen met wiskunde en natuurkunde. ${NIVEAUS[niveau]} ${STEUN[steun]} Geef niet meteen het eindantwoord, tenzij de leerling het echt niet meer weet. Gebruik geen opmaak zoals sterretjes of LaTeX; schrijf formules gewoon, zoals a = Δy / Δx. Gebruik een komma in kommagetallen. Gaat een vraag niet over schoolwerk, zeg dan vriendelijk dat je alleen helpt met wiskunde en natuurkunde. Vertelt de leerling iets persoonlijks of vervelends, reageer dan vriendelijk en kort, vraag niet door en stel voor om dit met ouders, mentor of de Kindertelefoon te bespreken.`;

// B03: de opgave (wat de leerling ziet) en de gegevens voor de docent (antwoord en uitwerking), gescheiden van de leerlingtekst
const opgaveDeel = (context, docentinfo) =>
  (context ? `\n\nDe som of uitleg waar de leerling nu mee bezig is (zoals zij hem ziet):\n<opgave>\n${context}\n</opgave>` : "") +
  (docentinfo ? `\n\nAlleen voor jou als docent, de leerling ziet dit niet:\n<docentinfo>\n${docentinfo}\n</docentinfo>\nGebruik de docentinfo om haar berekening te controleren en een gerichte hint te geven. Verklap het eindantwoord en de uitwerking niet; geef één stap tegelijk. Alleen als ze het zelf al goed heeft, of na een eigen poging uitdrukkelijk om de hele uitwerking vraagt, mag je die laten zien. Gebruik alleen gegevens die in de opgave of docentinfo staan; ontbreekt er iets, vraag het haar dan in plaats van iets te verzinnen.` : "");

const dagNu = () => new Date().toISOString().slice(0, 10);
const maandNu = () => new Date().toISOString().slice(0, 7);
// Atomaire teller in D1: verhoogt en geeft de nieuwe stand terug in één opdracht (geen dubbel tellen bij gelijktijdige vragen)
const tel = (db, sleutel) => db.prepare("INSERT INTO teller (sleutel, n) VALUES (?1, 1) ON CONFLICT(sleutel) DO UPDATE SET n = n + 1 RETURNING n").bind(sleutel).first("n");
const isObj = x => x !== null && typeof x === "object" && !Array.isArray(x);

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": TOEGESTAAN.includes(origin) ? origin : TOEGESTAAN[0],
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin"
    };
    const antw = (obj, status = 200) =>
      new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

    try {
      if (request.method === "OPTIONS") return new Response(null, { headers: cors });
      if (request.method !== "POST") return antw({ fout: "Alleen POST is toegestaan." }, 405);
      if (!TOEGESTAAN.includes(origin)) return antw({ fout: "Niet toegestaan." }, 403);

      // B05: grootte en vorm van het verzoek controleren vóór we er iets mee doen
      const ruw = await request.text();
      if (ruw.length > MAX_BODY) return antw({ fout: "Het bericht is te lang." }, 413);
      let body;
      try { body = JSON.parse(ruw); } catch { return antw({ fout: "Ongeldig verzoek." }, 400); }
      if (!isObj(body)) return antw({ fout: "Ongeldig verzoek." }, 400);
      if (!env.DB) return antw({ fout: "De docent is nog niet goed ingesteld. Vraag het Durk." }, 503); // veilig dicht

      // B04: toegang met leerlingcode (zodra LEERLINGCODES is ingesteld)
      const codes = (env.LEERLINGCODES || "").split(",").map(c => c.trim()).filter(Boolean);
      const code = typeof body.code === "string" ? body.code.trim().slice(0, 40) : "";
      if (codes.length && !codes.includes(code)) return antw({ fout: "Vul de code in die je van Durk hebt gekregen.", nodig: "code" }, 401);
      const wie = codes.length ? "c" + (codes.indexOf(code) + 1) : "open";

      const pad = new URL(request.url).pathname;
      if (pad === "/melding") return await melding(body, env, antw, wie);

      const berichten = (Array.isArray(body.berichten) ? body.berichten : [])
        .filter(m => isObj(m) && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
        .map(m => ({ role: m.role, content: m.content.slice(0, MAX_LENGTE) }))
        .slice(-MAX_BERICHTEN);
      while (berichten.length && berichten[0].role !== "user") berichten.shift();
      if (!berichten.length || berichten[berichten.length - 1].role !== "user")
        return antw({ fout: "Er is geen vraag ontvangen." }, 400);
      const context = typeof body.context === "string" ? body.context.slice(0, MAX_CONTEXT) : "";
      const docentinfo = typeof body.docentinfo === "string" ? body.docentinfo.slice(0, MAX_DOCENTINFO) : "";
      // Alleen bekende waarden worden gebruikt; de rest valt terug op de standaard.
      const niveau = Object.prototype.hasOwnProperty.call(NIVEAUS, body.niveau) ? body.niveau : "havo3";
      const steun = Object.prototype.hasOwnProperty.call(STEUN, body.steun) ? body.steun : "normaal";
      const naam = typeof body.bijnaam === "string" && /^[\p{L}][\p{L} -]{0,19}$/u.test(body.bijnaam.trim()) ? body.bijnaam.trim() : "";

      // B04: kostenstop per maand en limieten per dag (atomair geteld)
      const maxCent = parseInt(env.MAX_CENT_PER_MAAND || MAX_CENT_PER_MAAND, 10);
      const kosten = await env.DB.prepare("SELECT millicent FROM kosten WHERE maand = ?1").bind(maandNu()).first("millicent");
      if ((kosten || 0) >= maxCent * 1000) return antw({ fout: "Het budget voor de professor is deze maand op. Vraag het Durk." }, 429);
      if ((await tel(env.DB, `dag:${dagNu()}`)) > MAX_TOTAAL_PER_DAG) return antw({ fout: "De professor heeft vandaag al heel veel vragen gehad. Probeer het morgen weer, of vraag het Durk." }, 429);
      if ((await tel(env.DB, `dag:${dagNu()}:${wie}`)) > MAX_PER_DAG) return antw({ fout: "Je hebt vandaag al veel vragen gesteld. Probeer het morgen weer, of vraag het Durk." }, 429);

      const kies = MODELTEST && Object.prototype.hasOwnProperty.call(MODELLEN, body.modeltest) ? body.modeltest : STANDAARD_MODEL;
      const m = MODELLEN[kies];
      // B05: niet eindeloos wachten
      const stop = new AbortController(), klok = setTimeout(() => stop.abort(), parseInt(env.TIMEOUT_MS || TIMEOUT_MS, 10));
      let r;
      try {
        r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST", signal: stop.signal,
          headers: {
            "x-api-key": env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
            ...(m.beta ? { "anthropic-beta": m.beta } : {})
          },
          body: JSON.stringify({
            model: m.model,
            max_tokens: m.max_tokens,
            ...(m.output_config ? { output_config: m.output_config } : {}),
            ...(m.fallbacks ? { fallbacks: m.fallbacks } : {}),
            system: systeem(DOCENTEN[body.docent] || DOCENTEN.delta, niveau, steun, naam) + opgaveDeel(context, docentinfo),
            messages: berichten
          })
        });
      } catch (e) {
        console.log("AI niet bereikt", e && e.name);
        return antw({ fout: e && e.name === "AbortError" ? "De docent doet er te lang over. Probeer het nog een keer." : "De docent is even niet bereikbaar. Probeer het later opnieuw." }, e && e.name === "AbortError" ? 504 : 502);
      } finally { clearTimeout(klok); }

      if (!r.ok) {
        console.log("API-fout", r.status, (await r.text()).slice(0, 500));
        return antw({ fout: "De docent is even niet bereikbaar. Probeer het later opnieuw." }, 502);
      }
      const data = await r.json();
      const tekst = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n").trim();

      // Kosten bijhouden voor de kostenstop (in duizendsten van een dollarcent)
      const u = data.usage || {}, prijs = m.prijs || { in: 2, uit: 10 };
      const millicent = Math.ceil(((u.input_tokens || 0) * prijs.in + (u.output_tokens || 0) * prijs.uit) / 1e6 * 100 * 1000);
      await env.DB.prepare("INSERT INTO kosten (maand, millicent, vragen) VALUES (?1, ?2, 1) ON CONFLICT(maand) DO UPDATE SET millicent = millicent + ?2, vragen = vragen + 1").bind(maandNu(), millicent).run();

      // B06: logregel zodat Durk kan meelezen (Cloudflare > Worker > Logs, enkele dagen bewaard).
      // Alleen vraag en antwoord; geen opgave of docentinfo.
      console.log(JSON.stringify({ wie, model: kies, stop: data.stop_reason, niveau, steun, vraag: berichten[berichten.length - 1].content, antwoord: tekst, tokens: u, millicent }));

      return antw({ antwoord: tekst || "Ik weet het even niet. Probeer je vraag anders te stellen.", ...(MODELTEST && body.modeltest ? { model: kies, tokens: u } : {}) });
    } catch (e) {
      console.log("Onverwachte fout", e && e.message);
      return antw({ fout: "Er ging iets mis bij de docent. Probeer het nog een keer." }, 500);
    }
  }
};

// B14: "Dit klopt niet" — opslaan in de database zodat Durk de som kan nabootsen
async function melding(body, env, antw, wie) {
  if ((await tel(env.DB, `melding:${dagNu()}`)) > 30) return antw({ fout: "Er zijn vandaag al veel meldingen. Probeer het morgen weer." }, 429);
  const versie = typeof body.versie === "string" ? body.versie.slice(0, 30) : "";
  const oefening = typeof body.oefening === "string" ? body.oefening.slice(0, 60) : "";
  const gegevens = JSON.stringify(isObj(body.gegevens) ? body.gegevens : {}).slice(0, 6000);
  await env.DB.prepare("INSERT INTO meldingen (tijd, versie, oefening, gegevens) VALUES (?1, ?2, ?3, ?4)").bind(new Date().toISOString(), versie, oefening, gegevens).run();
  console.log(JSON.stringify({ melding: oefening, versie, wie }));
  return antw({ ok: true });
}
