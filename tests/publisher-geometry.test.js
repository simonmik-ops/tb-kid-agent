const assert = require("assert");
const fs = require("fs");

const code = fs.readFileSync(require.resolve("../plugin/code.js"), "utf8");
const start = code.indexOf("function clamp");
const end = code.indexOf("function buildNativeCenterLayout", start);
assert.ok(start >= 0 && end > start, "publisher geometry helpers must exist");
const helpers = new Function(code.slice(start, end) + "; return { getInterscrollerComposition, expandPairedBrandingFormats, resolveSideSafeContentBox };")();

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

// P0-29-S2 (25.8. večer): addAiNote bez contentBox ukotví AI tag na spodok
// CELÉHO frame-u, nie panelu — pre vysoké formáty (napr. 750×1624) skončí
// ďaleko mimo skutočného "Readable message panel"/"Readable panel". Zamyká
// panel geometriu na presné čísla z reálneho referenčného behu (Figma):
// zenske_interscroller panel končí na 1267 (nameraný beh), topky_branding
// panel na 700.
const zenskeInt = helpers.getInterscrollerComposition({ width: 750, height: 1624, safeZones: { top: 321, bottom: 321, sides: 50 } });
assert.strictEqual(zenskeInt.panelY + zenskeInt.panelH, 1267,
  "zenske_interscroller (750×1624) panel bottom must match the measured reference run");

const topkyBox = helpers.resolveSideSafeContentBox({ width: 450, height: 800, safeZones: { safeInner: { width: 160, height: 600 } } });
assert.strictEqual(topkyBox.panelY + topkyBox.panelH, 700,
  "topky_branding (450×800) panel bottom must match the measured reference run");

// P0-29-S4: panel (background) must span the FULL frame width — it left
// visible vertical seams whenever format.width > safeInner.width (measured
// on 160×600: panel width 120 in a 160-wide frame; 450×800: panel width
// 160 in a 450-wide frame). Content positioning (contentW) intentionally
// stays at the safeInner width — that's a TP delivery-spec minimum, not a
// style choice (P0-29-S5, deliberately untouched).
assert.strictEqual(topkyBox.panelX, 0);
assert.strictEqual(topkyBox.panelW, 450, "panel must reach both frame edges regardless of safeInner width");
assert.strictEqual(topkyBox.contentW, 160, "content (logo/headline/CTA) positioning must stay within the TP safe zone");

// P0-29-S1: addText() must actually name the node when asked — addAiNote's
// own collision-avoidance searches frame.findOne(name === "Headline") and
// silently found nothing before this fix (Figma default-names text nodes
// by their content, not by role).
const addTextStart = code.indexOf("function addText(frame");
const addTextEnd = code.indexOf("\n}", addTextStart) + 2;
const addTextSrc = code.slice(addTextStart, addTextEnd);
assert.ok(/txt\.name\s*=\s*name/.test(addTextSrc), "addText must assign the given name to the created node");

console.log("publisher geometry: ok");
