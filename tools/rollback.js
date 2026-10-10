// Terug naar een eerdere versie, zonder geschiedenis te wissen.
// Gebruik:  node tools/rollback.js 2026.10.10-3          (laat zien wat er gebeurt)
//           node tools/rollback.js 2026.10.10-3 --ja     (voert het uit en publiceert)
// Werking: zet index.html (en tests/) terug zoals ze in die versie waren, geeft dat een NIEUW
// versienummer (bijv. 2026.10.11-1) met "rollback naar …" in CHANGELOG.md, en publiceert dat als
// gewone nieuwe versie. Een rollback is zo zelf ook weer terug te draaien.
"use strict";
const { execSync, spawnSync } = require("child_process"), fs = require("fs"), path = require("path");
const root = path.join(__dirname, ".."), sh = (c, input) => execSync(c, { cwd: root, encoding: "utf8", input }).trim();
const [doel, ja] = process.argv.slice(2);
if (!doel) { console.error("Gebruik: node tools/rollback.js <versie> [--ja]\nVersies: " + sh("git tag -l v* --sort=-creatordate").split("\n").slice(0, 10).join(", ")); process.exit(1); }
const tag = doel.startsWith("v") ? doel : "v" + doel;
if (!sh(`git tag -l ${tag}`)) { console.error(`Versie ${tag} bestaat niet.`); process.exit(1); }

const vandaag = new Date().toLocaleString("sv-SE", { timeZone: "Europe/Amsterdam" }).slice(0, 10).replace(/-/g, ".");
const nr = Math.max(0, ...sh(`git tag -l v${vandaag}-*`).split("\n").filter(Boolean).map(t => +t.split("-").pop())) + 1;
const nieuw = `${vandaag}-${nr}`;
console.log(`Rollback: index.html${sh(`git ls-tree --name-only ${tag} tests`) ? " en tests/" : ""} terug naar ${tag}, gepubliceerd als nieuwe versie ${nieuw}.`);
if (ja !== "--ja") { console.log("Niets gewijzigd. Voeg --ja toe om het uit te voeren."); process.exit(0); }

sh(`git checkout ${tag} -- index.html`);
if (sh(`git ls-tree --name-only ${tag} tests`)) sh(`git checkout ${tag} -- tests`);
const pad = path.join(root, "index.html");
let html = fs.readFileSync(pad, "utf8");
html = /const VERSIE = "[^"]+"/.test(html) ? html.replace(/const VERSIE = "[^"]+"/, `const VERSIE = "${nieuw}"`) : html;
fs.writeFileSync(pad, html);
const datum = new Date().toLocaleString("sv-SE", { timeZone: "Europe/Amsterdam" }).slice(0, 16);
const clPad = path.join(root, "CHANGELOG.md");
fs.writeFileSync(clPad, fs.readFileSync(clPad, "utf8").replace("<!-- VERSIES -->\n", `<!-- VERSIES -->\n\n## ${nieuw} · ${datum}\n\nRollback naar ${tag.slice(1)}: site teruggezet naar die versie.\n`));
if (fs.existsSync(path.join(root, "tests/test.js"))) {
  const t = spawnSync(process.execPath, ["tests/test.js"], { cwd: root, encoding: "utf8" });
  console.log(t.stdout.split("\n").slice(-2).join("\n"));
  if (t.status !== 0) console.log("Let op: de testset van die oude versie is niet groen. GitHub publiceert dan niet; zie Actions.");
}
sh("git add -A");
sh(`git commit -q -m ${JSON.stringify(`Rollback naar ${tag.slice(1)} (versie ${nieuw})\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`)}`);
sh(`git tag -a v${nieuw} -m ${JSON.stringify(`Rollback naar ${tag.slice(1)}`)}`);
sh("git push -q origin main"); sh(`git push -q origin v${nieuw}`);
console.log(`Klaar: versie ${nieuw} = ${tag}. Zichtbaar zodra GitHub Actions de site heeft gepubliceerd (± 1 minuut).`);
