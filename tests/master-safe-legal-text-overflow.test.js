// Regresia 9.9.2026: buildMasterSafeLayout kreslilo "Legal text" s pevnou
// odhadovanou výškou pre JEDEN riadok (TB.legal(W,H) * 1,6), ale Y sa z
// tejto výšky počítal ako kotva ZHORA. Pri viacriadkovom legal texte (bežný
// prípad — napr. "Marketingové oznámenie. S investovaním sú spojené
// riziká." na úzkych formátoch sa vždy zalomí na 2 riadky) box narástol
// nadol od tej istej podhodnotenej pozície a presiahol cez spodný okraj
// rámu. Namerané na živom výstupe (L6yFpLkKcHe9flUk3i11T1, topky.sk
// 320×480): legal text y=455, skutočná výška 26 → koniec 481 v 480px
// vysokom ráme (1px cez hranicu rámu, spodný padding celkom zožraný).
//
// Tento test beží skutočný buildMasterSafeLayout() zo zdroja (cez vm),
// nie ručne skopírovanú kópiu vzorca.
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
    headline: "fffff", subheadline: null, ctaText: "Zistiť viac",
    legalText: null, badgeText: null, aiGenerated: false
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
const legalFrame = runMasterSafe(320, 480, { legalText: legalText });
const legal = legalFrame.findOne((n) => n.name === "Legal text");
assert(legal, "320x480: legal text must be drawn");
assert(legal.height > 20,
  "kontrola predpokladu: legal text pri tomto texte/šírke sa musí zalomiť na viac než 1 riadok (výška > 20), got " + legal.height);
const legalBottom = legal.y + legal.height;
assert(legalBottom <= 480,
  "320x480: legal text (bottom=" + legalBottom + ") nesmie presiahnuť cez spodný okraj rámu (480)");
assert(480 - legalBottom >= 3,
  "320x480: legal text musí mať aspoň minimálny spodný padding (>=3px), got " + (480 - legalBottom));

// Regresia 9.9.2026 (nájdené pri vizuálnej kontrole živého výstupu, topky.sk
// 320×480 aj Vinted 300×250): Logo sedí v tom istom spodnom páse ako legal
// text (obe kotvené na cb.y+cb.h) — legal text na plnú šírku ho prekrýval
// (namerané: "riziká." pod "TATRA BANKA" logom, 10px zvislo + 52px
// vodorovne). runMasterSafe() vyššie už logo kreslí (figmaLogo je nastavené,
// show_logo: true) — táto kontrola len pridáva explicitné overenie, že sa
// s legal textom neprekrýva.
const legalLogo = legalFrame.findOne((n) => n.name === "Logo");
assert(legalLogo, "320x480: logo must be drawn");
assert(!overlaps(legal, legalLogo),
  "320x480: legal text (x=" + legal.x + ".." + (legal.x + legal.width) + ", y=" + legal.y + ".." + legalBottom +
  ") nesmie zasahovať do loga (x=" + legalLogo.x + ".." + (legalLogo.x + legalLogo.width) +
  ", y=" + legalLogo.y + ".." + (legalLogo.y + legalLogo.height) + ")");

// Regresia 9.9.2026 (rovnaká trieda ako legal text vyššie): subheadlineBoxH/
// subH boli pevné odhady (1,25x / 1,6x fontSize) v "portrait/square" aj
// "wide" vetve buildMasterSafeLayout — pri dlhšom podnadpise (bežná celá
// veta), čo sa zalomí na viac riadkov než odhad predpokladal, box narastal
// NADOL smerom k už pevne danému CTA tlačidlu pod ním.
//
// Formáty zvolené zámerne tak, že TB.subheadline(W,H) tam už sedí na
// spodnej hranici (12px floor, žiadny priestor na ďalšie zmenšenie
// fontu) — presne rovnaká podmienka ako pri "Legal text" vyššie. Pri
// väčších subheadlineSize (napr. 1200×628/1200×1200, kde font má rezervu
// 27–35px zhora) interný zmenšovací cyklus addTemplateText() (maxRiadkov)
// sám osebe zmenší font tak, aby sa zmestil do PÔVODNÉHO (nesprávneho)
// odhadu — bez viditeľného rozdielu oproti oprave. Overené priamo (dočasný
// revert oboch vetiev + porovnanie): 1200×628/1200×1200 dávajú identický
// výsledok pred aj po oprave, 320×480/970×250 (font už na floor 12px,
// nemá kam ďalej zmenšiť) reálne kolidujú pred opravou.
const longSubheadline = "S Investičnými stratégiami TB môžete investovať ako najbohatší ľudia sveta";

function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

for (const [w, h, familyLabel] of [[320, 480, "portrait"], [970, 250, "wide"]]) {
  const frame = runMasterSafe(w, h, { subheadline: longSubheadline });
  const sub = frame.findOne((n) => n.name === "Subheadline");
  const cta = frame.findOne((n) => n.name === "CTA button");
  assert(sub && cta, familyLabel + " " + w + "x" + h + ": subheadline and CTA must both be drawn");
  assert(sub.height > 20,
    familyLabel + " " + w + "x" + h + ": kontrola predpokladu — dlhý podnadpis pri floor-font (12px) sa musí zalomiť na viac riadkov, got height=" + sub.height);
  assert(!overlaps(sub, cta),
    familyLabel + " " + w + "x" + h + ": subheadline (bottom=" + (sub.y + sub.height) + ") nesmie zasahovať do CTA (top=" + cta.y + ")");
}

console.log("master_safe legal text overflow (P0-16f): ok");
