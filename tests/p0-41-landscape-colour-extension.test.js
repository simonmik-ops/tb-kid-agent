// Regresia 10.9.2026 (P0-41): pre landscape/wide formáty mimo master_safe
// neexistoval žiadny colour-extension mechanizmus — tri z piatich nahlásených
// formátov (1200×400 All websites, 600×400 Engerio, 1200×628 Google RSA/
// Responsive) mali reálnu, structural medzeru (biela plocha alebo tvrdý,
// nezmiešaný švík medzi fotkou a kampaňovou farbou), každá vo svojom builderi:
//
//   - buildBrandingLeaderFullLayout (1200×400 Ringier leaderboard):
//     frame.fills už campaignSurface pokrýval celý rám, ale fotka končila
//     tvrdo presne na photoW bez akéhokoľvek zmiešania — presne "prechody sú
//     tvrdé preto, že fotka končí skôr, než ju stihne čokoľvek prekryť"
//     (REFERENCIA_Surdo_hodnoty_18_8.md, kap. 3).
//   - buildNativeCenterLayout (600×400 Engerio native, "Bez loga a textu"):
//     obrázok mal pad zo všetkých strán + 30 % výšky voľné dole, do ktorého
//     sa (native_clean profil má headline:false) nič nekreslilo — skutočná
//     biela plocha.
//   - buildCleanImageLayout, nefallback vetva (1200×628 Google RSA/
//     Responsive, "Obrázky BEZ textu"): frame.fills bolo natvrdo takmer
//     biele ({0.96,0.97,0.98}), nie kampaňová farba.
//
// Dva z piatich pôvodne nahlásených formátov (1200×200 "women sites" —
// branding_leader_text, 640×500 Azet — email) sa pri kontrole ukázali ako
// UŽ plne pokryté (branding_leader_text nemá KV vôbec, celý rám je
// campaignSurface; email má hero fotku + zámerne bielu content zónu, bežný
// e-mailový vzor, žiadna surová medzera) — nie sú súčasťou tejto opravy,
// nahlásené naspäť ako samostatné zistenie.
//
// Test beží skutočné buildery zo zdroja (cez vm).
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync(require.resolve("../plugin/code.js"), "utf8");

function makeNode() {
  const node = {
    name: "", x: 0, y: 0, width: 0, height: 0, fills: [], children: [],
    fontName: null, fontSize: 0, characters: "", textAutoResize: "NONE",
    opacity: 1,
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
    createEllipse: makeNode,
    createFrame: makeNode,
    createText: makeNode,
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
    "\nthis.buildBrandingLeaderFullLayout = buildBrandingLeaderFullLayout;" +
    "\nthis.buildNativeCenterLayout = buildNativeCenterLayout;" +
    "\nthis.buildCleanImageLayout = buildCleanImageLayout;",
  context
);

function alphaAt(position, stops) {
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i], b = stops[i + 1];
    if (position >= a.position && position <= b.position) {
      const t = (position - a.position) / (b.position - a.position || 1);
      return a.color.a + t * (b.color.a - a.color.a);
    }
  }
  return stops[stops.length - 1].color.a;
}

// ── 1200×400 Ringier leaderboard (branding_leader_full) ────────────────
{
  const frame = makeNode();
  frame.width = 1200; frame.height = 400;
  const format = { width: 1200, height: 400 };
  const layout = { show_logo: false, show_cta: false };
  context.__frame = frame; context.__format = format; context.__layout = layout;
  context.__headline = null; context.__ctaText = null;
  context.__figmaImage = { hash: "fake-image" }; context.__figmaLogo = null;
  vm.runInContext(
    "buildBrandingLeaderFullLayout(__frame, __format, __layout, __headline, __ctaText, __figmaImage, __figmaLogo);",
    context
  );
  const photoW = Math.round(1200 * 0.35);
  const feather = frame.findOne((n) => n.name === "Branding leader colour extension");
  assert(feather, "1200x400: colour extension feather must be drawn at the photo's edge");
  assert(feather.x < photoW, "1200x400: feather must start INSIDE the photo, not at/after its edge, got x=" + feather.x);
  const stops = feather.fills[0].gradientStops;
  assert(alphaAt(1, stops) >= 0.99, "1200x400: feather must reach full opacity by its own right edge (>= photoW)");
  assert(feather.x + feather.width >= photoW,
    "1200x400: feather must reach at least the photo's right edge — no gap between blend and brand colour beyond it");
}

// ── 600×400 Engerio native (native_clean) ───────────────────────────────
{
  const frame = makeNode();
  frame.width = 600; frame.height = 400;
  const format = { width: 600, height: 400 };
  const layout = { show_headline: false };
  context.__frame = frame; context.__format = format; context.__layout = layout;
  context.__headline = null;
  context.__figmaImage = { hash: "fake-image" };
  vm.runInContext(
    "buildNativeCenterLayout(__frame, __format, __layout, __headline, __figmaImage);",
    context
  );
  const image = frame.findOne((n) => n.name === "Native image 3:2");
  assert(image, "600x400: native image must be drawn");
  assert.strictEqual(image.x, 0, "600x400: image must cover the full frame (x=0), no left margin, got x=" + image.x);
  assert.strictEqual(image.y, 0, "600x400: image must cover the full frame (y=0), no top margin, got y=" + image.y);
  assert.strictEqual(image.width, 600, "600x400: image width must be the full frame width, got " + image.width);
  assert.strictEqual(image.height, 400, "600x400: image height must be the full frame height, got " + image.height);
}

// ── 1200×628 Google RSA/Responsive (clean_image, non-fallback) ─────────
{
  const frame = makeNode();
  frame.width = 1200; frame.height = 628;
  const format = { width: 1200, height: 628 };
  const layout = {}; // no asset_fallback_kind — the "real, correctly-oriented asset" path
  context.__frame = frame; context.__format = format; context.__layout = layout;
  context.__figmaImage = null; // CUR_IMG_W/H unset in this harness -> exercises the frame.fills colour directly
  vm.runInContext(
    "buildCleanImageLayout(__frame, __format, __layout, __figmaImage);",
    context
  );
  const fill = frame.fills[0].color;
  const nearWhite = fill.r > 0.9 && fill.g > 0.9 && fill.b > 0.9;
  assert(!nearWhite, "1200x628: frame.fills must not be the old near-white {0.96,0.97,0.98} fallback, got " +
    JSON.stringify(fill));
}

console.log("P0-41 landscape colour extension (branding_leader_full, native_center, clean_image): ok");
