#!/usr/bin/env node
// qa:presentation — jediný gate, ktorý sa smie volať "presentation-ready".
//
// Predtým "52/52 passing" znamenalo len jednotkové testy (scripts/run-
// tests.js) — vizuálna regresia (scripts/visual-regression.js) sa NIKDY
// nespúšťala ako súčasť žiadneho npm skriptu, takže reálny vzhľad
// vygenerovaných frameov sa nikdy neoveroval automaticky. Tento skript
// spája oba kroky a hlási FAIL vždy, keď jeden z nich padne — vizuálny
// krok nie je voliteľný doplnok, je to POVINNÁ brána.
//
// Spustenie: npm run qa:presentation
//            (alebo: node scripts/qa-presentation.js [actualDir])
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.join(__dirname, "..");
const actualDirArg = process.argv[2]; // voliteľné, inak default v visual-regression.js

function run(label, cmd, args) {
  process.stdout.write("\n=== " + label + " ===\n");
  const result = spawnSync(cmd, args, { cwd: root, stdio: "inherit" });
  const ok = result.status === 0;
  process.stdout.write("=== " + label + ": " + (ok ? "OK" : "FAIL (exit " + result.status + ")") + " ===\n");
  return ok;
}

const unitOk = run("1/2 Jednotkové testy (scripts/run-tests.js)", process.execPath, [path.join(root, "scripts", "run-tests.js")]);

const visualArgs = [path.join(root, "scripts", "visual-regression.js")];
if (actualDirArg) visualArgs.push(actualDirArg);
const visualOk = run("2/2 Vizuálna regresia (scripts/visual-regression.js) — POVINNÁ, nie voliteľná", process.execPath, visualArgs);

process.stdout.write("\n" + "─".repeat(60) + "\n");
process.stdout.write("qa:presentation súhrn:\n");
process.stdout.write("  Jednotkové testy:   " + (unitOk ? "OK" : "FAIL") + "\n");
process.stdout.write("  Vizuálna regresia:  " + (visualOk ? "OK" : "FAIL") + "\n");

const overallOk = unitOk && visualOk;
process.stdout.write(
  "\nCelkový výsledok: " + (overallOk ? "PASS" : "FAIL") +
  (overallOk ? "" : " — presentation-ready NIE JE, kým oba kroky neprejdú.") + "\n"
);

process.exit(overallOk ? 0 : 1);
