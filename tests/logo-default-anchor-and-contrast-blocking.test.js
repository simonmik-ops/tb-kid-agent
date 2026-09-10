// Regresia 10.9.2026 (logo zadanie, úlohy 2 + 5): dve nezávislé opravy v
// jednom teste, obe LEN logo variant/umiestnenie (KV, gradient, typografia,
// CTA text, rozmery formátov sa nemenia):
//
// 1) buildEmailLayout malo logo ukotvené hore vľavo (namerané: Azet e-mail
//    640×500 hneď pod hero fotkou). Tento layoutType nemá vlastnú Surďovu
//    Figmu/PSD predlohu (Plugin_podla_Surdu.md: "Branding a interscroller
//    — bežia, ale ešte nemajú Surďov dizajn") — platí preto potvrdený
//    DEFAULT "logo vpravo dole", nie PSD pravidlo. Presunuté do CTA riadku.
//
// 2) noteLogoFallback() (P0-40 C3/P2-26) zapisovalo len do
//    layout.validation_warnings (súhrnný Validation report kanál) — nie do
//    validateGeneratedFrame()'s "issues" QA vrstvy. Zadanie: "Ak požadovaný
//    variant chýba, QA musí vrátiť blocking error. Nesmie potichu použiť
//    nesprávny variant." qa_logo_contrast_variant_missing premosťuje
//    existujúci mechanizmus do tejto vrstvy (nemení KEDY sa fallback deje,
//    len ho robí viditeľným ako QA issue).
//
// 10.9. REVERT (logo zadanie v3): buildInterscrollerSafeLayout bolo TU
// pôvodne testované rovnako ako email (logo presunuté do CTA riadku), ale
// v3 zadanie nariadilo REVERT interscrolleru na geometriu spred tejto
// zmeny — na úzkych formátoch (JOJ interscroller 300×600/600×960) CTA a
// logo nemajú dosť miesta zdieľať riadok bez toho, aby jeden z nich
// deformovali. Interscroller-špecifické assercie boli preto z tohto súboru
// odstránené (nie zoslabené — testujú SKUTOČNE INÚ, explicitne revertnutú
// geometriu) a nahradené v tests/logo-anchor-revert-v3.test.js, ktorý
// overuje presný návrat na pôvodnú (pred-E) pozíciu. Email v3 zadanie
// nespomína ako regresiu — zostáva nezmenený, testovaný tu ďalej.
//
// Katalógovo riadené (nie natvrdo číslom 54/49) — zoznam formátov sa berie
// priamo z formats.js (role "email", campaign "kid"), takže test prežije
// zmenu katalógu bez úpravy.
//
// "Logo neprekrýva postavu" NIE JE v tomto teste — detekcia subjektu v
// plugine neexistuje. Namiesto toho: logo box nesmie zasahovať do
// STREDNEJ TRETINY rámu (geometricky overiteľná náhrada, keďže KV subjekt
// je podľa zadania takmer vždy v strede).
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const FORMATS = require("../formats.js");

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
      "\nthis.buildEmailLayout = buildEmailLayout;" +
      "\nthis.validateGeneratedFrame = validateGeneratedFrame;",
    context
  );
  return context;
}

function middleThirdOverlap(box, frameW, frameH) {
  const mid = { x: frameW / 3, y: frameH / 3, w: frameW / 3, h: frameH / 3 };
  return box.x < mid.x + mid.w && box.x + box.width > mid.x &&
    box.y < mid.y + mid.h && box.y + box.height > mid.y;
}

function checkCommon(frame, format, ctaText) {
  const logo = frame.findOne((n) => n.name === "Logo");
  const cta = ctaText ? frame.findOne((n) => n.name === "CTA button") : null;
  const ctaLabel = ctaText ? frame.findOne((n) => n.name === "CTA text") : null;
  const headline = frame.findOne((n) => n.name === "Headline");
  assert(logo, format.id + ": logo must be drawn");

  // Logo vnútri frame-u s bezpečným okrajom.
  assert(logo.x >= 0 && logo.y >= 0 && logo.x + logo.width <= format.width && logo.y + logo.height <= format.height,
    format.id + ": logo must stay fully inside the frame, got " + JSON.stringify({ x: logo.x, y: logo.y, w: logo.width, h: logo.height }));

  // Potvrdený default "vpravo dole": logo v pravej polovici, dolnej polovici.
  assert(logo.x + logo.width / 2 > format.width / 2,
    format.id + ": logo must be anchored right of center, got centerX=" + (logo.x + logo.width / 2));
  assert(logo.y + logo.height / 2 > format.height / 2,
    format.id + ": logo must be anchored below center, got centerY=" + (logo.y + logo.height / 2));

  // Náhrada za "neprekrýva postavu" — logo nesmie zasahovať do strednej
  // tretiny rámu (kde podľa zadania takmer vždy sedí subjekt KV).
  assert(!middleThirdOverlap(logo, format.width, format.height),
    format.id + ": logo must not overlap the frame's central third, got " +
    JSON.stringify({ x: logo.x, y: logo.y, w: logo.width, h: logo.height, frameW: format.width, frameH: format.height }));

  if (cta) {
    // 10.9. dodatok (živá regresia): logo môže buď zdieľať CTA riadok
    // (rovnaká základňa) ALEBO dostať vlastný riadok nad CTA — ktoré z
    // dvoch platných usporiadaní nastane závisí od toho, či by zdieľanie
    // zúžilo CTA pod hranicu jedného riadku textu. Oba prípady musia
    // splniť: žiadny prekryv, a CTA label sa NESMIE zmenšiť/zalomiť len
    // preto, že logo zdieľa jeho riadok ("sploštené" tlačidlo).
    assert(!(logo.x < cta.x + cta.width && logo.x + logo.width > cta.x &&
      logo.y < cta.y + cta.height && logo.y + logo.height > cta.y),
      format.id + ": logo must not overlap the CTA button");
    const expectedLabelSize = Math.max(12, Math.round(cta.height * 0.36));
    assert.strictEqual(ctaLabel.fontSize, expectedLabelSize,
      format.id + ": CTA label must render at its full intended size, got fontSize=" + ctaLabel.fontSize +
      " expected=" + expectedLabelSize + " (a smaller size means the button was squeezed to fit the logo)");
  }
  if (headline) {
    assert(!(logo.x < headline.x + headline.width && logo.x + logo.width > headline.x &&
      logo.y < headline.y + headline.height && logo.y + logo.height > headline.y),
      format.id + ": logo must not overlap the headline");
  }
}

const context1 = makeContext();
const context2 = makeContext();
const emailFormats = FORMATS.filter((f) => f.campaign === "kid" && f.role === "email");
assert(emailFormats.length > 0, "catalog must contain at least one email format (test is catalog-driven, not hardcoded)");
for (const format of emailFormats) {
  const frame = makeNode();
  frame.width = format.width; frame.height = format.height;
  const layout = { show_headline: true, show_logo: true, show_cta: true };
  context2.__frame = frame; context2.__format = format; context2.__layout = layout;
  context2.__headline = "Investovanie s Tatra bankou"; context2.__ctaText = "Zistiť viac";
  context2.__figmaImage = null; context2.__figmaLogo = { hash: "fake-logo" };
  vm.runInContext(
    "buildEmailLayout(__frame, __format, __layout, __headline, __ctaText, __figmaImage, __figmaLogo);",
    context2
  );
  checkCommon(frame, format, "Zistiť viac");
}

// ── QA blocking error, not a silent wrong-contrast fallback ─────────────
function runQa(hasFallbackWarning) {
  const frame = makeNode();
  frame.width = 300; frame.height = 600; frame.clipsContent = true;
  const layout = {
    validation_warnings: hasFallbackWarning ? ["logo_variant_fallback_white_missing_on_dark_surface"] : []
  };
  const content = { headline: null, subheadline: null, ctaText: null, legalText: null, badgeText: null, hasLogo: false };
  context1.__frame = frame; context1.__format = { width: 300, height: 600 };
  context1.__layout = layout; context1.__content = content;
  return vm.runInContext(
    "validateGeneratedFrame(__frame, __format, __layout, \"side_safe\", __content, null);",
    context1
  );
}
const blockedQa = runQa(true);
assert(blockedQa.issues.includes("qa_logo_contrast_variant_missing"),
  "a recorded logo_variant_fallback_* warning must surface as a blocking qa_logo_contrast_variant_missing issue, got " +
  JSON.stringify(blockedQa.issues));
const cleanQa = runQa(false);
assert(!cleanQa.issues.includes("qa_logo_contrast_variant_missing"),
  "without any fallback warning, qa_logo_contrast_variant_missing must not fire, got " + JSON.stringify(cleanQa.issues));

console.log("email logo default anchor (vpravo dole) + QA contrast-variant blocking (logo zadanie, úlohy 2+5): ok " +
  "(" + emailFormats.length + " email formats, catalog-driven)");
