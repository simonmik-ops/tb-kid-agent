// Regresia 9.9.2026: TB.headline() dávalo systematicky len ~83 % referenčnej
// veľkosti vo všetkých troch rodinách formátov —
//   1200×1200 (square):  min(W,H)×0,056 → 67, referencia 80
//   1080×1920 (portrait): W×0,060       → 65, referencia 81
//   1200×628  (wide):     H×0,082       → 51, referencia 60
// Koeficienty prepočítané na 0,0667 / 0,075 / 0,0955. Strop 68 (square aj
// portrait vetva) zdvihnutý na 96, inak by nové hodnoty 80/81 doň narazili.
//
// letterSpacing (tracking): FONT_REGULAR text (addAiNote, addTemplateText
// so style="Regular") mal -1,5 %, referencia je 0 %. Bold text
// (addTemplateText so style!=="Regular") mal -2,5 %, referencia je -2 %.
// r.4416 (addSloganLogo, "Myslite na seba") mala už správnych -2 % — tá sa
// nemenila.
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync(require.resolve("../plugin/code.js"), "utf8");
const context = {
  clamp: (n, min, max) => Math.max(min, Math.min(max, n))
};
vm.createContext(context);
const tbSource = source.slice(0, source.indexOf("try {\n  figma.showUI"));
vm.runInContext(tbSource + "\nthis.__TB = TB;", context);
const TB = context.__TB;

assert.strictEqual(TB.headline(1200, 1200), 80,
  "TB.headline(1200,1200) (square) must match the reference optical scale");
assert.strictEqual(TB.headline(1080, 1920), 81,
  "TB.headline(1080,1920) (portrait) must match the reference optical scale");
assert.strictEqual(TB.headline(1200, 628), 60,
  "TB.headline(1200,628) (wide) must match the reference optical scale");

// addAiNote() — FONT_REGULAR — tracking musí byť 0 %, nie -1,5 %.
const aiNoteStart = source.indexOf("function addAiNote");
const aiNoteEnd = source.indexOf("\nfunction ", aiNoteStart + 1);
const aiNoteSrc = source.slice(aiNoteStart, aiNoteEnd);
assert(/t\.letterSpacing\s*=\s*\{\s*value:\s*0,\s*unit:\s*"PERCENT"\s*\}/.test(aiNoteSrc),
  "addAiNote() tracking must be 0% (FONT_REGULAR), not -1.5%");

// addTemplateText() — Regular 0 % / Bold -2 % (predtým -1,5 % / -2,5 %).
assert(source.includes('style === "Regular" ? 0 : -2, unit: "PERCENT"'),
  "addTemplateText() tracking must be Regular 0% / Bold -2%, not -1.5%/-2.5%");

// addSloganLogo ("Myslite na seba") už malo správnych -2 % — nesmelo sa zmeniť.
assert(source.includes('t.letterSpacing = { value: -2, unit: "PERCENT" };'),
  "addSloganLogo tracking must remain untouched at -2%");

console.log("headline optical scale + tracking (9.9.2026): ok");
