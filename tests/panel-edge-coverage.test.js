// Zadanie 26.8, blok F: "Readable panel" (side_safe) a "Readable message
// panel" (interscroller_safe) končili pred skutočným spodkom rámu (hola
// fotka pod nimi, namerané: topky 450×800 100px, joj 600×960 33px) a
// interscroller_safe má naviac tvrdé zvislé hrany na inset ľavej/pravej
// strane panelu (namerané: joj 600×960, topky 400×600, markíza 720×1280).
// Tento test overuje, že po oprave panel + extension spolu skutočne
// pokrývajú až po format.height, a že feather pásy na inset hranách
// existujú s očakávaným smerom alfa nábehu — beží skutočný zdroj cez vm,
// rovnaký mock ako ostatné vm-based testy v tomto repe.
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
  "\nthis.buildInterscrollerSafeLayout = buildInterscrollerSafeLayout;",
  context
);

function run(builderName, width, height, safeZones) {
  const frame = makeNode();
  frame.width = width;
  frame.height = height;
  const format = { width: width, height: height, safeZones: safeZones };
  const layout = { show_headline: true, show_logo: false, show_cta: true, show_ai_disclosure: false };
  context.__frame = frame;
  context.__format = format;
  context.__layout = layout;
  vm.runInContext(
    builderName + '(__frame, __format, __layout, "Investovanie", "Zistiť viac", null, null);',
    context
  );
  return frame;
}

// side_safe: topky_branding 450×800, safeInner 160×600 — malo 100px medzeru.
{
  const frame = run("buildSideSafeLayout", 450, 800, { safeInner: { width: 160, height: 600 } });
  const panel = frame.findOne((n) => n.name === "Readable panel");
  const ext = frame.findOne((n) => n.name === "Readable panel extension");
  assert(panel, "panel must exist");
  assert(ext, "panel extension must exist when panel does not reach the frame bottom");
  assert.strictEqual(panel.y + panel.height, ext.y, "extension must start exactly where the panel ends");
  assert.strictEqual(ext.y + ext.height, 800, "panel + extension must together reach format.height");
}

// interscroller_safe: joj 600×960, safeZones top/bottom 0 — malo 33px medzeru
// a tvrdé ľavé/pravé hrany (non-wide vetva, ratio 0.625 < 1.35).
{
  const frame = run("buildInterscrollerSafeLayout", 600, 960, { top: 0, bottom: 0 });
  const panel = frame.findOne((n) => n.name === "Readable message panel");
  const ext = frame.findOne((n) => n.name === "Readable message panel extension");
  const leftFeather = frame.findOne((n) => n.name === "Readable message panel — left feather");
  const rightFeather = frame.findOne((n) => n.name === "Readable message panel — right feather");
  assert(panel && ext, "panel and extension must exist");
  assert.strictEqual(panel.y + panel.height, ext.y, "extension must start exactly where the panel ends");
  assert.strictEqual(ext.y + ext.height, 960, "panel + extension must together reach format.height");
  assert(leftFeather && rightFeather, "left/right feather strips must exist on the narrow (non-wide) branch");
  assert.strictEqual(leftFeather.x + leftFeather.width, panel.x, "left feather must sit flush against the panel's left edge");
  assert.strictEqual(rightFeather.x, panel.x + panel.width, "right feather must sit flush against the panel's right edge");
  assert.strictEqual(leftFeather.fills[0].gradientStops[0].color.a, 0, "left feather must start transparent (photo side)");
  assert.strictEqual(leftFeather.fills[0].gradientStops[1].color.a, 1, "left feather must end opaque (panel side)");
  assert.strictEqual(rightFeather.fills[0].gradientStops[0].color.a, 1, "right feather must start opaque (panel side)");
  assert.strictEqual(rightFeather.fills[0].gradientStops[1].color.a, 0, "right feather must end transparent (photo side)");
}

console.log("panel edge coverage: ok");
