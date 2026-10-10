// Lokale test van de worker (B04, B05, B03): nagebootste database en AI, geen kosten.
// Gebruik: node tests/worker.test.mjs
import worker from "../worker.js";
let fouten = 0, n = 0;
const check = (ok, m) => { n++; if (!ok) { fouten++; console.log(" - FOUT: " + m); } };

function nepDB() {
  const teller = new Map(), kosten = new Map(), meldingen = [], gesprekken = [], voortgang = new Map(), weg = [];
  return { teller, kosten, meldingen, gesprekken, voortgang, weg,
    async batch(lijst) { return Promise.all(lijst.map(x => x.run())); },
    prepare(sql) { return { bind(...a) { return {
    async first(kol) {
      if (sql.startsWith("INSERT INTO teller")) { const v = (teller.get(a[0]) || 0) + 1; teller.set(a[0], v); return v; }
      if (sql.startsWith("SELECT millicent")) return kosten.get(a[0])?.millicent ?? null;
    },
    async run() {
      if (sql.startsWith("INSERT INTO kosten")) { const k = kosten.get(a[0]) || { millicent: 0, vragen: 0 }; k.millicent += a[1]; k.vragen++; kosten.set(a[0], k); }
      if (sql.startsWith("INSERT INTO meldingen")) meldingen.push(a);
      if (sql.startsWith("INSERT INTO gesprekken")) gesprekken.push(a);
      if (sql.startsWith("INSERT OR IGNORE INTO voortgang") && !voortgang.has(a[0] + "|" + a[1])) voortgang.set(a[0] + "|" + a[1], a);
      if (sql.startsWith("DELETE")) weg.push([sql.split(" ")[2], a[0]]);
    } }; } }; } };
}
let laatsteSysteem = "", aiGedrag = "ok";
globalThis.fetch = async (url, opt) => {
  const body = JSON.parse(opt.body); laatsteSysteem = body.system;
  if (aiGedrag === "traag") return new Promise((_, nee) => opt.signal.addEventListener("abort", () => { const e = new Error("abort"); e.name = "AbortError"; nee(e); }));
  if (aiGedrag === "kapot") throw new TypeError("netwerk");
  return new Response(JSON.stringify({ content: [{ type: "text", text: "Probeer eerst Δy te tellen." }], stop_reason: "end_turn", usage: { input_tokens: 1500, output_tokens: 200 } }), { status: 200 });
};
const vraag = (body, env, pad = "/") => worker.fetch(new Request("https://w.dev" + pad, { method: "POST", headers: { Origin: "https://jellemad.github.io", "Content-Type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) }), env);
const goedeVraag = { docent: "delta", berichten: [{ role: "user", content: "Hoe begin ik?" }], context: "Opgave: lijn door P(1, 3) en Q(4, 9)", docentinfo: "Juist antwoord: a = 2, b = 1" };
console.log = (() => { const echt = console.log; return (...x) => { if (typeof x[0] === "string" && x[0].startsWith(" - FOUT")) echt(...x); }; })();
const log = s => process.stdout.write(s + "\n");

let env = { DB: nepDB(), ANTHROPIC_API_KEY: "x" };
// B05: rare verzoeken geven een nette fout
for (const [b, st] of [["null", 400], ['{"berichten":[null]}', 400], ["[1,2]", 400], ["geen json", 400], ["x".repeat(40000), 413], [{ berichten: [] }, 400]]) {
  const r = await vraag(b, env); check(r.status === st, `verzoek ${String(b).slice(0, 25)} → ${r.status}, verwacht ${st}`); }
// zonder Origin
{ const r = await worker.fetch(new Request("https://w.dev/", { method: "POST", body: JSON.stringify(goedeVraag) }), env); check(r.status === 403, "zonder Origin moet 403"); }
// veilig dicht zonder database
{ const r = await vraag(goedeVraag, { ANTHROPIC_API_KEY: "x" }); check(r.status === 503, "zonder DB moet 503"); }
// gewone vraag + B03: opgave en docentinfo apart in de systeeminstructie
{ const r = await vraag(goedeVraag, env); const d = await r.json(); check(r.status === 200 && d.antwoord, "gewone vraag moet antwoord geven");
  check(laatsteSysteem.includes("<opgave>") && laatsteSysteem.includes("P(1, 3)") && laatsteSysteem.includes("<docentinfo>") && laatsteSysteem.includes("a = 2"), "B03: opgave en docentinfo ontbreken in systeeminstructie");
  check(/Verklap het eindantwoord/.test(laatsteSysteem), "B03: instructie niet verklappen ontbreekt"); }
// B04: leerlingcode
{ const e2 = { ...env, LEERLINGCODES: "esra-123, test-9" };
  check((await vraag(goedeVraag, e2)).status === 401, "zonder code moet 401");
  check((await vraag({ ...goedeVraag, code: "fout" }, e2)).status === 401, "verkeerde code moet 401");
  check((await vraag({ ...goedeVraag, code: "esra-123" }, e2)).status === 200, "goede code moet 200"); }
// B04: 60 gelijktijdige vragen → precies 40 toegestaan per leerling
{ const e3 = { DB: nepDB(), ANTHROPIC_API_KEY: "x" };
  const res = await Promise.all(Array.from({ length: 60 }, () => vraag(goedeVraag, e3)));
  const ok = res.filter(r => r.status === 200).length, te = res.filter(r => r.status === 429).length;
  check(ok === 40 && te === 20, `60 gelijktijdig: ${ok} goed, ${te} geweigerd (verwacht 40/20)`); }
// B04: kostenstop
{ const e4 = { DB: nepDB(), ANTHROPIC_API_KEY: "x", MAX_CENT_PER_MAAND: "1" };
  e4.DB.kosten.set(new Date().toISOString().slice(0, 7), { millicent: 1000, vragen: 5 });
  check((await vraag(goedeVraag, e4)).status === 429, "budget op moet 429"); }
// B05: AI traag of kapot
aiGedrag = "traag"; { const r = await vraag(goedeVraag, { ...env, TIMEOUT_MS: "50" }); check(r.status === 504, `traag moet 504 (${r.status})`); }
aiGedrag = "kapot"; { const r = await vraag(goedeVraag, env); check(r.status === 502, `kapot moet 502 (${r.status})`); }
aiGedrag = "ok";
// B14: melding
{ const r = await vraag({ versie: "2026.10.10-6", oefening: "abc", gegevens: { invoer: "3,74" } }, env, "/melding"); check(r.status === 200 && env.DB.meldingen.length === 1, "melding moet opgeslagen worden"); }
// B30/B31: bewaren staat standaard uit
{ const e5 = { DB: nepDB(), ANTHROPIC_API_KEY: "x" };
  const d = await (await vraag(goedeVraag, e5)).json(); check(d.bewaren === false && e5.DB.gesprekken.length === 0, "bewaren uit: geen gesprek opslaan");
  const v = await (await vraag({ regels: [{ t: 1, uitkomst: "zelf" }] }, e5, "/voortgang")).json(); check(v.bewaren === false && e5.DB.voortgang.size === 0, "bewaren uit: geen voortgang opslaan");
  const e6 = { ...e5, BEWAREN: "aan" }; // aan, maar zonder leerlingcodes: nog steeds niets
  check((await (await vraag(goedeVraag, e6)).json()).bewaren === false && e5.DB.gesprekken.length === 0, "bewaren zonder codes moet uit blijven"); }
{ const e7 = { DB: nepDB(), ANTHROPIC_API_KEY: "x", BEWAREN: "aan", LEERLINGCODES: "esra-123" };
  const d = await (await vraag({ ...goedeVraag, code: "esra-123", oefening: "rc-punten", vak: "wis", versie: "2026.10.10-9" }, e7)).json();
  const g = e7.DB.gesprekken[0] || [];
  check(d.bewaren === true && e7.DB.gesprekken.length === 1, "bewaren aan: gesprek opslaan");
  check(/^l[0-9a-f]{12}$/.test(g[1]) && !JSON.stringify(g).includes("esra-123"), "pseudoniem: geen code in de database");
  check(g[3] === "rc-punten" && g[6].includes("P(1, 3)") && !JSON.stringify(g).includes("a = 2"), "opgave wel, docentinfo niet bewaren");
  const regels = Array.from({ length: 250 }, (_, i) => ({ t: 1700000000000 + i, soort: "som", vak: "wis", par: "1.1", id: "rc-punten", uitkomst: i % 2 ? "zelf" : "hulp", fout: 0 }));
  const v = await (await vraag({ code: "esra-123", regels }, e7, "/voortgang")).json();
  check(v.bewaren && v.opgeslagen === 200 && e7.DB.voortgang.size === 200, `voortgang: max 200 per keer (${e7.DB.voortgang.size})`);
  await vraag({ code: "esra-123", regels: regels.slice(0, 5) }, e7, "/voortgang");
  check(e7.DB.voortgang.size === 200, "voortgang: dubbel versturen geeft geen dubbele regels");
  check([...e7.DB.voortgang.values()][0][0] === g[1], "voortgang en gesprek onder hetzelfde pseudoniem");
  check((await vraag({ code: "fout", regels }, e7, "/voortgang")).status === 401, "voortgang zonder geldige code moet 401");
  await worker.scheduled({}, e7);
  check(e7.DB.weg.length === 4 && e7.DB.weg.every(([, grens]) => typeof grens === "string" && grens < new Date().toISOString()), "opruimen: vier tabellen met een grens in het verleden"); }
log(`${n} controles worker`); if (fouten) { log(`${fouten} FOUT(EN)`); process.exit(1); } log("WORKER GROEN");
