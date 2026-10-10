// Vaste testset voor Esra's oefenschrift (backlog B10).
// Gebruik:  node tests/test.js [pad/naar/index.html]
// Draai dit vóór elke publicatie. Eindigt met "ALLES GROEN" of met een lijst fouten (exitcode 1).
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");

const bestand = process.argv[2] || path.join(__dirname, "..", "index.html");
const html = fs.readFileSync(bestand, "utf8");
const script = html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>"));

// Herhaalbaar toeval: elke run dezelfde sommen
function zaad(n) { return () => { n = (n * 1664525 + 1013904223) % 4294967296; return n / 4294967296; }; }
const ctx = { console, Math: Object.create(Math), setTimeout, clearTimeout, module: { exports: {} } };
ctx.Math.random = zaad(20261010);
vm.createContext(ctx);
// Testhaakjes: in hetzelfde script, zodat ook de interne let-variabelen bereikbaar zijn
vm.runInContext(script + `
;globalThis.__T = { ONDERWERPEN, UITLEGGEN, KOPPELING, BOEKEN, parseNum, fmt, klopt, antwoordType, gelezenAls, isTwijfel, uKey, parNr, uitlegDuur, start, telMee,
  zet: (o, s, g, a, u = false) => { onderwerp = o; som = s; geprobeerd = g; afgerond = a; uitwerkingGezien = u; }, paragraafUitleg, paragraafVan, scores: () => scores, maakLeeg: () => { scores = {}; } };`, ctx);
const T = ctx.__T;

const fouten = []; let aantal = 0;
const check = (ok, melding) => { aantal++; if (!ok) fouten.push(melding); };
const str = (x, d) => (d === undefined ? String(x) : x.toFixed(d)).replace(".", ","); // zoals Esra typt
const strip = h => String(h).replace(/<svg[\s\S]*?<\/svg>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const goed = (v, invoer) => T.klopt(T.parseNum(invoer), invoer, v);

// 1. Vaste randgevallen uit de review (10-10-2026)
const EXACT = { abs: 0.001, rel: 0.001 }, AFRONDEN = { abs: 0.01, rel: 0.02 };
const gevallen = [
  [{ val: 1000, tol: EXACT }, "1000", true], [{ val: 1000, tol: EXACT }, "1001", false], [{ val: 1000, tol: EXACT }, "999", false],
  [{ val: 2250, tol: AFRONDEN }, "2251", false], [{ val: 668800, tol: AFRONDEN }, "668 800", true], [{ val: 668800, tol: AFRONDEN }, "668801", false],
  [{ val: 3.7320508, dec: 2 }, "3,73", true], [{ val: 3.7320508, dec: 2 }, "3,74", false], [{ val: 3.7320508, dec: 2 }, "3,7321", true], [{ val: 3.7320508, dec: 2 }, "3,7", false],
  [{ val: -4, tol: EXACT }, "−4", true], [{ val: -4, tol: EXACT }, "4", false], [{ val: 0, tol: EXACT }, "0", true], [{ val: 0, tol: EXACT }, "0,001", false],
  [{ val: 1.5, tol: EXACT }, "3/2", true], [{ val: 1.5, tol: EXACT }, "1,5", true], [{ val: 1.5, tol: EXACT }, "1.5", true], [{ val: 1.5, tol: EXACT }, "1,49", false],
  [{ val: 2300 / 230 * 0.4347826, tol: AFRONDEN }, "4,35", true],
  [{ val: 1150 / 230 * 0.869565, tol: AFRONDEN }, "4,3", true], [{ val: 4.3478, tol: AFRONDEN }, "4", false], [{ val: 4.3478, tol: AFRONDEN }, "4,4", false], [{ val: 4.3478, tol: AFRONDEN }, "4,34", false],
  [{ val: 49.05, tol: AFRONDEN }, "49,05", true], [{ val: 49.05, tol: AFRONDEN }, "49", false],
  [{ val: 1.962, tol: AFRONDEN }, "1,96", true], [{ val: 1.962, tol: AFRONDEN }, "2", false],
  [{ val: 0.552, dec: 2 }, "0,55", true], [{ val: 0.552, dec: 2 }, "0,56", false]
];
for (const [v, invoer, verwacht] of gevallen) check(goed(v, invoer) === verwacht, `randgeval: ${invoer} bij ${v.val} (${T.antwoordType(v)}) moet ${verwacht ? "goed" : "fout"} zijn`);

// 2. Getalinvoer
const parse = [["2,5", 2.5], ["2.5", 2.5], ["−3", -3], ["-3", -3], ["3/2", 1.5], ["3,5/7", 0.5], ["1 000", 1000], ["668 800", 668800], [" 7 ", 7],
  ["1.234", 1.234], ["1,234", 1.234], ["1.234,5", 1234.5], ["1,234.5", 1234.5], ["1 234,5", 1234.5], ["−1.234,5", -1234.5],
  ["12.345.678", NaN], ["1,2,3", NaN], ["1.23,4", NaN], ["abc", NaN], ["", NaN], ["3/0", NaN]];
for (const [inv, w] of parse) { const x = T.parseNum(inv); check(Number.isNaN(w) ? Number.isNaN(x) : x === w, `parseNum("${inv}") = ${x}, verwacht ${w}`); }

// 2b. Wat naast het vakje staat bij twijfel
for (const [inv, w] of [["2,5", ""], ["-3", ""], ["1.234", "= 1,234"], ["2.5", "= 2,5"], ["1 000", ""], ["1 776 500", ""], ["1.776.500", "schrijf 1 776 500"], ["3/2", "= 1,5"], ["abc", "geen getal"]]) check(T.gelezenAls(inv) === w, `gelezenAls("${inv}") = "${T.gelezenAls(inv)}", verwacht "${w}"`);
check(T.isTwijfel("668.800") && T.isTwijfel("1.234") && !T.isTwijfel("2.5") && !T.isTwijfel("1,234"), "isTwijfel herkent 668.800/1.234 niet goed");

// 3. Elke oefening: 150 sommen. Goed antwoord goed, fout antwoord fout, tekst zonder rommel
const rommel = [[/NaN|undefined|Infinity/, "NaN/undefined"], [/\+ −|− −|\+ \+/, "dubbel teken"], [/(^|[^\d,])1x\b/, "1x"], [/\(x\)/, "(x)"], [/f\(/, "f(…)"]];
for (const o of T.ONDERWERPEN) {
  for (let i = 0; i < 150; i++) {
    let q; try { q = o.gen(); } catch (e) { check(false, `${o.id}: fout in generator: ${e.message}`); break; }
    for (const veld of ["vraag", "hint", "stappen"]) { const t = strip(q[veld]); for (const [re, naam] of rommel) if (re.test(t)) { check(false, `${o.id}: ${naam} in ${veld}: …${t.slice(Math.max(0, t.search(re) - 30), t.search(re) + 30)}`); } }
    q.velden.forEach((v, j) => {
      const type = T.antwoordType(v), lab = `${o.id} veld ${j + 1} (${type}, ${v.val})`;
      check(isFinite(v.val), `${lab}: geen getal`);
      const juist = type === "dec" ? str(v.val, v.dec) : type === "afronden" ? str(v.val, 4) : str(Math.round(v.val * 1000) / 1000);
      check(goed(v, juist), `${lab}: juist antwoord "${juist}" afgekeurd`);
      // fout = duidelijk naast elke geldige afronding (bij dec: anderhalve stap ernaast)
      const stap = type === "dec" ? 1.5 * 10 ** -v.dec : type === "afronden" ? Math.max(0.05 * Math.abs(v.val), 0.01) : (Number.isInteger(v.val) ? 1 : 0.01);
      for (const fout of [v.val + stap, v.val - stap]) { const inv = type === "dec" ? str(fout, v.dec) : str(Math.round(fout * 10000) / 10000); check(!goed(v, inv), `${lab}: fout antwoord "${inv}" goedgekeurd`); }
      if (Math.abs(v.val) > 1e-9) { const inv = type === "dec" ? str(-v.val, v.dec) : str(Math.round(-v.val * 10000) / 10000); check(!goed(v, inv), `${lab}: tegengesteld teken "${inv}" goedgekeurd`); }
    });
    if (fouten.length > 40) break;
  }
}

// 4. Uitleg: elke stap tekent zonder fouten; oefening en paragraaf bestaan
for (const [k, u] of Object.entries(T.UITLEGGEN)) {
  u.stappen.forEach((st, i) => { let svg = ""; try { svg = u.teken(st.teken); } catch (e) { check(false, `uitleg ${k} stap ${i + 1}: ${e.message}`); } check(!/NaN|undefined/.test(svg + st.tekst), `uitleg ${k} stap ${i + 1}: NaN/undefined`); if (st.teken.wijs !== undefined) check(/class="wijs"/.test(svg), `uitleg ${k} stap ${i + 1}: wijs-markering ontbreekt`); });
  check(!u.oefen || T.ONDERWERPEN.some(o => o.id === u.oefen), `uitleg ${k}: oefening "${u.oefen}" bestaat niet`);
  const h = T.BOEKEN[u.vak].hoofdstukken.find(h => h.nr === u.hfst), p = h && h.par.find(p => p.nr === T.parNr(k));
  check(!!p, `uitleg ${k}: paragraaf bestaat niet in het boek`); if (p) check(p.titel === u.titel, `uitleg ${k}: titel "${u.titel}" ≠ boek "${p.titel}"`);
}

// 5. Koppeling: elke oefening hangt aan een bestaande paragraaf
for (const o of T.ONDERWERPEN) {
  const k = T.KOPPELING[o.id]; check(!!k, `${o.id}: geen koppeling`); if (!k || k.hfst === "herhaling") continue;
  const h = T.BOEKEN[o.vak].hoofdstukken.find(h => h.nr === k.hfst); check(!!(h && h.par.find(p => p.nr === k.par)), `${o.id}: paragraaf ${k.hfst}/${k.par} bestaat niet`);
}

// 6. B09: fout antwoord en dan wisselen van oefening → fout telt bij de OUDE oefening
{
  const el = new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => "" : k === "classList" ? { add() {}, remove() {}, toggle() {}, contains: () => false } : k === "style" || k === "dataset" ? {} : k === "value" || k === "textContent" || k === "innerHTML" ? "" : k === "children" ? [] : el, apply: () => el, set: () => true });
  ctx.document = { getElementById: () => el, querySelector: () => el, querySelectorAll: () => [], createElement: () => el, body: el, addEventListener() {} };
  ctx.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  ctx.window = el; ctx.speechSynthesis = el; ctx.navigator = el;
  const [A, B] = T.ONDERWERPEN.filter(o => o.vak === "wis");
  T.maakLeeg(); T.zet(A, { ...A.gen(), id: A.id }, true, false);
  try { T.start(B.id); } catch (e) { check(false, `B09: start() faalt in de test: ${e.message}`); }
  const sc = T.scores();
  check(sc[A.id] && sc[A.id].tot === 1 && sc[A.id].goed === 0, `B09: fout niet bij oude oefening ${A.id} geteld (${JSON.stringify(sc[A.id])})`);
  check(!sc[B.id], `B09: fout ten onrechte bij nieuwe oefening ${B.id} geteld`);
}

// 7. B08: zelfstandig goed ≠ opgelost met hulp
{
  const A = T.ONDERWERPEN.find(o => o.id === "rc-punten");
  T.maakLeeg();
  T.zet(A, { ...A.gen(), id: A.id, fout: 1 }, true, false); T.telMee(true);           // fout → goed: met hulp
  T.zet(A, { ...A.gen(), id: A.id, hintGezien: true }, true, false); T.telMee(true);  // hint → goed: met hulp
  T.zet(A, { ...A.gen(), id: A.id, aiGebruikt: true }, true, false); T.telMee(true);  // professor gevraagd: met hulp
  T.zet(A, { ...A.gen(), id: A.id }, true, false, true); T.telMee(true);              // uitwerking bekeken: met hulp
  T.zet(A, { ...A.gen(), id: A.id }, true, false); T.telMee(true);                    // direct goed: zelfstandig
  const sc = T.scores()[A.id];
  check(sc.tot === 5 && sc.goed === 1 && sc.opgelost === 5 && sc.metHulp === 4, `B08: telling klopt niet: ${JSON.stringify(sc)}`);
  check(JSON.stringify(sc.recent) === "[0,0,0,0,1]", `B08: steunniveau telt hulp mee: ${JSON.stringify(sc.recent)}`);
}

// 8. B28: geschreven uitleg bevat elke stap van de uitleg van de professor
for (const [k, u] of Object.entries(T.UITLEGGEN)) {
  const o = T.ONDERWERPEN.find(o => o.vak === u.vak && T.KOPPELING[o.id] && T.KOPPELING[o.id].hfst === u.hfst && T.KOPPELING[o.id].par === T.parNr(k));
  if (!o) { check(false, `B28: geen oefening bij uitleg ${k}`); continue; }
  const tekst = T.paragraafUitleg(o, T.paragraafVan(o.id));
  for (const st of u.stappen.filter(st => !st.eind)) check(tekst.includes(st.tekst), `B28: uitleg ${k} mist stap "${strip(st.tekst).slice(0, 40)}"`);
  check(tekst.includes(o.uitleg), `B28: uitleg ${k} mist de tips van de oefening`);
}

// 9. B03: bij grafiekvragen gaat een beschrijving met getallen mee
for (const id of ["rc-grafiek", "diagram", "hoek-fz"]) {
  const o = T.ONDERWERPEN.find(o => o.id === id);
  for (let i = 0; i < 30; i++) { const q = o.gen(); check(typeof q.grafiek === "string" && /\d/.test(q.grafiek), `B03: ${id} zonder grafiekbeschrijving`); }
}

console.log(`${aantal} controles, ${T.ONDERWERPEN.length} oefeningen, ${Object.keys(T.UITLEGGEN).length} uitleggen.`);
if (fouten.length) { console.log(`\n${fouten.length} FOUT(EN):`); for (const f of fouten.slice(0, 60)) console.log(" - " + f); process.exit(1); }
console.log("ALLES GROEN");
