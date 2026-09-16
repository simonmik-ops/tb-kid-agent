#!/usr/bin/env node
/**
 * Spúšťač testov (14. 9.).
 *
 * Prečo vznikol: `npm test` bol jeden reťazec `node a.test.js && node b.test.js
 * && ...`. Malo to dva dôsledky, ktoré sa navzájom kryli:
 *   1. `&&` zastaví beh na PRVOM páde, takže z 28 zapojených súborov reálne
 *      prebehlo 6 — siedmy (visual-system) padal a zvyšných 21 sa nikdy
 *      nespustilo. Padajúci test tak schoval stav 21 ďalších.
 *   2. Zoznam bol ručný, takže 20 zo 48 súborov v tests/ v ňom vôbec nebolo.
 *      Nový test sa musel pamätať dopísať do package.json, inak ticho nebežal.
 *
 * Tento runner rieši oboje: zoznam si vezme z adresára (žiadny ručný zoznam,
 * ktorý by sa dal zabudnúť aktualizovať), každý súbor spustí v samostatnom
 * procese bez ohľadu na to, ako dopadli predošlé, a na konci vypíše súhrn.
 * Exit kód je nenulový, ak padol čo i len jeden súbor — CI a `npm test` sa
 * teda stále správajú ako predtým, len už vidia celý obraz.
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const testsDir = path.join(__dirname, "..", "tests");
const only = process.argv.slice(2).filter(function (a) { return !a.startsWith("-"); });

const files = fs.readdirSync(testsDir)
  .filter(function (f) { return f.endsWith(".test.js"); })
  .filter(function (f) { return only.length === 0 || only.some(function (o) { return f.indexOf(o) !== -1; }); })
  .sort();

if (files.length === 0) {
  console.error("Nenašiel som žiadny test v " + testsDir);
  process.exit(1);
}

const failed = [];
const started = Date.now();

for (let i = 0; i < files.length; i++) {
  const file = files[i];
  const res = spawnSync(process.execPath, [path.join(testsDir, file)], {
    encoding: "utf8",
    // Testy si píšu vlastný výstup; pri úspechu ho nezobrazujeme, aby bol
    // súhrn čitateľný, pri páde vypíšeme všetko.
    stdio: ["ignore", "pipe", "pipe"]
  });
  const ok = res.status === 0;
  const poradie = String(i + 1).padStart(String(files.length).length, " ");
  console.log((ok ? "  ok   " : "  FAIL ") + poradie + "/" + files.length + "  " + file);
  if (!ok) {
    failed.push(file);
    const out = (res.stdout || "") + (res.stderr || "");
    console.log(out.split("\n").map(function (l) { return "         " + l; }).join("\n"));
  }
}

const sekundy = ((Date.now() - started) / 1000).toFixed(1);
console.log("");
console.log("─".repeat(60));
console.log(
  "Testovacích súborov: " + files.length +
  " · prešlo: " + (files.length - failed.length) +
  " · padlo: " + failed.length +
  " · " + sekundy + " s"
);
if (failed.length) {
  console.log("");
  console.log("Padli:");
  failed.forEach(function (f) { console.log("  - " + f); });
}
console.log("─".repeat(60));

process.exit(failed.length ? 1 : 0);
