const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync(require.resolve("../plugin/code.js"), "utf8");
const uiSource = fs.readFileSync(require.resolve("../plugin/ui.html"), "utf8");
const tbSource = source.slice(0, source.indexOf("try {\n  figma.showUI"));
const context = {
  clamp: (n, min, max) => Math.max(min, Math.min(max, n))
};
vm.createContext(context);
vm.runInContext(tbSource + "\nthis.__TB = TB;", context);
const TB = context.__TB;

// 9.9. dodatok: koeficienty (0,056/0,060/0,082) dávali systematicky len
// ~83 % referenčnej veľkosti — prepočítané na 0,0667/0,075/0,0955 (strop
// square/portrait vetvy zdvihnutý 68->96, nech 80/81 doň nenarazia).
assert.deepStrictEqual(
  [TB.headline(1200, 628), TB.headline(1200, 1200), TB.headline(1080, 1920)],
  [60, 80, 81],
  "wide, square and portrait headline sizes must keep the approved optical scale"
);
// 9.9. dodatok: táto assertion bola dočasne ODSTRÁNENÁ v commite 9cab0e4,
// keď nová wide-vetva (H*0,0955) zmenila výsledok z 89 na 96 — nevyriešený
// konflikt s 1200×628 (potrebuje H*0,0955=60), obe formáty idú cez rovnakú
// vetvu (r > 1,45). Obnovené na pôvodných 89 na výslovnú žiadosť — test sa
// neohýba, aby sedel na kód. Aktuálne PADÁ (TB.headline(1920,1080) je teraz
// 96), kým sa nevyberie a neimplementuje riešenie z návrhu (viď odpoveď).
assert.strictEqual(TB.headline(1920, 1080), 89,
  "Full-HD wide headline must keep the same 8.2% optical scale instead of the old 52 px cap");
assert.deepStrictEqual(
  [TB.subheadline(1200, 628), TB.subheadline(1200, 1200), TB.subheadline(1080, 1920)],
  [31, 42, 42],
  "subheadline must remain approximately 52% of headline"
);
assert.strictEqual(TB.logoBox(1080, 1920).height, 151, "story logo must not grow to the old 216 px size");
assert.strictEqual(TB.button(1200, 1200).height, 64, "CTA height must stay subordinate to the headline");

assert(source.includes('t.opacity = 0.80'), "AI disclosure must match the PSD 80% opacity");
assert(!source.includes('backing.name = "AI generované — podložka"'), "AI disclosure must not use the old black pill");
assert(source.includes('style === "Regular" ? 110 : 100'), "typographic line-height tokens must be explicit");
// 9.9. oprava: tracking sa vyberá podľa ROLY (name), nie podľa štýlu —
// Headline -2%/Subheadline 0% majú novú referenčnú hodnotu, Badge/Legal
// text/CTA text/slogan (všetky zdieľajú Bold alebo Regular štýl s inými
// rolami) si musia zachovať pôvodný -2,5%/-1,5% tracking.
assert(source.includes('name === "Headline" ? -2 : (name === "Subheadline" ? 0 : (style === "Regular" ? -1.5 : -2.5))'),
  "tracking must be selected by role (name), not by style, so Badge/Legal/CTA/slogan keep their original values");
// MERGE 7.9: master's WCAG-correct direction/range won over oprava-26-8's
// visually-narrower 46-64% band — see the "MERGE 7.9." comment above
// scrimAlphaFor in plugin/code.js for the unresolved tension (light-KV
// contrast compliance needs a >= 0.76, which a 0.64 cap can't reach; the
// 90% narrowing oprava-26-8 wanted for visual reasons is intentionally
// left unaddressed here, to be solved via a shorter scrim, not a lower cap).
assert(source.includes('return clamp(0.50 + luma * 0.40, 0.50, 0.90)'), "scrim must follow the WCAG-corrected direction/range (0.50-0.90), not the old inverted 0.46-0.64 band");
assert(source.includes('imageBoundaryStop'), "wide color extension must become opaque at the image boundary");
assert(source.includes('headlineBottom - headlineNode.height'), "single-line headline must be optically anchored to subheadline");
assert(source.includes('compactCopy ? 1.16 : 1.02'), "small Adform crops must remove technical KV borders and protect compact copy");
assert(source.includes('PSD left readability treatment'), "300x250 must recreate the PSD dark copy zone for flat master KVs");
assert(source.includes('brandEdgeColor(layout, "bottom"), 0.58'), "the 300x250 copy zone must follow the current KV colour");
assert(source.includes('function pickAdaptiveKV(format)'), "single-master inputs must use the adaptive orientation picker");
assert(source.includes('function addProtectedImageFrame'), "single-master fallbacks must preserve the complete KV");
assert(source.includes('Adaptive portrait content panel'), "portrait fallbacks must use a dedicated colour-extension panel");
assert(source.includes('function sampledPortraitOverlayGradient'), "portrait fallbacks must blend the text panel through the image boundary");
assert(source.includes('family === "wide" ? { x: 0, y: 0.5 }'), "clean wide assets must anchor the protected master to the left instead of centering two colour bars");
assert(source.includes('Clean portrait colour extension'), "clean portrait assets must continue from the master's bottom edge without a light horizontal band");
assert(source.includes('[0, 0, imageW, format.height], { x: 0, y: 0.5 }'), "wide creative masters must keep the focal visual on the left as in the Surd reference");
assert(source.includes('ratio >= 1.25 ? "wide" : (ratio <= 0.8 ? "portrait" : "square")'), "4:5 and other orientation boundaries must match the KV picker exactly");
assert(source.includes('const edge = campaignSurface(layout);\n    const panel = figma.createRectangle();\n    panel.name = "Brand panel";'), "970x250 must derive its panel from the shared campaign colour instead of hard-coded navy");
assert(source.includes('const panelX = (rules.panel && rules.panel[0]) || 549;'),
  "970x250 panel must take its x from ADFORM_PSD_RULES.adform_970x250.panel (measured on the PSD baseline, same source as the headline coordinates), not the hard-coded Figma-derived 549 — P0-22 (zadanie 26.8 blok B)");
assert(source.includes('panel: [450, 0, 520, 250]'), "adform_970x250 PSD rule must carry the panel geometry measured on tests/visual-baselines/adform_970x250.png");
assert(source.includes('const runYOffset = page.children.length'), "a new generation must not overlap an older run");
assert(uiSource.includes('async function normalizeKvFile(file)'), "uploaded KV edges must be normalized before rendering");
assert(uiSource.includes('transparent-or-selection-edge'), "Figma selection/padding cleanup must be recorded in metadata");
assert(uiSource.includes('kvBgVertical: kvEdges.vertical'), "five-stop KV edge colours must reach the renderer");
assert(source.includes('Array.isArray(layout.bg_vertical_stops)'), "wide colour extension must support a multi-stop visual-edge gradient");

console.log("visual system: ok");
