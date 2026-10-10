// Nieuwe versie publiceren.
// Gebruik: node tools/release.js "Korte omschrijving" [B03,B05]
// 1. leest VERSIE uit index.html   2. draait de testset (stopt bij rood)
// 3. zet de versie in CHANGELOG.md   4. commit + tag v<VERSIE>   5. push naar GitHub
// GitHub publiceert de site daarna alleen als de testset daar ook groen is (.github/workflows/pages.yml).
"use strict";
const { execSync, spawnSync } = require("child_process"), fs = require("fs"), path = require("path");
const root = path.join(__dirname, ".."), sh = (c, input) => execSync(c, { cwd: root, encoding: "utf8", input }).trim();
const [omschrijving, items = ""] = process.argv.slice(2);
if (!omschrijving) { console.error('Gebruik: node tools/release.js "Korte omschrijving" [B03,B05]'); process.exit(1); }

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const versie = (html.match(/const VERSIE = "([^"]+)"/) || [])[1];
if (!versie) { console.error("Geen VERSIE gevonden in index.html"); process.exit(1); }
if (sh(`git tag -l v${versie}`)) { console.error(`Tag v${versie} bestaat al. Hoog VERSIE op in index.html.`); process.exit(1); }

const test = spawnSync(process.execPath, ["tests/test.js"], { cwd: root, encoding: "utf8" });
process.stdout.write(test.stdout.split("\n").slice(-3).join("\n") + "\n");
if (test.status !== 0) { console.error("Testset is ROOD — niet gepubliceerd.\n" + test.stdout); process.exit(1); }

const datum = new Date().toLocaleString("sv-SE", { timeZone: "Europe/Amsterdam" }).slice(0, 16);
const clPad = path.join(root, "CHANGELOG.md");
let cl = fs.readFileSync(clPad, "utf8");
if (!cl.includes(`## ${versie} `)) {
  const blok = `## ${versie} · ${datum}\n\n${omschrijving}${items ? `\n\nBacklog: ${items}` : ""}\n\n`;
  cl = cl.replace("<!-- VERSIES -->\n", `<!-- VERSIES -->\n\n${blok.trimEnd()}\n`); // nieuwste bovenaan
  fs.writeFileSync(clPad, cl);
}
sh("git add -A");
if (sh("git status --porcelain")) sh(`git commit -q -m ${JSON.stringify(`${omschrijving} (versie ${versie})${items ? `\n\nBacklog: ${items}` : ""}\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`)}`);
sh(`git tag -a v${versie} -m ${JSON.stringify(omschrijving)}`);
sh("git push -q origin main");
sh(`git push -q origin v${versie}`);
console.log(`Gepubliceerd: v${versie} (${sh("git rev-parse --short HEAD")}). GitHub zet de site live zodra de test daar groen is.`);
