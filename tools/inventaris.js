// Inventaris van de site, rechtstreeks uit de code (backlog B20).
// Gebruik: node tools/inventaris.js  -> schrijft INVENTARIS.md (release.js doet dit automatisch)
// Zo staan aantallen nooit meer handmatig (en verouderd) in documenten.
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const script = html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>"));
const ctx = { console: { log() {}, warn() {}, error() {} }, Math, setTimeout, clearTimeout, module: { exports: {} } };
vm.createContext(ctx);
vm.runInContext(script + ";globalThis.__T = { ONDERWERPEN, UITLEGGEN, KOPPELING, BOEKEN, CONTROLE, METING, VERSIE };", ctx);
const { ONDERWERPEN, UITLEGGEN, KOPPELING, BOEKEN, CONTROLE, METING, VERSIE } = ctx.__T;

const uitlegVan = (vak, nr) => UITLEGGEN[vak === "nat" ? "nat:" + nr : nr];
const oefVan = (vak, nr) => ONDERWERPEN.filter(o => o.vak === vak && (KOPPELING[o.id] || {}).par === nr);
const r = [];
r.push(`# Inventaris — versie ${VERSIE}`, "", "Automatisch gemaakt uit `index.html` door `tools/inventaris.js`. Niet met de hand bewerken.", "");
r.push("| Vak | Boek | Paragrafen | Met uitleg professor | Met oefeningen | Oefeningen | Meting |", "|---|---|---|---|---|---|---|");
for (const vak of Object.keys(BOEKEN)) {
  const pars = BOEKEN[vak].hoofdstukken.flatMap(h => h.par);
  r.push(`| ${vak === "wis" ? "Wiskunde" : "Natuurkunde"} | ${BOEKEN[vak].boek} | ${pars.length} | ${pars.filter(p => uitlegVan(vak, p.nr)).length} | ${pars.filter(p => oefVan(vak, p.nr).length).length} | ${ONDERWERPEN.filter(o => o.vak === vak).length} | ${(METING[vak] || []).reduce((n, d) => n + d.n, 0)} vragen over ${(METING[vak] || []).length} leerdoelen |`);
}
r.push("", `Totaal: ${ONDERWERPEN.length} oefeningen, ${Object.keys(UITLEGGEN).length} uitleggen van de professor, ${Object.keys(CONTROLE).length} controlevragen.`, "");
for (const vak of Object.keys(BOEKEN)) {
  r.push(`## ${vak === "wis" ? "Wiskunde" : "Natuurkunde"}`, "", "| Par. | Titel | Uitleg | Oefeningen |", "|---|---|---|---|");
  for (const h of BOEKEN[vak].hoofdstukken) for (const p of h.par) {
    const oef = oefVan(vak, p.nr);
    r.push(`| ${p.nr} | ${p.titel} | ${uitlegVan(vak, p.nr) ? "ja" : "–"} | ${oef.length ? oef.map(o => o.titel).join("; ") : "–"} |`);
  }
  r.push("");
}
fs.writeFileSync(path.join(root, "INVENTARIS.md"), r.join("\n"));
console.log(`INVENTARIS.md bijgewerkt (${ONDERWERPEN.length} oefeningen, ${Object.keys(UITLEGGEN).length} uitleggen).`);
