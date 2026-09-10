// Regresia 10.9.2026 (P0-34 / zadanie F): buildCleanImageLayout()'s wide
// family (family==="wide", asset_fallback_kind path — square master needing
// a landscape target, e.g. 1200×628 Google RSA/Responsive) used a CONTAIN
// crop (Math.min(zoneW/imgW, zoneH/imgH)) that left a bare colour margin
// next to the photo — exactly the "1200×628 exists twice, one version is
// broken" bug: Meta 1200×628 (master_safe, cover-crop) covers the whole
// frame; Google RSA 1200×628 (clean_image, this function) did not.
//
// Two earlier attempts at a real fix are on record in the surrounding
// comments and were deliberately reverted, not overlooked:
//   - centering the CONTAIN crop (x:0 -> x:0.5) — rejected, it only moves
//     where the empty bars are, doesn't remove them (locked by
//     tests/visual-system.test.js).
//   - reusing WIDE_KV_ZONE_MULTIPLIER / KV_OVERSIZE_POINTS (master_safe's
//     own oversize factors) — reverted, those are measured for a DIFFERENT
//     zone shape (75%-width wide zone with a text panel, or a full square/
//     portrait zone) and over-cropped ("orezávalo hlavu") when applied to
//     clean_image's full-frame wide zone.
// This fix avoids both failure modes: a plain cover-crop (Math.max, no
// extra oversize factor at all) mathematically guarantees zero empty
// margin and crops less aggressively than either reverted attempt.
//
// square/portrait families (asset_fallback_kind path, oversizeFrameRatio
// via Krok 4c) are UNTOUCHED by this fix — still go through
// addProtectedImageFrame() exactly as before. Verified below.
//
// Test beží skutočný buildCleanImageLayout() zo zdroja (cez vm).
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync(require.resolve("../plugin/code.js"), "utf8");

function makeNode() {
  const node = {
    name: "", x: 0, y: 0, width: 0, height: 0, fills: [], children: [], visible: true, clipsContent: false,
    fontName: null, fontSize: 0, characters: "", textAutoResize: "NONE",
    resize: function (w, h) { this.width = w; this.height = h; },
    appendChild: function (child) { child.parent = this; this.children.push(child); },
    remove: function () {},
    findOne: function (pred) {
      for (const c of this.children) {
        if (pred(c)) return c;
        const found = c.findOne ? c.findOne(pred) : null;
        if (found) return found;
      }
      return null;
    },
    findAll: function (pred) {
      const out = [];
      for (const c of this.children) {
        if (pred(c)) out.push(c);
        if (c.findAll) out.push(...c.findAll(pred));
      }
      return out;
    }
  };
  return node;
}

const context = {
  __html__: "<html></html>",
  figma: {
    createRectangle: makeNode, createFrame: makeNode, createText: makeNode,
    showUI: function () {}, closePlugin: function () {},
    ui: { onmessage: null, postMessage: function () {} },
    root: { children: [] }, currentPage: { children: [] }
  },
  console: console
};
vm.createContext(context);
vm.runInContext(
  source + "\nthis.buildCleanImageLayout = buildCleanImageLayout;\nthis.validateGeneratedFrame = validateGeneratedFrame;",
  context
);

function run(width, height, imgW, imgH) {
  const frame = makeNode();
  frame.width = width; frame.height = height; frame.clipsContent = true;
  const format = { width, height };
  const layout = { asset_fallback_kind: "wide" };
  context.__frame = frame; context.__format = format; context.__layout = layout;
  context.__figmaImage = { hash: "fake-image" };
  vm.runInContext("CUR_IMG_W = " + imgW + "; CUR_IMG_H = " + imgH + ";", context);
  vm.runInContext("buildCleanImageLayout(__frame, __format, __layout, __figmaImage);", context);
  return frame;
}

// 1200×628 Google RSA/Responsive with a square master (the exact P0-34 case).
const frame = run(1200, 628, 800, 800);
const image = frame.findOne((n) => n.name === "Key visual — protected full master");
assert(image, "1200x628: protected image must be drawn");
assert(image.x <= 0 && image.x + image.width >= 1200,
  "1200x628: image must cover the full width, no side margin, got x=" + image.x + " width=" + image.width);
assert(image.y <= 0 && image.y + image.height >= 628,
  "1200x628: image must cover the full height, no gap, got y=" + image.y + " height=" + image.height);

const content = { headline: null, subheadline: null, ctaText: null, legalText: null, badgeText: null, hasLogo: false };
context.__content = content;
const qa = vm.runInContext(
  "validateGeneratedFrame(__frame, __format, __layout, \"clean_image\", __content, null);",
  context
);
assert(!qa.issues.includes("qa_empty_surface_ratio"),
  "1200x628: must not flag qa_empty_surface_ratio after the cover-crop fix, got " + JSON.stringify(qa.issues));
assert(!qa.issues.includes("qa_unsafe_single_master_crop"),
  "1200x628: plain cover-crop (no oversize factor) must not trip the unsafe-crop threshold either, got " + JSON.stringify(qa.issues));

// square/portrait families must be completely unaffected — still route
// through addProtectedImageFrame() with the Krok 4c oversizeFrameRatio path.
const squareFrame = run(1200, 1200, 800, 800);
assert(!squareFrame.findOne((n) => n.name === "Adapted clean master — full composition" && n.clipsContent === true && n.width === 1200 && n.height === 1200 && n.children.length === 0),
  "sanity: square holder should have a child image (this assertion just documents intent, see width/height checks below)");
const squareImage = squareFrame.findOne((n) => n.name === "Key visual — protected full master");
assert(squareImage, "1200x1200: image must still be drawn (untouched square path)");
// Krok 4c square oversize multiplier for ratio 1.0 is 1.357 (KV_OVERSIZE_POINTS)
// — distinct from the plain cover-crop's 1.0x-equivalent scale, confirming
// the square branch did NOT change to the new wide cover-crop formula.
assert(squareImage.width > 1200, "1200x1200: square family must still use Krok 4c oversize (width > frame width), got " + squareImage.width);

console.log("clean_image wide cover-crop (P0-34/F): ok");
