// Zadanie 31.8, blok B / P0-33: buildMasterSafeLayout()'s P0-29-S8
// content-based panel shrink (25.8.) could move the "Adaptive portrait
// content panel"'s top edge (contentTop) BELOW the photo's actual bottom
// edge (portraitImageH) when the headline was short. The gap between them
// (bare frame.fills, no gradient, no photo) showed up as a hard horizontal
// seam — measured on 1080×1920: photo 0..1080, panel from y=1137, a 57px
// uncovered band.
//
// Fix: contentTop is now clamped to never exceed portraitImageH — the
// panel may still shrink, but never past the photo's own bottom edge.
//
// This test runs the real buildMasterSafeLayout from source via vm (same
// harness as tests/bottom-scrim-height.test.js) with a short, one-word
// headline — the exact case that triggers the S8 shrink — on the four
// formats named in the assignment's acceptance condition, and checks
// panel.y <= photo bottom edge on all of them.
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync(require.resolve("../plugin/code.js"), "utf8");

function makeNode() {
  const node = {
    name: "", x: 0, y: 0, width: 0, height: 0, fills: [], children: [],
    fontName: null, fontSize: 0, characters: "", textAutoResize: "NONE",
    textAlignHorizontal: "LEFT", textAlignVertical: "TOP",
    lineHeight: null, letterSpacing: null, cornerRadius: 0,
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
    }
  };
  return node;
}

const context = {
  __html__: "<html></html>",
  figma: {
    createRectangle: makeNode, createText: makeNode, createFrame: makeNode,
    showUI: function () {}, closePlugin: function () {},
    ui: { onmessage: null, postMessage: function () {} },
    root: { children: [] }, currentPage: { children: [] }
  },
  console: console
};
vm.createContext(context);
vm.runInContext(source + "\nthis.buildMasterSafeLayout = buildMasterSafeLayout;", context);

function run(width, height) {
  const frame = makeNode();
  frame.width = width; frame.height = height;
  const format = { width: width, height: height, safeBox: null, deadZones: [] };
  const layout = {
    show_headline: true, show_logo: false, show_cta: false,
    show_subheadline: false, show_ai_disclosure: false
  };
  // Jedno slovo — presne ten prípad, ktorý P0-29-S8 skrátenie spúšťa.
  const content = { headline: "Investujte", subheadline: null, ctaText: null, showGuides: false };
  context.__frame = frame; context.__format = format; context.__layout = layout; context.__content = content;
  vm.runInContext("buildMasterSafeLayout(__frame, __format, __layout, __content, null, null, null, null);", context);
  const panel = frame.findOne((n) => n.name === "Adaptive portrait content panel");
  const photo = frame.findOne((n) => n.name === "Protected single master — portrait image zone");
  return { panel: panel, photoBottom: photo ? photo.y + photo.height : null };
}

for (const [w, h] of [[1080, 1920], [960, 1200], [1200, 1628], [1000, 1500]]) {
  const { panel, photoBottom } = run(w, h);
  assert(panel, w + "×" + h + ": panel must be drawn");
  assert(photoBottom !== null, w + "×" + h + ": photo zone must be drawn");
  assert(
    panel.y <= photoBottom,
    w + "×" + h + ": panel.y (" + panel.y + ") must not start below the photo's bottom edge (" + photoBottom + ") — gap of " + (panel.y - photoBottom) + "px"
  );
}

console.log("portrait panel never gaps below the photo edge: ok");
