// Regresia 10.9.2026 (logo zadanie v3, úloha 4): Meta logo pozície boli v
// predchádzajúcich zadaniach označené ako "neoverené" (odporúčanie, nie
// meranie). v3 zadanie ich odmeralo priamo na vygenerovanej Meta sade
// (110:13731, 110:13754, 110:13772) a žiada ich ZMRAZIŤ ako regresnú
// referenciu:
//   1200×1200 -> od pravého 66, od spodného 66
//   1200×628  -> od pravého 48, od spodného 48
//   1080×1920 -> od pravého 79, od spodného 79 (pozri POZNÁMKA nižšie)
//
// Tento test overuje a zamráža LEN 1200×1200 a 1200×628 — potvrdené
// priamym behom buildMasterSafeLayout() cez skutočný zdroj, sedia presne
// na 66/66 a 48/48.
//
// POZNÁMKA — nevyriešený rozpor, NEROZHODNUTÝ tu (rovnaký princíp ako iné
// "vypíš, nerozhoduj sám" nálezy v tejto sérii zadaní): kód pre Meta
// 1080×1920 (isMetaPortrait vetva, code.js) obsahuje explicitný,
// referenčne odcitovaný komentár — "Referenčný layout nemá viditeľné
// bankové logo v portrait variante (LAYOUT-VYSKA obsahuje len HEADLINE a
// AI generované) — logo sa tu preto vôbec nekreslí, nezávisle od
// luminancie/variantu" — a skutočne NEKRESLÍ žiadny "Logo" uzol pre tento
// formát. v3 zadanie ale hovorí, že na živom výstupe (110:13772) logo BOLO
// namerané (843,1690,158×151, od pravého/spodného 79). To sú vzájomne
// nezlučiteľné tvrdenia o tom istom formáte. Kód sa v tomto commite
// NEMENÍ (žiadny logo sa nepridáva do isMetaPortrait vetvy) — čaká sa na
// potvrdenie, ktorý zdroj je aktuálny.
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync(require.resolve("../plugin/code.js"), "utf8");

function makeNode() {
  const node = {
    name: "", x: 0, y: 0, width: 0, height: 0, fills: [], children: [], visible: true, clipsContent: false,
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
vm.runInContext(source + "\nthis.buildMasterSafeLayout = buildMasterSafeLayout;", context);

function runMeta(w, h) {
  const frame = makeNode();
  frame.width = w; frame.height = h; frame.clipsContent = true;
  const format = { width: w, height: h, channel: "Meta" };
  const layout = { show_headline: true, show_logo: true, show_cta: false, show_legal: true, show_subheadline: true };
  const content = {
    headline: "Investujte s Tatra bankou", subheadline: "Od 50 eur mesačne.",
    ctaText: null, legalText: "Marketingové oznámenie.", badgeText: null, aiGenerated: true
  };
  context.__frame = frame; context.__format = format; context.__layout = layout; context.__content = content;
  context.__figmaImage = { hash: "kv" }; context.__figmaLogo = { hash: "dark" }; context.__figmaLogoWhite = { hash: "white" };
  vm.runInContext(
    "buildMasterSafeLayout(__frame, __format, __layout, __content, __figmaImage, {width:2000,height:2000}, __figmaLogo, {x:0,y:0,w:__format.width,h:__format.height}, __figmaLogoWhite);",
    context
  );
  return frame.findOne((n) => n.name === "Logo");
}

const square = runMeta(1200, 1200);
assert(square, "1200x1200: Meta logo must be drawn");
assert.strictEqual(1200 - (square.x + square.width), 66,
  "1200x1200: logo must be frozen at 66px from the right, got " + (1200 - (square.x + square.width)));
assert.strictEqual(1200 - (square.y + square.height), 66,
  "1200x1200: logo must be frozen at 66px from the bottom, got " + (1200 - (square.y + square.height)));

const wide = runMeta(1200, 628);
assert(wide, "1200x628: Meta logo must be drawn");
assert.strictEqual(1200 - (wide.x + wide.width), 48,
  "1200x628: logo must be frozen at 48px from the right, got " + (1200 - (wide.x + wide.width)));
assert.strictEqual(628 - (wide.y + wide.height), 48,
  "1200x628: logo must be frozen at 48px from the bottom, got " + (628 - (wide.y + wide.height)));

// 1080×1920: kód zámerne nekreslí logo v tomto variante (pozri POZNÁMKA
// vyššie) — test to len zdokumentuje ako aktuálny (nezmenený) stav, nie
// ako správnosť.
const portrait = runMeta(1080, 1920);
assert.strictEqual(portrait, null,
  "1080x1920: current code draws no logo here by explicit reference-cited design (see file header note) — " +
  "got a Logo node, meaning this behaviour changed and the v3 zadanie's 79/79 measurement should be re-checked against it");

console.log("Meta logo positions frozen: 1200x1200=66/66, 1200x628=48/48 (1080x1920 conflict flagged, not resolved): ok");
