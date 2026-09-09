// Regresia 9.9.2026 (rovnaká trieda ako master-safe-legal-text-overflow.test.js
// / commit f141733): buildSideSafeLayout, buildBrandingLeaderFullLayout a
// buildInterscrollerSafeLayout kreslili headline cez addText() — na rozdiel
// od addTemplateText() (master_safe/adform) táto funkcia nemá ŽIADNU
// poistku na zmenšenie fontu ani limit počtu riadkov. Headline box bol vo
// všetkých troch builderoch ukotvený ZHORA (pevný x/y), s výškou vypočítanou
// ako "zostávajúci priestor po odpočítaní CTA" (ctaTop/ctaBudget — CTA je
// vždy pozicované PRED headline, nezávisle od jeho skutočnej výšky).
// textAutoResize=HEIGHT v addText() ale rastie bez ohľadu na tento box —
// pri dlhšom headline v úzkom stĺpci (160×600 skyscraper, malý interscroller
// panel, brand stĺpec v leader_full) reálna výška prerástla cez CTA.
//
// Oprava: všetky tri miesta teraz kreslia cez addTemplateText() — rovnaký
// font-shrink + maxRiadkov mechanizmus, aký už chráni master_safe headline/
// subheadline (aj keď floor 12px pri extrémne dlhom texte a úzkom stĺpci
// nemusí garantovať nulový presah, výrazne to znižuje riziko oproti úplnej
// absencii akejkoľvek poistky).
//
// Test beží skutočné buildery zo zdroja (cez vm), nie ručne skopírovanú
// kópiu vzorca.
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
    remove: function () {
      if (this.parent) {
        const i = this.parent.children.indexOf(this);
        if (i >= 0) this.parent.children.splice(i, 1);
      }
    },
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
    createEllipse: makeNode,
    createFrame: makeNode,
    createText: function () {
      // Rovnaký realistický auto-wrap mock ako v
      // master-safe-legal-text-overflow.test.js: getter namiesto eager
      // výpočtu, aby poradie nastavovania characters/fontSize/resize/
      // textAutoResize (rôzne v addText() vs addTemplateText()) nehralo rolu.
      const node = makeNode();
      let _chars = "", _height = 0, _autoResize = "NONE";
      Object.defineProperty(node, "characters", {
        get() { return _chars; }, set(v) { _chars = v; }
      });
      Object.defineProperty(node, "textAutoResize", {
        get() { return _autoResize; }, set(v) { _autoResize = v; }
      });
      Object.defineProperty(node, "height", {
        get() {
          if (_autoResize === "HEIGHT" && this.fontSize && this.width) {
            const charsPerLine = Math.max(1, Math.floor(this.width / (this.fontSize * 0.55)));
            const lines = Math.max(1, Math.ceil(String(_chars).length / charsPerLine));
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
vm.runInContext(
  source +
    "\nthis.buildSideSafeLayout = buildSideSafeLayout;" +
    "\nthis.buildBrandingLeaderFullLayout = buildBrandingLeaderFullLayout;" +
    "\nthis.buildInterscrollerSafeLayout = buildInterscrollerSafeLayout;",
  context
);

function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

const longHeadline = "Investičné stratégie, ktoré doteraz poznali len tí najbohatší ľudia sveta, sú teraz dostupné aj pre vás vďaka novej mobilnej aplikácii";

function runBuilder(fnName, width, height, opts) {
  const frame = makeNode();
  frame.width = width;
  frame.height = height;
  const format = Object.assign({ width, height }, (opts && opts.format) || {});
  const layout = Object.assign({ show_headline: true, show_logo: false, show_cta: true }, (opts && opts.layout) || {});
  context.__frame = frame;
  context.__format = format;
  context.__layout = layout;
  context.__headline = longHeadline;
  context.__ctaText = "Zistiť viac";
  vm.runInContext(
    fnName + "(__frame, __format, __layout, __headline, __ctaText, null, null);",
    context
  );
  return frame;
}

// 1) buildSideSafeLayout — úzky bočný skyscraper, klasický 160×600.
{
  const frame = runBuilder("buildSideSafeLayout", 160, 600);
  const headline = frame.findOne((n) => n.name === "Headline");
  const cta = frame.findOne((n) => n.name === "CTA button");
  assert(headline && cta, "side_safe 160x600: headline and CTA must both be drawn");
  assert(!overlaps(headline, cta),
    "side_safe 160x600: headline (bottom=" + (headline.y + headline.height) +
    ") nesmie zasahovať do CTA (top=" + cta.y + ")");
}

// 2) buildBrandingLeaderFullLayout — nízky, široký leaderboard s foto+brand
// stĺpcom (typicky low-height wide format).
{
  const frame = runBuilder("buildBrandingLeaderFullLayout", 970, 250);
  const headline = frame.findOne((n) => n.name === "Headline");
  const cta = frame.findOne((n) => n.name === "CTA button");
  assert(headline && cta, "branding_leader_full 970x250: headline and CTA must both be drawn");
  assert(!overlaps(headline, cta),
    "branding_leader_full 970x250: headline (bottom=" + (headline.y + headline.height) +
    ") nesmie zasahovať do CTA (top=" + cta.y + ")");
}

// 3) buildInterscrollerSafeLayout — malý "message card" panel.
{
  const frame = runBuilder("buildInterscrollerSafeLayout", 400, 600);
  const headline = frame.findOne((n) => n.name === "Headline");
  const cta = frame.findOne((n) => n.name === "CTA button");
  assert(headline && cta, "interscroller_safe 400x600: headline and CTA must both be drawn");
  assert(!overlaps(headline, cta),
    "interscroller_safe 400x600: headline (bottom=" + (headline.y + headline.height) +
    ") nesmie zasahovať do CTA (top=" + cta.y + ")");
}

console.log("no-shrink headline/CTA overlap (addText -> addTemplateText): ok");
