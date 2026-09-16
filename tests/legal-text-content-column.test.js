// P1-15 (14.9.) — Legal text sa na WIDE formátoch kotvil na RÁM, kým
// headline/subheadline/CTA/AI tag sledovali OBSAHOVÝ STĹPEC.
//
// Namerané na živom výstupe (L6yFpLkKcHe9flUk3i11T1, Google Demand gen
// 1200×628, canvas 129:15860): headline, subheadline, CTA aj AI tag sedia na
// x = 648 (šírka 321), ale legal text na x = 48, šírka 1104 — teda cez celý
// rám pod fotkou, ~600 px od zvyšku textového bloku.
//
// Príčina (plugin/code.js, generický legal blok na konci buildMasterSafeLayout):
//     legalW = cb.w - pad * 2;   kotva [cb.x + pad, ...]
// Na square a portrait sa textový stĺpec ZAČÍNA na cb.x + pad, takže je to to
// isté číslo a nikto si toho nevšimol. Na wide vetve je stĺpec
//     textX = max(cb.x + pad, round(format.width * 0.54))
// čiže úplne inde. Pre Metu to riešil drawMetaLegal(), ale isMetaWide aj
// isMetaPortrait končia early returnom — takže Google, Adform a každý ďalší
// wide master_safe formát išiel starou cestou.
//
// Nález NEZÁVISÍ od SHA: generický blok je rovnaký na master aj na stav-11-9.
//
// Test beží skutočný buildMasterSafeLayout() zo zdroja (cez vm).
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
    createText: function () {
      // Simuluje Figma auto-wrap: keď je textAutoResize=HEIGHT, výška sa
      // dopočíta z počtu riadkov (šírka boxu / fontSize určuje znakov na
      // riadok) — dosť realisticky na to, aby dlhší legal text v úzkom
      // (276px) boxe pri fontSize 12 reálne potreboval 2 riadky, presne
      // ako na živom výstupe. Getter/setter namiesto eager výpočtu, lebo
      // measureWrappedHeight() nastavuje characters/fontSize/resize/
      // textAutoResize v inom poradí, než by eager-setter na "characters"
      // stihol zachytiť.
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
vm.runInContext(source + "\nthis.buildMasterSafeLayout = buildMasterSafeLayout;", context);

function runMasterSafe(width, height, opts) {
  opts = opts || {};
  const frame = makeNode();
  frame.width = width;
  frame.height = height;
  const format = { width: width, height: height };
  const layout = { show_headline: true, show_logo: true, show_cta: true, show_legal: true, show_subheadline: true };
  const content = Object.assign({
    headline: "Investovanie, ktoré dáva zmysel", subheadline: "Začnite už od 20 eur mesačne",
    ctaText: "Zistiť viac", legalText: null, badgeText: null, aiGenerated: false
  }, opts);
  context.__frame = frame;
  context.__format = format;
  context.__layout = layout;
  context.__content = content;
  context.__figmaImage = { hash: "fake-image" };
  context.__figmaLogo = { hash: "fake-logo" };
  vm.runInContext(
    "buildMasterSafeLayout(__frame, __format, __layout, __content, __figmaImage, {width:1000,height:1000}, __figmaLogo, {x:0,y:0,w:__format.width,h:__format.height});",
    context
  );
  return frame;
}

const legalText = "Marketingové oznámenie. S investovaním sú spojené riziká.";

// ── Wide (non-Meta): legal musí začínať v tom istom stĺpci ako headline ────
for (const dims of [[1200, 628], [1280, 720], [1200, 400]]) {
  const w = dims[0], h = dims[1];
  const frame = runMasterSafe(w, h, { legalText: legalText });
  const headline = frame.findOne(function (n) { return n.name === "Headline"; });
  const legal = frame.findOne(function (n) { return n.name === "Legal text"; });
  assert(headline, w + "x" + h + ": headline must be drawn");
  assert(legal, w + "x" + h + ": legal text must be drawn");
  assert.strictEqual(
    legal.x, headline.x,
    w + "x" + h + " (wide): legal text (x=" + legal.x + ") sa musí kotviť na ten istý " +
    "obsahový stĺpec ako headline (x=" + headline.x + "), nie na ľavý okraj rámu"
  );
  assert(
    legal.x + legal.width <= w,
    w + "x" + h + " (wide): legal text nesmie pretiecť cez pravý okraj rámu"
  );
}

// ── Square a portrait: správanie sa NESMIE zmeniť (stĺpec == cb.x + pad) ───
for (const dims of [[1200, 1200], [320, 480]]) {
  const w = dims[0], h = dims[1];
  const frame = runMasterSafe(w, h, { legalText: legalText });
  const headline = frame.findOne(function (n) { return n.name === "Headline"; });
  const legal = frame.findOne(function (n) { return n.name === "Legal text"; });
  assert(headline && legal, w + "x" + h + ": headline aj legal musia byť nakreslené");
  assert.strictEqual(
    legal.x, headline.x,
    w + "x" + h + " (square/portrait): legal a headline zdieľajú stĺpec aj naďalej " +
    "(legal x=" + legal.x + ", headline x=" + headline.x + ")"
  );
}

console.log("P1-15 legal text content column: ok");
