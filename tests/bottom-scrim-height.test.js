// Zadanie 26.8, blok F2: "Bottom readability gradient" (buildMasterSafeLayout,
// square-family formáty bez vlastného dedikovaného panelu, napr. 1200×1200
// Meta/Meta REMARKETING/PMax/Google RSA/Demand Gen) škáloval scrimH ako
// percento formátu (0,62 na square) — na 1200×1200 to dávalo 744 px (62 % z
// 1200), za jediný riadok textu dole. Surďova referencia
// (d51uxTh8YqPdHujzi1Plt6, 8 zvislých frame-ov) má prechod prakticky
// konštantný — 496 px na väčšine, 515 px na 900×1600 — nie percento výšky.
//
// Tento test beží skutočný buildMasterSafeLayout zo zdroja cez vm a overuje
// scrimH pre 1200×1200. Namerané mimo tohto testu (node -e, rovnaký mock):
//   PRED (format.height * 0.62):  744 px
//   PO   (REFERENCE_SCRIM_H):     500 px
//
// 1200×1628 a 1080×1920 (portrait family) NEBOLI súčasťou tohto merania —
// pri reálnom KID behu (jeden master KV zdieľaný naprieč formátmi,
// layout.asset_fallback_kind === "portrait") idú cez úplne inú vetvu
// ("Adaptive portrait content panel", sampledPortraitOverlayGradient),
// ktorá REFERENCE_SCRIM_H vôbec nepoužíva — túto opravu teda pri bežnom
// KID behu pravdepodobne vôbec nevidia. Overené nižšie: s
// asset_fallback_kind nastaveným na "portrait" (bežný KID prípad) sa
// "Bottom readability gradient" pre tieto dva formáty vôbec nekreslí.
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

function run(width, height, assetFallbackKind) {
  const frame = makeNode();
  frame.width = width; frame.height = height;
  const format = { width: width, height: height, safeBox: null, deadZones: [] };
  const layout = {
    show_headline: true, show_logo: false, show_cta: true,
    show_subheadline: true, show_ai_disclosure: false, asset_fallback_kind: assetFallbackKind
  };
  const content = { headline: "Investujte uz od 50 EUR", subheadline: "Zacnite dnes", ctaText: "Zistit viac", showGuides: false };
  context.__frame = frame; context.__format = format; context.__layout = layout; context.__content = content;
  vm.runInContext("buildMasterSafeLayout(__frame, __format, __layout, __content, null, null, null, null);", context);
  return frame;
}

const square = run(1200, 1200, null);
const scrim = square.findOne((n) => n.name === "Bottom readability gradient");
assert(scrim, "1200×1200 without a dedicated panel must draw the bottom scrim");
assert.strictEqual(scrim.height, 500, "scrimH must use the constant reference height, not 62% of format.height (744)");

const portraitAdapted = run(1200, 1628, "portrait");
assert(
  !portraitAdapted.findOne((n) => n.name === "Bottom readability gradient"),
  "1200×1628 with a reused single master (asset_fallback_kind=portrait) must use its own dedicated panel, not the square-family scrim"
);

console.log("bottom scrim height: ok");
