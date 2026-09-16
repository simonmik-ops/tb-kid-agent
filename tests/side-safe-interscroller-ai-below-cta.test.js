// Regresia 13.9.2026 (kontrola regresie spôsobenej a09af6c, logo zadanie
// v3): a09af6c revertlo CELÝ pôvodný "zadanie E" commit v buildSideSafeLayout
// aj buildInterscrollerSafeLayout naraz — logo geometria (správne, na
// úzkych formátoch nemala dosť miesta zdieľať riadok s CTA) AJ nezávislá AI
// disclosure rezerva (btnY sa neposúval o aiRezerva, len ctaTop/ctaBudget
// pre headline) sa vrátili do pôvodného stavu spolu. Tieto dve veci spolu
// nesúvisia — logo pozícia neovplyvňuje, kde sedí CTA voči AI tagu.
//
// Namerané naživo pred týmto fixom (zhodné s pôvodným nálezom zadania E):
// CTA sedelo na úplnom spodku panelu/zóny, AI tag (addAiNote, kreslí sa AŽ
// PO builderi, v orchestrácii) sa vlastnou kolíznou poistkou vtesnal NAD
// CTA namiesto pod ním.
//
// Tento test overuje LEN AI/CTA poradie — logo geometria (hore vľavo, po
// a09af6c revertnutá) je overená samostatne v tests/logo-anchor-revert-v3
// .test.js a týmto fixom sa nemení.
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
      "\nthis.buildInterscrollerSafeLayout = buildInterscrollerSafeLayout;" +
      "\nthis.addAiNote = addAiNote;" +
      "\nthis.resolveSideSafeContentBox = resolveSideSafeContentBox;" +
      "\nthis.getInterscrollerComposition = getInterscrollerComposition;" +
      "\nthis.AI_ON = true;",
    context
  );
  vm.runInContext("AI_ON = true;", context);
  return context;
}

const layout = { show_headline: true, show_logo: true, show_cta: true, show_ai_disclosure: true };

for (const [w, h] of [[120, 600], [160, 600], [450, 800]]) {
  const context = makeContext();
  const frame = makeNode();
  frame.width = w; frame.height = h;
  const format = { width: w, height: h };
  context.__frame = frame; context.__format = format; context.__layout = layout;
  context.__headline = "Investovanie s Tatra bankou"; context.__ctaText = "Zistiť viac";
  context.__figmaImage = null; context.__figmaLogo = { hash: "fake-logo" };
  vm.runInContext(
    "buildSideSafeLayout(__frame, __format, __layout, __headline, __ctaText, __figmaImage, __figmaLogo);",
    context
  );
  vm.runInContext(
    "var b = resolveSideSafeContentBox(__format); addAiNote(__frame, __format, { x: b.panelX, y: b.panelY, w: b.panelW, h: b.panelH });",
    context
  );
  const cta = frame.findOne((n) => n.name === "CTA button");
  const ai = frame.findOne((n) => n.name === "AI generované");
  assert(cta && ai, "side_safe " + w + "x" + h + ": CTA and AI tag must both be drawn");
  assert(ai.y >= cta.y + cta.height,
    "side_safe " + w + "x" + h + ": AI tag must sit below CTA, got ai.y=" + ai.y + " cta.bottom=" + (cta.y + cta.height));
}

for (const [w, h] of [[720, 1280], [300, 600], [600, 960]]) {
  const context = makeContext();
  const frame = makeNode();
  frame.width = w; frame.height = h;
  const format = { width: w, height: h, safeZones: { top: 0, bottom: 0 } };
  context.__frame = frame; context.__format = format; context.__layout = layout;
  context.__headline = "Investovanie"; context.__ctaText = "Zistiť viac";
  context.__figmaImage = null; context.__figmaLogo = { hash: "fake-logo" };
  vm.runInContext(
    "buildInterscrollerSafeLayout(__frame, __format, __layout, __headline, __ctaText, __figmaImage, __figmaLogo);",
    context
  );
  vm.runInContext(
    "var comp = getInterscrollerComposition(__format); addAiNote(__frame, __format, { x: comp.panelX, y: comp.panelY, w: comp.panelW, h: comp.panelH });",
    context
  );
  const cta = frame.findOne((n) => n.name === "CTA button");
  const ai = frame.findOne((n) => n.name === "AI generované");
  assert(cta && ai, "interscroller " + w + "x" + h + ": CTA and AI tag must both be drawn");
  assert(ai.y >= cta.y + cta.height,
    "interscroller " + w + "x" + h + ": AI tag must sit below CTA, got ai.y=" + ai.y + " cta.bottom=" + (cta.y + cta.height));
}

console.log("side_safe/interscroller: AI tag stays below CTA after a09af6c revert (regression check): ok");
