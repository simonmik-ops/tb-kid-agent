// Zadanie 31.8, revízia T-6 / P2-34: buildMasterSafeLayout()'s wide-family
// headline/subheadline width used to depend on whether the ACTUAL rendered
// text height happened to cross logoTop — which itself depended on whether
// a CTA was present (CTA reserves space, pushing text higher, away from the
// logo row). On the same 1200×628 frame with the same logo, Meta (no CTA)
// got a narrow box (321px, measured) and Demand gen (has CTA) got a wide
// one (504px, measured, ending flush against the logo with only 16px of
// vertical clearance) — same visual column, two different widths, fragile
// to a longer headline pushing into the logo.
//
// Fix: the column width now reserves the logo's footprint unconditionally
// whenever the logo is shown, independent of CTA presence or text length.
// This test runs the real buildMasterSafeLayout via vm for both a
// no-CTA (Meta-like) and a CTA (Demand gen-like) profile on the same
// 1200×628 frame and checks they get the identical headline width.
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync(require.resolve("../plugin/code.js"), "utf8");

// Source-level regression: the old height-triggered conditional re-narrow
// (wideWidth()/logoTop-based reserve toggling) must be gone — this is what
// actually made width depend on CTA presence. The lightweight vm mock below
// doesn't simulate real text auto-resize, so it can't reproduce the old
// bug's exact geometry difference; this check ties the test to the real fix.
assert(!/function wideWidth/.test(source), "the old height-triggered width function must be removed");
assert(/wLogoReserve/.test(source), "textW must reserve the logo footprint unconditionally (wLogoReserve)");

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
    createRectangle: makeNode, createText: makeNode, createFrame: makeNode, createEllipse: makeNode,
    showUI: function () {}, closePlugin: function () {},
    ui: { onmessage: null, postMessage: function () {} },
    root: { children: [] }, currentPage: { children: [] }
  },
  console: console
};
vm.createContext(context);
vm.runInContext(source + "\nthis.buildMasterSafeLayout = buildMasterSafeLayout;", context);

function run(showCta) {
  const frame = makeNode();
  frame.width = 1200; frame.height = 628;
  const format = { width: 1200, height: 628, safeBox: null, deadZones: [] };
  const layout = {
    show_headline: true, show_logo: true, show_cta: showCta,
    show_subheadline: true, show_ai_disclosure: false
  };
  const content = { headline: "Investujte", subheadline: "Zacnite dnes", ctaText: showCta ? "Zistit viac" : null, showGuides: false };
  context.__frame = frame; context.__format = format; context.__layout = layout; context.__content = content;
  vm.runInContext("buildMasterSafeLayout(__frame, __format, __layout, __content, null, null, {hash:'fake-logo'}, null);", context);
  const headline = frame.findOne((n) => n.name === "Headline");
  return headline;
}

const withoutCta = run(false); // Meta-like
const withCta = run(true);     // Demand gen-like

assert(withoutCta && withCta, "headline must be drawn in both cases");
assert.strictEqual(withoutCta.width, withCta.width,
  "headline width must be identical regardless of CTA presence (no-CTA=" + withoutCta.width + ", CTA=" + withCta.width + ")");

console.log("wide-family headline width consistency: ok");
