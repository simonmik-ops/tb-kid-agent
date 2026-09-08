// Zadanie 31.8, blok A / P0-22: addAdformBackgroundTreatment()'s "Brand
// panel" gradient reached full opacity at 45% of the PANEL's own width,
// independent of where the photo zone actually ends. After block B (26.8)
// moved panelX from 549 to 450, 45% of the panel (x=684) landed well past
// the photo zone's real edge (x=549, ADFORM_970X250_PHOTO_EDGE_X) — so the
// first 89px of the headline (x=460) sat on the bare photo under only a
// 20-40% veil instead of full coverage. Same visible bug as before block B,
// just less obvious.
//
// Fix: the ramp's full-opacity stop is now computed directly from
// ADFORM_970X250_PHOTO_EDGE_X, the same constant used for the photo zone
// itself in buildAdformPsdLayout — one source of truth instead of two
// independently-drifting magic numbers (this is the second time they
// diverged: 549 vs 425 on 18.8., 549 vs 450 on 26.8.).
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync(require.resolve("../plugin/code.js"), "utf8");

// Both call sites must reference the same named constant, not independent
// literals — the actual point of this fix.
const usages = source.match(/ADFORM_970X250_PHOTO_EDGE_X/g) || [];
assert(usages.length >= 3, "the constant must be declared once and used in both the photo-zone call and the panel ramp (found " + usages.length + " occurrences)");

function makeNode(overrides) {
  const node = Object.assign({
    name: "", x: 0, y: 0, width: 0, height: 0, fills: [], children: [],
    resize: function (w, h) { this.width = w; this.height = h; },
    appendChild: function (child) { child.parent = this; this.children.push(child); },
    findOne: function (pred) {
      for (const c of this.children) {
        if (pred(c)) return c;
        const found = c.findOne ? c.findOne(pred) : null;
        if (found) return found;
      }
      return null;
    }
  }, overrides || {});
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
vm.runInContext(source + "\nthis.addAdformBackgroundTreatment = addAdformBackgroundTreatment;", context);

const frame = makeNode({ width: 970, height: 250 });
const format = { width: 970, height: 250 };
const rules = { panel: [450, 0, 520, 250] };
const layout = {};
context.__frame = frame; context.__format = format; context.__rules = rules; context.__layout = layout;
vm.runInContext(
  'addAdformBackgroundTreatment(__frame, __format, __rules, "adform_970x250", __layout);',
  context
);

const panel = frame.findOne((n) => n.name === "Brand panel");
assert(panel, "Brand panel must be drawn");
const stops = panel.fills[0].gradientStops;
assert.strictEqual(stops.length, 3, "ramp must have three stops (transparent, full-opacity boundary, full-opacity end)");
assert.strictEqual(stops[0].color.a, 0, "the panel must start fully transparent at its own left edge (x=450)");

// panelX=450, panelW=520, photo edge x=549 -> (549-450)/520 = 0.1904 (~0.19,
// matches the hand-measured value in the assignment exactly).
const expectedBoundary = (549 - 450) / 520;
assert(Math.abs(stops[1].position - expectedBoundary) < 0.001,
  "the full-opacity stop must sit at the photo zone's real edge (expected " + expectedBoundary.toFixed(4) + ", got " + stops[1].position);
assert.strictEqual(stops[1].color.a, 1, "opacity must reach 1.0 exactly at the photo edge, not partway");
assert.strictEqual(stops[2].color.a, 1, "opacity must stay fully opaque to the end of the panel");

console.log("adform 970x250 panel ramp: ok");
