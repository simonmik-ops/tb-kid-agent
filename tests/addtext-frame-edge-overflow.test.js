// Regresia 9.9.2026 (rovnaká trieda ako tests/no-shrink-headline-cta-overlap.test.js
// a tests/master-safe-legal-text-overflow.test.js): buildHeadlineOnlyLayout,
// buildNativeCenterLayout a buildStripLayout kreslili headline priamo cez
// addText() / ručne cez figma.createText() bez akéhokoľvek font-shrink
// mechanizmu. Na rozdiel od side_safe/interscroller_safe/branding_leader_full
// (kde headline rástol do CTA tlačidla) tu nie je žiadny ďalší prvok pod
// headlineom — riziko je preto pretečenie cez spodný okraj vlastného
// "bezpečného" priestoru (scrim obdĺžnik pri headline_only, spodný okraj
// frame-u pri native_center a strip banneroch typu 728×90/970×250).
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
    "\nthis.buildHeadlineOnlyLayout = buildHeadlineOnlyLayout;" +
    "\nthis.buildNativeCenterLayout = buildNativeCenterLayout;" +
    "\nthis.buildStripLayout = buildStripLayout;",
  context
);

const longHeadline = "Investičné stratégie, ktoré doteraz poznali len tí najbohatší ľudia sveta, sú teraz dostupné aj pre vás vďaka novej mobilnej aplikácii";
// Kratší, realistický headline pre strip banner (728×90) — 53 znakov je
// bežná dĺžka pre leaderboard reklamu, nie umelo naťahovaný extrém. Pri tejto
// dĺžke starý kód (pevný fontSize 18, žiadny shrink) reálne pretiekol o 16px
// (106 vs. 90), zatiaľ čo nový kód (addTemplateText shrink na ~14px) sa
// pohodlne zmestí. Výrazne dlhší text (70+ znakov) by narazil na 12px floor
// aj po oprave — fyzicky sa 2 riadky ani pri najmenšom povolenom fonte
// nezmestia do 20px dostupnej výšky na formáte vysokom len 90px; to je
// inherentné obmedzenie floor-u (rovnaká výhrada ako pri master_safe
// legal texte), nie chyba tejto opravy.
const stripHeadline = "Investičné poradenstvo, ktoré si môžete dovoliť aj vy";

function runBuilder(fnName, width, height, headline, extraArgsSrc) {
  const frame = makeNode();
  frame.width = width;
  frame.height = height;
  const format = { width, height };
  const layout = { show_headline: true, show_logo: false, show_cta: false };
  context.__frame = frame;
  context.__format = format;
  context.__layout = layout;
  context.__headline = headline;
  vm.runInContext(
    fnName + "(__frame, __format, __layout, __headline" + (extraArgsSrc || "") + ");",
    context
  );
  return frame;
}

// 1) buildHeadlineOnlyLayout — headline nesmie pretiecť cez spodný okraj
// vlastného "Headline scrim" podkladu (za ním je holá fotka).
{
  const frame = runBuilder("buildHeadlineOnlyLayout", 1080, 1080, longHeadline, ", null");
  const headline = frame.findOne((n) => n.name === "Headline");
  const scrim = frame.findOne((n) => n.name === "Headline scrim");
  assert(headline && scrim, "headline_only 1080x1080: headline and scrim must both be drawn");
  const headlineBottom = headline.y + headline.height;
  const scrimBottom = scrim.y + scrim.height;
  assert(headlineBottom <= scrimBottom,
    "headline_only 1080x1080: headline (bottom=" + headlineBottom +
    ") nesmie pretiecť cez spodný okraj scrimu (bottom=" + scrimBottom + ")");
}

// 2) buildNativeCenterLayout — headline pod obrázkom nesmie pretiecť cez
// spodný okraj frame-u. 600×400 (nízky native placement, 70% obrázok)
// necháva pod obrázkom len ~96px — starý pevný font (33px, bez shrink)
// tam s dlhým headlineom pretiekol o 119px.
{
  const frame = runBuilder("buildNativeCenterLayout", 600, 400, longHeadline, ", null");
  const headline = frame.findOne((n) => n.name === "Headline" || n.characters === longHeadline);
  assert(headline, "native_center 600x400: headline must be drawn");
  const headlineBottom = headline.y + headline.height;
  assert(headlineBottom <= 400,
    "native_center 600x400: headline (bottom=" + headlineBottom + ") nesmie pretiecť cez spodný okraj frame-u (400)");
}

// 3) buildStripLayout — nízky "strip" banner (728×90 leaderboard), headline
// pod logom nesmie pretiecť cez spodný okraj frame-u.
{
  const frame = runBuilder("buildStripLayout", 728, 90, stripHeadline, ", null, null");
  const headline = frame.findOne((n) => n.name === "Headline" || n.characters === stripHeadline);
  assert(headline, "strip 728x90: headline must be drawn");
  const headlineBottom = headline.y + headline.height;
  assert(headlineBottom <= 90,
    "strip 728x90: headline (bottom=" + headlineBottom + ") nesmie pretiecť cez spodný okraj frame-u (90)");
}

console.log("addText frame-edge overflow (headline_only/native_center/strip): ok");
