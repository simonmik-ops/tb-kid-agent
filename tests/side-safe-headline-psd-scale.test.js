// 14.9. — headline na `branding_side` bol JEDEN riadok a panel mal preto
// v strede dieru (namerané na sade zo `stav-11-9`, Figma 218:25352 a
// 218:25381): panel 310..600 = 290 px, headline box 14 px, CTA až na 511 →
// ~177 px prázdneho panelu.
//
// Príčina: výška panelu je pomer 0,483 prevzatý z
// ADFORM_PSD_RULES.adform_160x600.panel (290/600), ale typografia sa z tej
// istej PSD predlohy neprevzala — zostal vzorec riadený šírkou OBSAHOVÉHO
// boxu s podlahou 13 px: clamp(contentW * 0,12, 13, 24) → na 160×600 = 14.
//
// PSD pre ten istý rám hovorí: headline [12, 316, 136, 54], headlineSize 22.
// Teda 22 px v boxe na DVA riadky. 22 / 160 = 0,1375 × format.width.
//
// Tento test pripína kotvu na PSD hodnotu, nech sa nedá potichu zmeniť späť
// na vzorec, ktorý s ňou nesúvisí.
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

vm.runInContext(
  "this.buildSideSafeLayout = buildSideSafeLayout;" +
  "\nthis.__rules = (typeof ADFORM_PSD_RULES !== 'undefined') ? ADFORM_PSD_RULES : null;",
  context
);

function sideHeadline(width, height, safeInnerW) {
  const frame = makeNode();
  frame.width = width;
  frame.height = height;
  const format = {
    width: width, height: height,
    safeZones: { safeInner: { width: safeInnerW, height: height } }
  };
  const layout = { show_headline: true, show_logo: false, show_cta: true, show_ai_disclosure: true };
  context.__frame = frame;
  context.__format = format;
  context.__layout = layout;
  vm.runInContext(
    'buildSideSafeLayout(__frame, __format, __layout, "Investovanie", "Zistiť viac", null, null);',
    context
  );
  const h = frame.findOne(function (n) { return n.name === "Headline"; });
  assert(h, width + "x" + height + ": headline must be drawn");
  return h;
}

// ── Kotva: 160×600 musí vychádzať z PSD headlineSize, nie z contentW ──────
const h160 = sideHeadline(160, 600, 120);
assert.strictEqual(
  h160.fontSize, 24,
  "160×600 branding_side: headline musí vychádzať z ADFORM_PSD_RULES." +
  "adform_160x600.headlineSize (24), nie zo vzorca podľa contentW — got " + h160.fontSize
);

// A nech tá hodnota nie je len prepísaná konštanta: musí sa zhodovať s tým,
// čo naozaj stojí v ADFORM_PSD_RULES pre ten istý rám.
if (context.__rules && context.__rules.adform_160x600) {
  assert.strictEqual(
    h160.fontSize, context.__rules.adform_160x600.headlineSize,
    "kotva sa musí zhodovať s PSD pravidlom pre adform_160x600"
  );
}

// ── Nesmie to spadnúť späť na starú podlahu 13–14 px ──────────────────────
for (const dims of [[120, 600, 120], [200, 700, 120], [450, 800, 160]]) {
  const w = dims[0], h = dims[1], si = dims[2];
  const node = sideHeadline(w, h, si);
  const stary = Math.round(Math.max(13, Math.min(24, si * 0.12)));
  assert(
    node.fontSize > stary,
    w + "×" + h + " branding_side: headline (" + node.fontSize + " px) musí byť väčší " +
    "než stará hodnota riadená šírkou obsahového boxu (" + stary + " px)"
  );
  assert(
    node.fontSize <= 34,
    w + "×" + h + ": headline nesmie prekročiť strop 34 px (pre širšie formáty " +
    "rodiny nemáme meranú referenciu) — got " + node.fontSize
  );
}

console.log("side_safe headline PSD scale: ok");
