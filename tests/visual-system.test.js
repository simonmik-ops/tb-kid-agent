const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync(require.resolve("../plugin/code.js"), "utf8");
const tbSource = source.slice(0, source.indexOf("try {\n  figma.showUI"));
const context = {
  clamp: (n, min, max) => Math.max(min, Math.min(max, n))
};
vm.createContext(context);
vm.runInContext(tbSource + "\nthis.__TB = TB;", context);
const TB = context.__TB;

assert.deepStrictEqual(
  [TB.headline(1200, 628), TB.headline(1200, 1200), TB.headline(1080, 1920)],
  [48, 60, 59],
  "wide, square and portrait headline sizes must keep the approved optical scale"
);
assert.deepStrictEqual(
  [TB.subheadline(1200, 628), TB.subheadline(1200, 1200), TB.subheadline(1080, 1920)],
  [23, 29, 28],
  "subheadline must remain approximately 48% of headline"
);
assert.strictEqual(TB.logoBox(1080, 1920).height, 135, "story logo must not grow to the old 216 px size");
assert.strictEqual(TB.button(1200, 1200).height, 56, "CTA height must stay subordinate to the headline");
assert(source.includes('const imageW = Math.round(format.width * 0.56)'), "wide master must reserve a dedicated content panel");
assert(source.includes('panel.fills = [{ type: "SOLID", color: brand }]'), "wide panel must be solid without a shadow edge");
assert(source.includes('rect.y = Math.min(rect.y, -edgeTrim)'), "master crop must hide technical top-edge pixels");
assert(source.includes('cursorY = Math.min(cursorY, logoTop'), "Meta text must be anchored above the logo row");
assert(source.includes('function pickExactKV(format)'), "production formats must require an exact-orientation KV");
assert(!source.includes('return imgPortrait || imgSquare || imgLandscape'), "portrait formats must not fall back to square/landscape assets");
assert(source.includes('buildMissingAssetLayout(frame, format, missingAssetKind)'), "missing inputs must create an explicit non-production state");
assert(source.includes('isVideoPlaceholder ? "PLACEHOLDER"'), "video frames must never be labelled production");
assert(source.includes('Math.min(format.height, format.width) * 0.32'), "square logo-only assets must use an optical, visible scale");
assert(source.includes('function pickAdaptiveKV(format)'), "single-master mode must adapt the available KV when an exact orientation is absent");
assert(!source.includes('Adaptive portrait content panel'), "portrait master must not invent a color panel that is absent from the Surď reference");
assert(source.includes('Adapted clean master — full composition'), "clean portrait fallback must preserve the complete square composition");
assert(source.includes('const runYOffset = page.children.length'), "new generations must be placed below existing frames instead of overlapping them");
assert(source.includes('frame.y = runYOffset'), "every frame in a generation must use the safe run row");

assert(source.includes('t.opacity = 0.80'), "AI disclosure must match the PSD 80% opacity");
assert(!source.includes('backing.name = "AI generované — podložka"'), "AI disclosure must not use the old black pill");
assert(source.includes('style === "Regular" ? 110 : 100'), "typographic line-height tokens must be explicit");
assert(source.includes('style === "Regular" ? -1.5 : -2.5'), "tracking must follow the PSD-derived scale");
assert(source.includes('return clamp(0.46 + (1 - luma) * 0.18, 0.46, 0.64)'), "scrim must stay in the gentle 46–64% range");
assert(source.includes('function measureTemplateTextHeight'), "layout must measure real wrapped text height");
assert(!source.includes('const headlineBoxH = Math.round(format.height * 0.13)'), "headline spacing must not use a canvas-height placeholder");
assert(!source.includes('const subheadlineBoxH = Math.round(format.height * 0.09)'), "subheadline spacing must not use a canvas-height placeholder");
assert(!source.includes('const compactCopy = String(content.headline || "").trim().length <= 22'), "Adform geometry must not drift with headline length");
assert(source.includes('[0, 0, 160, 330]'), "160x600 must keep the PSD image/panel boundary");
assert(source.includes('[0, 0, 425, 250]'), "970x250 must keep the PSD image zone before the color panel");

console.log("visual system: ok");
