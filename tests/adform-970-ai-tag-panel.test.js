// Zadanie 31.8, revízia T-5 / P2-33: ADFORM_PSD_RULES.adform_970x250.ai
// was at x=30 — inside the photo zone (0..549, panel starts at 450) —
// the only one of the four Adform formats where the AI disclosure tag had
// no panel behind it at all (white text directly on the coral photo).
// Moved into the panel, aligned with the headline/CTA left edge, just
// below the CTA (same pattern the other three Adform templates already use).
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync(require.resolve("../plugin/code.js"), "utf8");
const context = {};
vm.createContext(context);
vm.runInContext(
  source.slice(source.indexOf("const ADFORM_970X250_PHOTO_EDGE_X"), source.indexOf("function resolveAdformPsdRules")) +
  "\nthis.__RULES = ADFORM_PSD_RULES;",
  context
);
const rules = context.__RULES.adform_970x250;
const ai = { x: rules.ai[0], y: rules.ai[1], w: rules.ai[2], h: rules.ai[3] };
const panelX = 450; // ADFORM_PSD_RULES.adform_970x250.panel[0]

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

assert(ai.x >= panelX, "AI tag must sit inside the panel (x >= " + panelX + "), got x=" + ai.x);
assert(ai.y + ai.h <= 250, "AI tag must stay within the 250px-tall frame, got bottom=" + (ai.y + ai.h));

const cta = { x: rules.cta[0], y: rules.cta[1], w: rules.cta[2], h: rules.cta[3] };
const legal = { x: rules.legal[0], y: rules.legal[1], w: rules.legal[2], h: rules.legal[3] };
assert(!overlaps(ai, cta), "AI tag must not overlap the CTA button");
assert(!overlaps(ai, legal), "AI tag must not overlap the legal text");

console.log("adform 970x250 AI tag in panel: ok");
