// Zadanie 26.8, blok E: buildSideSafeLayout() a buildInterscrollerSafeLayout()
// v plugin/code.js sizovali headline box až po ctaTop/panelH-ctaBudget bez
// ohľadu na to, že addAiNote() (volané z orchestrácie, AŽ PO builderi) kreslí
// AI disclosure tag do tej istej spodnej zóny. Namerané na živom výstupe
// (topky.sk 450×800/400×600/120×600/160×600): headline box preráža AI tag o
// 10–13 px, presne toľko, koľko sa preň nikde nerezervovalo.
//
// Tento test neoveruje presnú finálnu pozíciu AI tagu (tá závisí od
// skutočného textového layoutu vo Figme, ktorý sa v Node nedá verne
// simulovať — pozri komentár v tests/email-layout-geometry.test.js). Overuje
// mechanizmus opravy: keď je AI_ON, headline dostane MENEJ dostupnej výšky
// než keď AI_ON nie je — presne o rezervu, akú počíta aiNoteFontSize(format)
// * 2.2 (rovnaký vzorec ako existujúca aiRezerva v buildMasterSafeLayout).
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
    createRectangle: makeNode,
    createText: makeNode,
    createFrame: makeNode,
    showUI: function () {},
    closePlugin: function () {},
    ui: { onmessage: null, postMessage: function () {} },
    root: { children: [] },
    currentPage: { children: [] }
  },
  console: console
};
vm.createContext(context);
vm.runInContext(
  source +
  "\nthis.buildSideSafeLayout = buildSideSafeLayout;" +
  "\nthis.buildInterscrollerSafeLayout = buildInterscrollerSafeLayout;" +
  "\nthis.__setAiOn = function (v) { AI_ON = v; };",
  context
);

function headlineBottom(builderName, width, height, safeZones) {
  const frame = makeNode();
  frame.width = width;
  frame.height = height;
  const format = { width: width, height: height, safeZones: safeZones };
  const layout = { show_headline: true, show_logo: false, show_cta: true, show_ai_disclosure: true };
  context.__frame = frame;
  context.__format = format;
  context.__layout = layout;
  vm.runInContext(
    builderName + '(__frame, __format, __layout, "Investovanie", "Zistiť viac", null, null);',
    context
  );
  const headline = frame.findOne((n) => n.name === "Headline");
  assert(headline, builderName + " " + width + "x" + height + ": headline must be drawn");
  return headline.y + headline.height;
}

const cases = [
  ["buildSideSafeLayout", 450, 800, { safeInner: { width: 160, height: 600 } }],
  ["buildSideSafeLayout", 160, 600, { safeInner: { width: 160, height: 600 } }],
  ["buildInterscrollerSafeLayout", 400, 600, { top: 30 }]
];

for (const [builderName, w, h, safeZones] of cases) {
  vm.runInContext("__setAiOn(false);", context);
  const withoutAi = headlineBottom(builderName, w, h, safeZones);
  vm.runInContext("__setAiOn(true);", context);
  const withAi = headlineBottom(builderName, w, h, safeZones);
  assert(
    withAi < withoutAi,
    builderName + " " + w + "x" + h + ": headline bottom with AI_ON (" + withAi +
    ") must be smaller (higher up) than without it (" + withoutAi + ")"
  );
}

vm.runInContext("__setAiOn(false);", context);
console.log("AI tag headline reservation: ok");
