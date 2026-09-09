// Regresia 9.9.2026: buildAdformPsdLayout() kreslilo KV pre VŠETKY Adform
// templaty (okrem 970×250/160×600/300×250) cez jednu spoločnú vetvu —
// addFocalImageFrame(..., [0,0,format.width,format.height], ...) —
// nezávisle od orientácie zdrojového KV. Komentár priamo nad touto vetvou
// ("fallback vetvy uz nie su potrebne") bol kalibrovaný proti portrait/
// landscape zdrojom; pri ŠTVORCOVOM zdroji (layout.kv_source_kind ===
// "square") a POŽADOVANOM portrait cieli (layout.asset_fallback_kind ===
// "portrait") na adform_300x600 (pomer 1:2) cover-crop cez celú výšku
// vynúti extrémny zoom — takmer 2× priblíženie oproti šírke — namiesto
// chránenej štvorcovej kompozície s farebnou extension plochou, akú
// ukazuje referencia (z2gIXYePfNODOwmjecZwRB, frame 2:1247).
//
// Skutočný portrait/landscape zdroj (kv_source_kind !== "square") touto
// novou vetvou vôbec neprechádza — pre neho platí presne to isté správanie
// ako predtým (žiadna zmena, overené nižšie).
//
// ADFORM_PSD_RULES (headline/CTA/legal/logo súradnice, P0-19 zmrazené)
// zostávajú úplne nedotknuté — táto oprava sa týka LEN KV kompozície.
//
// Test beží skutočný buildAdformPsdLayout() zo zdroja (cez vm).
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync(require.resolve("../plugin/code.js"), "utf8");

function makeNode() {
  const node = {
    name: "", x: 0, y: 0, width: 0, height: 0, fills: [], children: [],
    fontName: null, fontSize: 0, characters: "", textAutoResize: "NONE",
    rotation: 0, effects: [], cornerRadius: 0, opacity: 1, locked: false,
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
    createRectangle: makeNode,
    createEllipse: makeNode,
    createFrame: makeNode,
    createText: function () {
      const node = makeNode();
      let _chars = "", _height = 0, _autoResize = "NONE";
      Object.defineProperty(node, "characters", { get() { return _chars; }, set(v) { _chars = v; } });
      Object.defineProperty(node, "textAutoResize", { get() { return _autoResize; }, set(v) { _autoResize = v; } });
      Object.defineProperty(node, "height", {
        get() {
          if (_autoResize === "HEIGHT" && this.fontSize && this.width) {
            const cpl = Math.max(1, Math.floor(this.width / (this.fontSize * 0.55)));
            const lines = Math.max(1, Math.ceil(String(_chars).length / cpl));
            return Math.ceil(lines * this.fontSize * 1.3);
          }
          return _height;
        },
        set(v) { _height = v; }
      });
      return node;
    },
    showUI: function () {},
    closePlugin: function () {},
    ui: { onmessage: null, postMessage: function () {} },
    root: { children: [] },
    currentPage: { children: [] }
  },
  console: console
};
vm.createContext(context);
vm.runInContext(source + "\nthis.buildAdformPsdLayout = buildAdformPsdLayout;", context);

function run(assetFallbackKind, kvSourceKind) {
  const frame = makeNode();
  frame.width = 300;
  frame.height = 600;
  const format = { width: 300, height: 600, id: "adform_300x600" };
  const layout = { asset_fallback_kind: assetFallbackKind, kv_source_kind: kvSourceKind };
  // legalText prítomný zámerne — vypína compactCopy vetvu v
  // resolveAdformPsdRules (inak by sa headline/CTA/logo súradnice menili
  // na kompaktný variant, nezávisle od tejto opravy, a nesedeli by na
  // základné ADFORM_PSD_RULES hodnoty overované nižšie).
  const content = {
    headline: "Investovanie", subheadline: null, ctaText: "Zistiť viac",
    legalText: "Marketingové oznámenie. S investovaním sú spojené riziká.", badgeText: null
  };
  context.__frame = frame;
  context.__format = format;
  context.__layout = layout;
  context.__content = content;
  context.__figmaImage = { hash: "fake-image" };
  context.__figmaLogo = { hash: "fake-logo" };
  vm.runInContext(
    "buildAdformPsdLayout(__frame, __format, __layout, __content, __figmaImage, {width:1000,height:1000}, __figmaLogo, \"adform_300x600\");",
    context
  );
  return frame;
}

// Prípad zo zadania: požadovaný portrait cieľ, k dispozícii len štvorcový master.
const fallbackFrame = run("portrait", "square");
const protectedKv = fallbackFrame.findOne((n) => n.name === "Key visual — protected square");
const colourExtension = fallbackFrame.findOne((n) => n.name === "Key visual crop — colour extension");
const oldFullFrameCrop = fallbackFrame.findOne((n) => n.name === "Key visual — focal crop");

assert(protectedKv, "adform_300x600 (square fallback): protected square KV must be drawn");
assert(colourExtension, "adform_300x600 (square fallback): colour extension must be drawn");
assert(!oldFullFrameCrop, "adform_300x600 (square fallback): must NOT use the old full-frame cover-crop (extreme zoom)");

assert.strictEqual(protectedKv.width, 523, "protected KV width must match the reference (523), got " + protectedKv.width);
assert.strictEqual(protectedKv.height, 523, "protected KV height must match the reference (523), got " + protectedKv.height);
assert.strictEqual(protectedKv.x, -112, "protected KV x must match the reference (-112), got " + protectedKv.x);
assert.strictEqual(protectedKv.y, -46, "protected KV y must match the reference (-46), got " + protectedKv.y);

assert.strictEqual(colourExtension.y, 423, "colour extension y must match the reference (423), got " + colourExtension.y);
assert.strictEqual(colourExtension.height, 177, "colour extension height must match the reference (177), got " + colourExtension.height);

// Prechod musí byť plynulý (plná krycosť presne tam, kde fotka končí:
// -46+523=477, t.j. pozícia (477-423)/177≈0.305 v extension rámci) — nie
// tvrdý rez a nie príliš skorá/neskorá plná krycosť.
const stops = colourExtension.fills[0].gradientStops;
function alphaAt(position, stopsArr) {
  for (let i = 0; i < stopsArr.length - 1; i++) {
    const a = stopsArr[i], b = stopsArr[i + 1];
    if (position >= a.position && position <= b.position) {
      const t = (position - a.position) / (b.position - a.position || 1);
      return a.color.a + t * (b.color.a - a.color.a);
    }
  }
  return stopsArr[stopsArr.length - 1].color.a;
}
const boundaryPos = (-46 + 523 - 423) / 177;
assert(alphaAt(boundaryPos, stops) >= 0.99,
  "colour extension must reach full opacity exactly where the photo ends, got alpha=" + alphaAt(boundaryPos, stops).toFixed(3));
assert(alphaAt(0, stops) <= 0.01,
  "colour extension must be fully transparent at its own top edge (y=423, still inside the photo's real bottom)");

// ADFORM_PSD_RULES (headline/CTA/legal/logo) musia zostať úplne nedotknuté.
const headline = fallbackFrame.findOne((n) => n.name === "Headline");
const cta = fallbackFrame.findOne((n) => n.name === "CTA button");
assert(headline && headline.x === 21 && headline.y === 367 && headline.width === 260,
  "Headline must stay at the frozen ADFORM_PSD_RULES position (P0-19), got " +
  (headline ? headline.x + "," + headline.y + "," + headline.width : "missing"));
assert(cta && cta.x === 20 && cta.y === 496 && cta.width === 140 && cta.height === 48,
  "CTA button must stay at the frozen ADFORM_PSD_RULES position (P0-19), got " +
  (cta ? cta.x + "," + cta.y + "," + cta.width + "," + cta.height : "missing"));

// Skutočný portrait/landscape zdroj (kv_source_kind !== "square") nesmie
// touto novou vetvou prechádzať vôbec — správanie musí zostať presne
// pôvodné (addFocalImageFrame, plný cover-crop).
for (const sourceKind of ["portrait", "landscape", "missing", null]) {
  const frame2 = run("portrait", sourceKind);
  const oldCrop = frame2.findOne((n) => n.name === "Key visual — focal crop");
  const newProtected = frame2.findOne((n) => n.name === "Key visual — protected square");
  assert(oldCrop, "kv_source_kind=" + sourceKind + ": must keep using the original full-frame cover-crop, unaffected by this fix");
  assert(!newProtected, "kv_source_kind=" + sourceKind + ": must NOT get the new protected-square treatment");
}

// Bez asset_fallback_kind (exact-orientation asset available) musí byť
// tiež úplne nedotknuté.
{
  const frame3 = run(null, "portrait");
  const oldCrop = frame3.findOne((n) => n.name === "Key visual — focal crop");
  assert(oldCrop, "exact-orientation asset: must keep using the original full-frame cover-crop");
}

console.log("Adform 300x600 square-source-into-portrait-target fallback: ok");
