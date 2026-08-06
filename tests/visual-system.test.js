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
  [51, 67, 65],
  "wide, square and portrait headline sizes must keep the approved optical scale"
);
assert.deepStrictEqual(
  [TB.subheadline(1200, 628), TB.subheadline(1200, 1200), TB.subheadline(1080, 1920)],
  [27, 35, 34],
  "subheadline must remain approximately 52% of headline"
);
assert.strictEqual(TB.logoBox(1080, 1920).height, 151, "story logo must not grow to the old 216 px size");
assert.strictEqual(TB.button(1200, 1200).height, 64, "CTA height must stay subordinate to the headline");

assert(source.includes('t.opacity = 0.80'), "AI disclosure must match the PSD 80% opacity");
assert(!source.includes('backing.name = "AI generované — podložka"'), "AI disclosure must not use the old black pill");
assert(source.includes('style === "Regular" ? 110 : 100'), "typographic line-height tokens must be explicit");
assert(source.includes('style === "Regular" ? -1.5 : -2.5'), "tracking must follow the PSD-derived scale");
assert(source.includes('return clamp(0.46 + (1 - luma) * 0.18, 0.46, 0.64)'), "scrim must stay in the gentle 46–64% range");
assert(source.includes('function measureTemplateTextHeight'), "layout must measure real wrapped text height");
assert(!source.includes('const headlineBoxH = Math.round(format.height * 0.13)'), "headline spacing must not use a canvas-height placeholder");
assert(!source.includes('const subheadlineBoxH = Math.round(format.height * 0.09)'), "subheadline spacing must not use a canvas-height placeholder");

console.log("visual system: ok");
