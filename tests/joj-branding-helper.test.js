// Zadanie 26.8, blok R4 / P2-27: JOJ branding (2000×1400) drew its "website
// content area" placeholder under a JOJ-specific name ("JOJ white website
// content area", missing the word "guide") and at full opacity (1) instead
// of the same 8% translucent guide markíza gets ("Website content area
// guide"). Two compounding bugs: (1) HELPER_PATTERNS matches
// /content area guide/i, so the JOJ variant never matched and was never
// stripped as a helper layer even on export; (2) it was fully opaque white
// over the model's face even inside Figma. Confirmed on live output: joj.sk
// 2000×1400, opaque white rectangle across the centre of the frame.
const assert = require("assert");
const fs = require("fs");

const source = fs.readFileSync(require.resolve("../plugin/code.js"), "utf8");

assert(!/addSolidRect\(\s*frame,\s*"JOJ white website content area"/.test(source),
  "the JOJ-specific unmatched layer name must no longer be drawn");
assert(!/isJoj/.test(source), "the JOJ special-case branch must be removed entirely");

const helperPatternsStart = source.indexOf("var HELPER_PATTERNS");
const helperPatternsEnd = source.indexOf(";", helperPatternsStart) + 1;
assert(helperPatternsStart >= 0, "HELPER_PATTERNS must exist");
const helperPatternsSrc = source.slice(helperPatternsStart, helperPatternsEnd);
const HELPER_PATTERNS = new Function(helperPatternsSrc + "; return HELPER_PATTERNS;")();

function isHelperLayer(name) {
  return HELPER_PATTERNS.some((re) => re.test(name));
}

assert(isHelperLayer("Website content area guide"),
  "the shared guide name must still match HELPER_PATTERNS (regression against the JOJ-specific miss)");

console.log("joj branding helper layer: ok");
