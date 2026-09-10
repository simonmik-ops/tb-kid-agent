// Regresia 10.9.2026 (zadanie E2, buildBrandingSkinLayout 2000x1400/1920x1080
// dvojstlpcova "publisher branding" kompozicia — Markiza/JOJ): oba loga sa
// ukotvovali hore vlavo v KAZDOM stlpci (pad, 48) — namerane na zivom
// vystupe (Figma L6yFpLkKcHe9flUk3i11T1, 110:8897): loga na (44,48) a
// (1544,48). Podla pravidla ("logo patri vpravo dole") maju sediet v
// PRAVOM DOLNOM rohu — ale SVOJHO VLASTNEHO panelu, nie celeho ramu.
//
// DOLEZITE (explicitna korekcia v zadani v5): toto NIE JE duplicitny prvok,
// ktory by stacilo zjednotit na jeden. Su to DVE zrkadlene kompozicie (dva
// "Dim brand background" pasy, dva headline, dva CTA) okolo centralnej
// "Website content area guide" zony — oprava ako duplicity by stratila
// cely pravy pas. Test preto explicitne overuje, ze OBE loga zostavaju
// zachovane (count===2), kazde vo svojom vlastnom stlpci, nie na tom istom
// mieste.
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync(require.resolve("../plugin/code.js"), "utf8");

function makeNode() {
  const node = {
    name: "", x: 0, y: 0, width: 0, height: 0, fills: [], children: [], visible: true,
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
vm.runInContext(source + "\nthis.buildBrandingSkinLayout = buildBrandingSkinLayout;", context);

function run(width, height, safeZones) {
  const frame = makeNode();
  frame.width = width; frame.height = height;
  const format = { width, height, safeZones };
  const layout = { show_headline: true, show_logo: true, show_cta: true };
  context.__frame = frame; context.__format = format; context.__layout = layout;
  context.__headline = "Investovanie s Tatra bankou"; context.__ctaText = "Zistiť viac";
  context.__figmaImage = null; context.__figmaLogo = { hash: "fake-logo" };
  vm.runInContext(
    "buildBrandingSkinLayout(__frame, __format, __layout, __headline, __ctaText, __figmaImage, __figmaLogo);",
    context
  );
  return frame;
}

// Markíza/JOJ 2000×1400 (formats.js: safeZones {centerWidth:1000, topOffset:200})
{
  const frame = run(2000, 1400, { centerWidth: 1000, topOffset: 200 });
  const logos = frame.findAll((n) => n.name === "Logo");
  assert.strictEqual(logos.length, 2,
    "2000x1400 must keep BOTH mirrored logos (fixing as a duplicate would lose the right strip), got " + logos.length);

  const sideW = Math.round((2000 - 1000) / 2); // 500
  const pad = 44;
  const [left, right] = logos[0].x < logos[1].x ? [logos[0], logos[1]] : [logos[1], logos[0]];

  // Ľavý stĺpec: [0, sideW]. Pravý dolný roh JEHO panelu = x blízko sideW-pad.
  assert(left.x + left.width <= sideW,
    "left logo must stay inside its own column (x+w <= sideW=" + sideW + "), got right=" + (left.x + left.width));
  assert(left.x + left.width >= sideW - pad - 5,
    "left logo must be anchored to the RIGHT edge of its own column, not top-left, got right=" + (left.x + left.width));
  assert(left.y + left.height >= 1400 - pad - 5,
    "left logo must be anchored to the BOTTOM of the frame, not top (old bug: y=48), got bottom=" + (left.y + left.height));

  // Pravý stĺpec: [width-sideW, width]. Pravý dolný roh = blízko width-pad.
  assert(right.x >= 2000 - sideW,
    "right logo must stay inside its own column (x >= width-sideW=" + (2000 - sideW) + "), got x=" + right.x);
  assert(right.x + right.width >= 2000 - pad - 5,
    "right logo must be anchored to the right edge of the frame, got right=" + (right.x + right.width));
  assert(right.y + right.height >= 1400 - pad - 5,
    "right logo must be anchored to the bottom of the frame, not top (old bug: y=48), got bottom=" + (right.y + right.height));

  // Oba loga musia sedieť na rovnakej výške (mirrored, symmetric bottom anchor).
  assert.strictEqual(left.y, right.y,
    "left and right logo must share the same y (mirrored bottom anchor), got left.y=" + left.y + " right.y=" + right.y);

  // Loga nesmú zasahovať do centrálnej "Website content area guide" zóny.
  const guide = frame.findOne((n) => n.name === "Website content area guide");
  assert(left.x + left.width <= guide.x,
    "left logo must not overlap the central content-area guide, got left.right=" + (left.x + left.width) + " guide.x=" + guide.x);
  assert(right.x >= guide.x + guide.width,
    "right logo must not overlap the central content-area guide, got right.x=" + right.x + " guide.right=" + (guide.x + guide.width));
}

console.log("branding_skin mirrored logo anchor, bottom-right per own panel (zadanie E2): ok");
