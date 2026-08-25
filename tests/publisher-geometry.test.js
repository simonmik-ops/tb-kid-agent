const assert = require("assert");
const fs = require("fs");

const code = fs.readFileSync(require.resolve("../plugin/code.js"), "utf8");
const start = code.indexOf("function clamp");
const end = code.indexOf("function buildNativeCenterLayout", start);
assert.ok(start >= 0 && end > start, "publisher geometry helpers must exist");
const helpers = new Function(code.slice(start, end) + "; return { getInterscrollerComposition, expandPairedBrandingFormats };")();

const paired = helpers.expandPairedBrandingFormats([{ format: {
  id: "pravda_200x700", baseId: "pravda_200x700", role: "branding_side",
  width: 200, height: 700, count: 2
}, layout: null }]);
assert.strictEqual(paired.length, 2);
assert.deepStrictEqual(paired.map(x => x.format.variantSide), ["left", "right"]);
assert.notStrictEqual(paired[0].format.variantSide, paired[1].format.variantSide);

const wide = helpers.getInterscrollerComposition({ width: 2000, height: 1400, safeZones: { top: 0, bottom: 0 } });
assert(wide.panelW <= 880, "wide panel must not cover the full 2000 px creative");
assert(wide.btnW <= 280, "wide CTA must remain a normal button width");
assert(wide.panelX >= 0 && wide.panelY >= 0);
assert(wide.panelX + wide.panelW <= 2000 && wide.panelY + wide.panelH <= 1400);

const strip = helpers.getInterscrollerComposition({ width: 1200, height: 400, safeZones: { top: 0, bottom: 0 } });
assert(strip.panelW < 600, "landscape interscroller panel must preserve the key visual");
assert(strip.btnW <= 280);

const portrait = helpers.getInterscrollerComposition({ width: 300, height: 600, safeZones: { sides: 50, top: 0, bottom: 0 } });
assert(portrait.panelW > 0 && portrait.panelW <= 200);
assert(portrait.panelX >= 50 && portrait.panelX + portrait.panelW <= 250);

// P0-25 nadväzok: Vinted 970×250/300×600 aliasujú na Adform PSD šablónu
// (ADFORM_PSD_ALIASES) — musí fungovať aj na Excel ceste, kde
// materializeExcelFormat prepisuje format.id na syntetický tvar a pôvodné
// katalógové id prežíva len v sourceFormatId.
const adformStart = code.indexOf("const LOCAL_ADFORM_PSD_IDS");
const adformEnd = code.indexOf("// Rozhoduje, ktoré prvky", adformStart);
assert.ok(adformStart >= 0 && adformEnd > adformStart, "adformTemplateId + ADFORM_PSD_ALIASES must exist");
const adformHelpers = new Function(code.slice(adformStart, adformEnd) + "; return { adformTemplateId };")();

assert.strictEqual(adformHelpers.adformTemplateId({ id: "vinted_970x250", width: 970, height: 250 }), "adform_970x250");
assert.strictEqual(adformHelpers.adformTemplateId({ id: "vinted_300x600", width: 300, height: 600 }), "adform_300x600");
assert.strictEqual(
  adformHelpers.adformTemplateId({ id: "xls_3_vinted_vinted_300x600", sourceFormatId: "vinted_300x600", width: 300, height: 600 }),
  "adform_300x600",
  "Excel-path synthetic id must still resolve the Vinted alias via sourceFormatId"
);
assert.strictEqual(adformHelpers.adformTemplateId({ id: "joj_interscroller_mobile", width: 300, height: 600 }), null,
  "unrelated 300x600 formats must not pick up the Vinted alias");

console.log("publisher geometry: ok");
