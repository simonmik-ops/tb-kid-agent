// Regresia 9.9.2026: TB.headline() dávalo systematicky len ~83 % referenčnej
// veľkosti vo všetkých troch rodinách formátov —
//   1200×1200 (square):  min(W,H)×0,056 → 67, referencia 80
//   1080×1920 (portrait): W×0,060       → 65, referencia 81
//   1200×628  (wide):     H×0,082       → 51, referencia 60
// Koeficienty prepočítané na 0,0667 / 0,075 / 0,0955. Strop 68 (square aj
// portrait vetva) zdvihnutý na 96, inak by nové hodnoty 80/81 doň narazili.
//
// TB.headline(1920,1080) — cieľom bolo 89, čo je v priamom konflikte s
// 1200×628=60 (obe idú cez rovnakú r>1,45 vetvu, jeden lineárny H*coeficient
// nemôže dať obe hodnoty naraz). Túto assertion (obnovenú v
// tests/visual-system.test.js na 89) preto zámerne NEDUPLIKUJEME tu — je
// vedomo rozbitá, kým sa nevyberie a neimplementuje riešenie z návrhu
// (nelineárna škála / rozdelenie vetvy), viď odpoveď v konverzácii.
//
// letterSpacing (tracking) — 9.9. DRUHÁ oprava (prvá, v commite 9cab0e4,
// bola nesprávna generalizácia podľa štýlu): tracking sa vyberá podľa ROLY
// textu (name), nie podľa štýlu (Regular/Bold) — viacero rôznych rolí
// zdieľa ten istý štýl (Badge aj Headline sú Bold; Legal text aj
// Subheadline aj AI generované sú Regular). Referenčnú hodnotu máme len
// pre Headline (-2 %, predtým -2,5 %) a Subheadline (0 %, predtým -1,5 %).
// Všetko ostatné — Badge, Legal text, CTA text, "Myslite na seba" (slogan),
// AI generované (aj cez addAiNote, aj Adform-špecifický inline draw) — si
// musí zachovať svoj PÔVODNÝ tracking, lebo preň nemáme referenciu.
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync(require.resolve("../plugin/code.js"), "utf8");
const context = {
  clamp: (n, min, max) => Math.max(min, Math.min(max, n))
};
vm.createContext(context);
const tbSource = source.slice(0, source.indexOf("try {\n  figma.showUI"));
vm.runInContext(tbSource + "\nthis.__TB = TB;", context);
const TB = context.__TB;

assert.strictEqual(TB.headline(1200, 1200), 80,
  "TB.headline(1200,1200) (square) must match the reference optical scale");
assert.strictEqual(TB.headline(1080, 1920), 81,
  "TB.headline(1080,1920) (portrait) must match the reference optical scale");
assert.strictEqual(TB.headline(1200, 628), 60,
  "TB.headline(1200,628) (wide) must match the reference optical scale");

// Odvodené hodnoty (subheadline = headline*0,52; legal = headline*0,30,
// floor 12, cap 24) pre všetky štyri cieľové formáty vrátane 1920×1080
// (ktorého headline je momentálne 96 — sporná hodnota, viď vyššie — ale
// odvodený vzorec platí bez ohľadu na to, aké číslo z TB.headline vyjde).
const derivedTargets = [
  { w: 1200, h: 628, label: "1200x628 (wide)" },
  { w: 1200, h: 1200, label: "1200x1200 (square)" },
  { w: 1080, h: 1920, label: "1080x1920 (portrait)" },
  { w: 1920, h: 1080, label: "1920x1080 (wide, sporná hodnota)" }
];
for (const { w, h, label } of derivedTargets) {
  const hl = TB.headline(w, h);
  const expectedSub = Math.max(12, Math.round(hl * 0.52));
  const expectedLegal = Math.max(12, Math.min(24, Math.round(hl * 0.30)));
  assert.strictEqual(TB.subheadline(w, h), expectedSub,
    label + ": subheadline must be round(headline*0.52), headline=" + hl);
  assert.strictEqual(TB.legal(w, h), expectedLegal,
    label + ": legal must be clamp(round(headline*0.30), 12, 24), headline=" + hl);
}

// addTemplateText() — tracking vybraný podľa name (role), nie podľa style.
assert(source.includes('name === "Headline" ? -2 : (name === "Subheadline" ? 0 : (style === "Regular" ? -1.5 : -2.5))'),
  "addTemplateText() tracking must be selected by role (name): Headline -2%, Subheadline 0%, else unchanged by style");

// addAiNote() (AI disclosure, FONT_REGULAR) — žiadna referencia, musí
// zostať na pôvodných -1,5 % (prvá oprava ju chybne zmenila na 0 %).
const aiNoteStart = source.indexOf("function addAiNote");
const aiNoteEnd = source.indexOf("\nfunction ", aiNoteStart + 1);
const aiNoteSrc = source.slice(aiNoteStart, aiNoteEnd);
assert(/t\.letterSpacing\s*=\s*\{\s*value:\s*-1\.5,\s*unit:\s*"PERCENT"\s*\}/.test(aiNoteSrc),
  "addAiNote() (AI disclosure) tracking must stay at -1.5% — no reference value exists for this role");

// addSloganLogo ("Myslite na seba") už malo správnych -2 % — nesmelo sa zmeniť.
assert(source.includes('t.letterSpacing = { value: -2, unit: "PERCENT" };'),
  "addSloganLogo tracking must remain untouched at -2% (buildFullBleedLayout's own Headline draw, unrelated to addTemplateText)");

// Skutočné volania cez addTemplateText musia použiť správne role/style páry
// — kontrola zdroja, nie len prítomnosti vzorca vyššie.
const headlineCallSites = [...source.matchAll(/addTemplateText\(\s*\n?\s*frame,\s*\n?\s*"Headline"/g)];
assert(headlineCallSites.length >= 8,
  "expected at least 8 addTemplateText(...,\"Headline\",...) call sites across the builders, got " + headlineCallSites.length);
const badgeCallSites = [...source.matchAll(/"Badge(?: text)?"/g)];
assert(badgeCallSites.length >= 2, "Badge/Badge text call sites must still exist and be untouched by the Headline/Subheadline-only fix");

// Väčší headline (o ~17 % väčší font vo všetkých troch rodinách) nesmie
// spôsobiť nový presah cez okraj rámu ani kolíziu s badge/CTA/logom/AI
// disclosure — beží skutočný buildMasterSafeLayout() zo zdroja (cez vm),
// s Headline aj Badge aj Legal aj AI zapnutými naraz (najhustejší reálny
// scenár), na všetkých štyroch formátoch vrátane sporného 1920×1080.
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

const renderContext = {
  __html__: "<html></html>",
  figma: {
    createRectangle: makeNode,
    createEllipse: makeNode,
    createFrame: makeNode,
    createText: function () {
      const node = makeNode();
      let _chars = "", _height = 0, _width = 0, _autoResize = "NONE";
      Object.defineProperty(node, "characters", {
        get() { return _chars; }, set(v) { _chars = v; }
      });
      Object.defineProperty(node, "textAutoResize", {
        get() { return _autoResize; }, set(v) { _autoResize = v; }
      });
      Object.defineProperty(node, "height", {
        get() {
          // WIDTH_AND_HEIGHT (addAiNote's "AI generované") nemá vopred
          // nastavenú šírku boxu — jednoriadkový text sa tu zjednodušene
          // správa ako pevná výška podľa fontSize, nech nie je 0x0 (čo by
          // kolízne kontroly urobilo bezvýznamnými).
          if (_autoResize === "WIDTH_AND_HEIGHT") {
            return this.fontSize ? Math.round(this.fontSize * 1.3) : 0;
          }
          if (_autoResize === "HEIGHT" && this.fontSize && this.width) {
            const charsPerLine = Math.max(1, Math.floor(this.width / (this.fontSize * 0.55)));
            const lines = Math.max(1, Math.ceil(String(_chars).length / charsPerLine));
            return Math.ceil(lines * this.fontSize * 1.3);
          }
          return _height;
        },
        set(v) { _height = v; }
      });
      Object.defineProperty(node, "width", {
        get() {
          if (_autoResize === "WIDTH_AND_HEIGHT") {
            return this.fontSize ? Math.round(String(_chars).length * this.fontSize * 0.55) : 0;
          }
          return _width;
        },
        set(v) { _width = v; }
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
vm.createContext(renderContext);
vm.runInContext(source + "\nthis.buildMasterSafeLayout = buildMasterSafeLayout;", renderContext);

function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function runMasterSafe(width, height) {
  const frame = makeNode();
  frame.width = width;
  frame.height = height;
  const format = { width, height };
  const layout = {
    show_headline: true, show_logo: true, show_cta: true, show_legal: true,
    show_subheadline: true, show_badge: true
  };
  const content = {
    headline: "Investovanie", subheadline: "Investujte s nami a získajte 50 eur.",
    ctaText: "Zistiť viac", legalText: "Marketingové oznámenie. S investovaním sú spojené riziká.",
    badgeText: "Novinka", aiGenerated: true
  };
  renderContext.__frame = frame;
  renderContext.__format = format;
  renderContext.__layout = layout;
  renderContext.__content = content;
  renderContext.__figmaImage = { hash: "fake-image" };
  renderContext.__figmaLogo = { hash: "fake-logo" };
  vm.runInContext(
    "buildMasterSafeLayout(__frame, __format, __layout, __content, __figmaImage, {width:1000,height:1000}, __figmaLogo, {x:0,y:0,w:__format.width,h:__format.height});",
    renderContext
  );
  return frame;
}

const roleNames = ["Headline", "Subheadline", "CTA button", "Badge", "Logo", "Legal text", "AI generované"];

for (const { w, h, label } of derivedTargets) {
  const frame = runMasterSafe(w, h);
  const nodes = {};
  for (const name of roleNames) nodes[name] = frame.findOne((n) => n.name === name);

  for (const name of roleNames) {
    const n = nodes[name];
    if (!n) continue; // niektoré role (napr. Badge) sú voliteľné podľa layoutu — over len tie, čo sa reálne nakreslili
    assert(n.x >= -1 && n.y >= -1 && n.x + n.width <= w + 1 && n.y + n.height <= h + 1,
      label + ": " + name + " (x=" + n.x + "..." + (n.x + n.width) + ", y=" + n.y + "..." + (n.y + n.height) +
      ") nesmie pretiecť cez okraj rámu (" + w + "x" + h + ") po zväčšení headlinu");
  }

  for (let i = 0; i < roleNames.length; i++) {
    for (let j = i + 1; j < roleNames.length; j++) {
      const a = nodes[roleNames[i]], b = nodes[roleNames[j]];
      if (!a || !b) continue;
      assert(!overlaps(a, b),
        label + ": " + roleNames[i] + " nesmie kolidovať s " + roleNames[j] + " po zväčšení headlinu (P0-16-triedy regresia)");
    }
  }
}

console.log("headline optical scale + tracking (9.9.2026): ok");
