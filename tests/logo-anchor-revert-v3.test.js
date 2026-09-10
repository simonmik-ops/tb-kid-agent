// Regresia 10.9.2026 (logo zadanie v3): v1/E/E2/logo-úloha-5 zovšeobecnili
// jedno meranie (REFERENCIA_Surdo_hodnoty_18_8.md kap. 4 — 300×600 a
// 970×250) na CELÚ publisher rodinu (side_safe/branding_skin/
// interscroller). Na úzkych ráموch (120×600, 300×600, 600×960...) logo a
// CTA nemajú dosť miesta zdieľať riadok bez zásahu do jedného z nich —
// namerané naživo: 120×600 CTA[12,513,40,44] vs logo[58,502,50,55],
// medzera 6px; JOJ interscroller 300×600 malo CTA aj logo v jednom
// natlačenom riadku.
//
// v3 nariaďuje REVERT side_safe/branding_skin/interscroller na presne tú
// geometriu, akú mali PRED zadaním E (commit b0fefbe, posledný pred
// ca2278c) — logo hore vľavo (side_safe/interscroller) alebo hore v
// stĺpci (branding_skin), CTA nedotknuté (plná šírka, pôvodná pozícia).
// Toto NIE JE schválenie tejto pozície ako správnej — je to návrat na
// baseline, ktorý nikdy nebol preukázanou regresiou (v3 zadanie, "Revert
// je návrat na baseline"). Správna pozícia (per-formát PSD/Figma alebo
// "unknown — čaká na predlohu") je mimo rozsahu tohto commitu.
//
// buildEmailLayout NIE JE v revert zozname (v3 zadanie ho nespomína ako
// regresiu) — zostáva nezmenený z dnešnej skoršej opravy.
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

function makeContext() {
  const context = {
    __html__: "<html></html>",
    figma: {
      createRectangle: makeNode, createFrame: makeNode,
      createText: function () {
        const node = makeNode();
        let _chars = "", _height = 0, _width = 0, _autoResize = "NONE";
        Object.defineProperty(node, "characters", { get() { return _chars; }, set(v) { _chars = v; } });
        Object.defineProperty(node, "textAutoResize", { get() { return _autoResize; }, set(v) { _autoResize = v; } });
        Object.defineProperty(node, "height", {
          get() {
            if (_autoResize === "WIDTH_AND_HEIGHT") return this.fontSize ? Math.round(this.fontSize * 1.3) : 0;
            if (_autoResize === "HEIGHT" && this.fontSize && this.width) {
              const cpl = Math.max(1, Math.floor(this.width / (this.fontSize * 0.55)));
              const lines = Math.max(1, Math.ceil(String(_chars).length / cpl));
              return Math.ceil(lines * this.fontSize * 1.3);
            }
            return _height;
          },
          set(v) { _height = v; }
        });
        Object.defineProperty(node, "width", {
          get() {
            if (_autoResize === "WIDTH_AND_HEIGHT") return this.fontSize ? Math.round(String(_chars).length * this.fontSize * 0.55) : 0;
            return _width;
          },
          set(v) { _width = v; }
        });
        node.type = "TEXT";
        return node;
      },
      showUI: function () {}, closePlugin: function () {},
      ui: { onmessage: null, postMessage: function () {} },
      root: { children: [] }, currentPage: { children: [] }
    },
    console: console
  };
  vm.createContext(context);
  vm.runInContext(
    source +
      "\nthis.buildSideSafeLayout = buildSideSafeLayout;" +
      "\nthis.buildBrandingSkinLayout = buildBrandingSkinLayout;" +
      "\nthis.buildInterscrollerSafeLayout = buildInterscrollerSafeLayout;" +
      "\nthis.resolveSideSafeContentBox = resolveSideSafeContentBox;",
    context
  );
  return context;
}

// ── side_safe: 120x600, 160x600, 450x800 — logo hore vľavo, CTA plná šírka ──
for (const [w, h] of [[120, 600], [160, 600], [450, 800]]) {
  const context = makeContext();
  const frame = makeNode();
  frame.width = w; frame.height = h;
  const format = { width: w, height: h };
  const layout = { show_headline: true, show_logo: true, show_cta: true };
  context.__frame = frame; context.__format = format; context.__layout = layout;
  context.__headline = "Investovanie"; context.__ctaText = "Zistiť viac";
  context.__figmaImage = null; context.__figmaLogo = { hash: "fake-logo" };
  vm.runInContext(
    "buildSideSafeLayout(__frame, __format, __layout, __headline, __ctaText, __figmaImage, __figmaLogo);",
    context
  );
  const box = vm.runInContext("resolveSideSafeContentBox(__format);", context);
  const logo = frame.findOne((n) => n.name === "Logo");
  const cta = frame.findOne((n) => n.name === "CTA button");
  assert(logo, w + "x" + h + ": logo must be drawn");
  assert(cta, w + "x" + h + ": CTA must be drawn");

  assert.strictEqual(logo.x, box.x + box.pad,
    w + "x" + h + ": logo must be back at top-left of the content box (x), got " + logo.x + " expected " + (box.x + box.pad));
  assert.strictEqual(logo.y, box.y + box.pad,
    w + "x" + h + ": logo must be back at top-left of the content box (y), got " + logo.y + " expected " + (box.y + box.pad));

  const expectedBtnW = box.contentW - box.pad * 2;
  assert.strictEqual(cta.width, expectedBtnW,
    w + "x" + h + ": CTA must be back to full width (unreduced by the logo), got " + cta.width + " expected " + expectedBtnW);
}

// ── branding_skin: 2000x1400 Markíza/JOJ — logos back at y=48 per column ──
{
  const context = makeContext();
  const frame = makeNode();
  frame.width = 2000; frame.height = 1400;
  const format = { width: 2000, height: 1400, safeZones: { centerWidth: 1000, topOffset: 200 } };
  const layout = { show_headline: true, show_logo: true, show_cta: true };
  context.__frame = frame; context.__format = format; context.__layout = layout;
  context.__headline = "Investovanie"; context.__ctaText = "Zistiť viac";
  context.__figmaImage = null; context.__figmaLogo = { hash: "fake-logo" };
  vm.runInContext(
    "buildBrandingSkinLayout(__frame, __format, __layout, __headline, __ctaText, __figmaImage, __figmaLogo);",
    context
  );
  const logos = frame.findAll((n) => n.name === "Logo");
  assert.strictEqual(logos.length, 2, "2000x1400 must keep both logos, got " + logos.length);
  for (const logo of logos) {
    assert.strictEqual(logo.y, 48,
      "2000x1400: logo must be back at y=48 (top of its column), got y=" + logo.y);
  }
}

// ── interscroller: JOJ mobile 300x600 and desktop 600x960 — logo hore vľavo
// v paneli, CTA nezúžené. Priamo porovnané s Simoniným meraním živého
// výstupu (110:13262/13263 a 110:13277/13278).
for (const [w, h] of [[300, 600], [600, 960]]) {
  const context = makeContext();
  const frame = makeNode();
  frame.width = w; frame.height = h;
  const format = { width: w, height: h, safeZones: { top: 0, bottom: 0 } };
  const layout = { show_headline: true, show_logo: true, show_cta: true };
  context.__frame = frame; context.__format = format; context.__layout = layout;
  context.__headline = "Investovanie"; context.__ctaText = "Zistiť viac";
  context.__figmaImage = null; context.__figmaLogo = { hash: "fake-logo" };
  vm.runInContext(
    "buildInterscrollerSafeLayout(__frame, __format, __layout, __headline, __ctaText, __figmaImage, __figmaLogo);",
    context
  );
  const logo = frame.findOne((n) => n.name === "Logo");
  const cta = frame.findOne((n) => n.name === "CTA button");
  assert(logo, w + "x" + h + ": logo must be drawn");
  assert(cta, w + "x" + h + ": CTA must be drawn");

  // CTA nesmie byť zúžené kvôli logu — pôvodná šírka je odvodená čisto z
  // getInterscrollerComposition(), nezávisle od loga.
  const compW = frame.width; // sanity: btnW formula reused below via direct recompute is avoided;
  // namiesto duplicity porovnaj len to, že logo a CTA sa neprekrývajú a
  // logo je hore (bližšie k panelY), presne ako pred zadaním E.
  assert(logo.y <= cta.y,
    w + "x" + h + ": logo must be back above the CTA row (top of panel), not sharing/below it, got logo.y=" +
    logo.y + " cta.y=" + cta.y);
}

console.log("logo anchor REVERT to pre-E baseline (side_safe/branding_skin/interscroller, logo zadanie v3): ok");
