// Zadanie 26.8, blok D: buildEmailLayout() v plugin/code.js počítalo textY
// (headline) z rovnakého kotviaceho bodu ako logo (heroH + pad), bez ohľadu
// na výšku loga. Pri CTA (malá pevná medzera pad*0.4) sa headline vysunul
// POD spodnú hranu loga — potvrdené na živom výstupe (azet 640×500: logo
// y=315..366, headline y=333 — 33px prekryv). Tento test beží reálny
// buildEmailLayout() zo zdroja (cez vm, s minimálnym figma mockom), nie
// ručne skopírovanú kópiu vzorca — zamyká skutočný commitnutý kód.
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
    createRectangle: makeNode,
    createText: makeNode,
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
vm.runInContext(source + "\nthis.buildEmailLayout = buildEmailLayout;", context);

function runEmailLayout(width, height, opts) {
  const frame = makeNode();
  frame.width = width;
  frame.height = height;
  const layout = Object.assign({ show_headline: true, show_logo: true, show_cta: true }, opts || {});
  const figmaImage = { hash: "fake-image" };
  const figmaLogo = { hash: "fake-logo" };
  context.__frame = frame;
  context.__format = { width: width, height: height };
  context.__layout = layout;
  context.__figmaImage = figmaImage;
  context.__figmaLogo = figmaLogo;
  vm.runInContext(
    'buildEmailLayout(__frame, __format, __layout, "Headline text", "CTA text", __figmaImage, __figmaLogo);',
    context
  );
  const logo = frame.findOne((n) => n.name === "Logo");
  const headline = frame.findOne((n) => n.name === "Headline");
  const cta = frame.findOne((n) => n.name === "CTA button");
  return { logo: logo, headline: headline, cta: cta };
}

// 14.9. — tento blok bol zastaraný a NIKDY nebežal: `npm test` reťazil súbory
// cez `&&` a padal už na siedmom (visual-system), takže tento (jedenásty) sa
// nespustil ani raz. Pôvodne tvrdil „headline musí začínať POD spodkom loga",
// čo platilo, kým logo sedelo hore vľavo pod hero fotkou. Zadanie z 10. 9.
// (logo, úloha 5) logo presunulo DOLE VPRAVO do CTA riadku — odvtedy headline
// správne sedí NAD logom a assert padal na geometrii, ktorá je zámerná
// (namerané azet 640×500: headline y=333, logo 400..455).
// Kontroluje sa preto to, čo assert naozaj chránil — že sa headline a logo
// neprekrývajú — a nie poradie, ktoré medzitým prestalo platiť.
for (const dims of [[640, 500, "azet_dm"], [730, 1000, "modrykonik_email"], [500, 800, "nmh_dm"]]) {
  const [w, h, id] = dims;
  const { logo, headline } = runEmailLayout(w, h);
  assert(logo && headline, id + ": logo and headline must both be drawn");
  const prekryvY = headline.y < logo.y + logo.height && headline.y + headline.height > logo.y;
  const prekryvX = headline.x < logo.x + logo.width && headline.x + headline.width > logo.x;
  assert(!(prekryvY && prekryvX),
    id + " (" + w + "×" + h + "): headline [" + headline.x + "," + headline.y + "," +
    headline.width + "×" + headline.height + "] must not overlap the logo [" +
    logo.x + "," + logo.y + "," + logo.width + "×" + logo.height + "]");
}

// Bez loga sa spravanie nesmie zmenit (rovnaky kotviaci bod ako predtym).
const noLogo = runEmailLayout(640, 500, { show_logo: false });
assert(!noLogo.logo, "no logo expected when show_logo is false");
assert.strictEqual(noLogo.headline.y, 270 + 45 + Math.round(45 * 0.4),
  "headline position without a logo must be unchanged (heroH + pad + gap)");

// Regresia 9.9.2026, P2-31: na azet 640×500 (logo AJ CTA prítomné) sa
// headline box (predošlý tvrdý floor 20px) natiahol 5px DO CTA tlačidla —
// potvrdené na živom výstupe. Ziadna Surdova referencia/PSD pre e-mailové
// formáty neexistuje (overené) — toto je preto vlastné rozhodnutie (font
// sa zmenší, aby sa zmestil do skutočne dostupného priestoru, floor 12px
// podľa P2-4), nie hodnota z referencie. Test overuje mechanizmus: headline
// nesmie NIKDY zasahovať do CTA, na žiadnom z troch reálnych formátov.
for (const dims of [[640, 500, "azet_dm"], [730, 1000, "modrykonik_email"], [500, 800, "nmh_dm"]]) {
  const [w, h, id] = dims;
  const { headline, cta } = runEmailLayout(w, h);
  assert(headline && cta, id + ": headline and CTA must both be drawn");
  const headlineBottom = headline.y + headline.height;
  assert(headlineBottom <= cta.y,
    id + " (" + w + "×" + h + "): headline bottom (y=" + headlineBottom + ") must not reach into CTA (y=" + cta.y + ")");
  assert(headline.fontSize >= 12,
    id + ": headline font must never shrink below the 12px floor (P2-4), got " + headline.fontSize);
}

console.log("email layout logo/headline geometry: ok");
