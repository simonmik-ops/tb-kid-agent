// Zadanie 31.8 (revízia) / P1-12: buildLogoOnlyLayout()'s logo height had a
// hard 80px cap regardless of canvas size. On 1200×1200 logo-asset formats
// (Google logo formats — the logo IS the entire content of the canvas),
// that capped the logo at 6.7% of the frame height. The cap never actually
// bound on the smaller formats already in the catalog (1200×300 gives 75px
// from the percentage minimums alone, well under 80). Removed — the two
// percentage-based minimums (25% height, 18% width) scale sensibly on
// their own for both large and small canvases.
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync(require.resolve("../plugin/code.js"), "utf8");

function makeNode() {
  const node = {
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
vm.runInContext(source + "\nthis.buildLogoOnlyLayout = buildLogoOnlyLayout;", context);

function run(width, height) {
  const frame = makeNode();
  frame.width = width; frame.height = height;
  const format = { width: width, height: height, role: "logo_only", id: "google_logo_square" };
  const layout = { show_headline: false };
  context.__frame = frame; context.__format = format; context.__layout = layout;
  vm.runInContext('buildLogoOnlyLayout(__frame, __format, __layout, null, {hash:"fake-logo"});', context);
  return frame.findOne((n) => n.name === "Logo");
}

const bigLogo = run(1200, 1200);
assert(bigLogo, "logo must be drawn on 1200×1200");
assert(bigLogo.height > 80, "1200×1200 logo asset must not be capped at 80px, got " + bigLogo.height);
assert.strictEqual(bigLogo.height, Math.min(Math.round(1200 * 0.25), Math.round(1200 * 0.18)),
  "1200×1200 logo height must equal the uncapped percentage minimum");

const wideLogo = run(1200, 300);
assert(wideLogo, "logo must be drawn on 1200×300");
assert.strictEqual(wideLogo.height, Math.min(Math.round(300 * 0.25), Math.round(1200 * 0.18)),
  "1200×300 logo height must be unaffected (already under the old 80px cap)");

console.log("logo-only size cap: ok");
