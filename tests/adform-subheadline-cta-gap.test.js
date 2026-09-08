// Zadanie 31.8, revízia T-3 / P0-36: buildAdformPsdLayout()'s subheadline
// box height was bounded by the HEADLINE's own nominal box end
// (rules.headline[1]+rules.headline[3]), which has nothing to do with
// where the CTA actually starts. On adform_160x600's portrait fallback
// override (headline y=250,h=54; cta y=320), that formula gave a box only
// ~12px tall — the subheadline's real (auto-resized) two-line text
// overflowed it and landed 2px into the CTA button, just under the 2px
// collisionPairs tolerance, so QA never caught it.
//
// Fix: the box's bottom edge is now bounded by rules.cta[1] (with a small
// gap) when a CTA rule exists. This test extracts the exact formula from
// source (not a hand-copied mirror) and checks it directly, since
// simulating addTemplateText's real word-wrap/auto-resize behaviour would
// need a much heavier mock than is worth building for one calculation.
const assert = require("assert");
const fs = require("fs");

const source = fs.readFileSync(require.resolve("../plugin/code.js"), "utf8");
const start = source.indexOf("const subY = headlineNode.y + headlineNode.height + 4;");
assert(start >= 0, "subheadline positioning block must exist");
const subBottomEnd = source.indexOf(";", source.indexOf("const subBottom", start)) + 1;
const snippet = source.slice(start, subBottomEnd);
assert(snippet.indexOf("const subBottom") >= 0, "subBottom calculation must be present in the extracted snippet");

function computeSubheadlineBox(headlineNode, h, rules) {
  const body = snippet + "\nreturn [h[0], subY, h[2], Math.max(12, subBottom - subY)];";
  return new Function("headlineNode", "h", "rules", body)(headlineNode, h, rules);
}

// adform_160x600 portrait fallback override: headline=[12,250,136,54], cta y=320.
const h = [12, 250, 136, 54];
const rules = { cta: [15, 320, 130, 42] };
// Krátky headline, jeden riadok — reálna vykreslená výška blízka nominálnej.
const shortHeadline = { y: 250, height: 30 };
const box = computeSubheadlineBox(shortHeadline, h, rules);
const subY = box[1], subH = box[3];
assert(
  subY + subH <= rules.cta[1],
  "subheadline box (bottom=" + (subY + subH) + ") must not reach the CTA (y=" + rules.cta[1] + ")"
);

// Bez rules.cta (iný template) sa musí použiť pôvodný fallback (koniec
// headline nominálneho boxu) — žiadna regresia pre šablóny bez CTA.
const noCtaBox = computeSubheadlineBox(shortHeadline, h, {});
assert.strictEqual(noCtaBox[3], Math.max(12, (h[1] + h[3]) - noCtaBox[1]),
  "without rules.cta, the old headline-nominal-end fallback must still apply");

console.log("adform subheadline/CTA gap: ok");
