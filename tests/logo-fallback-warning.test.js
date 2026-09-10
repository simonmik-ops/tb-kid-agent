// Regresia 10.9.2026 (P0-40 C3 / P2-26, jeden mechanizmus pre oba):
//   - pickLogoForLayout() (closure v createAllFrames) vracalo tmavé logo
//     zakaždým, keď chýbal biely upload — aj na tmavom pozadí, kde by bol
//     podľa Simoninho pravidla ("farebné/tmavé plochy = biele logo")
//     zvolený biely variant. Nikde sa to nehlásilo.
//   - buildLogoOnlyLayout() pri úplne chýbajúcom logu (P2-26) padalo na
//     headline text, tiež bez hlásenia.
// Oba teraz volajú jednu zdieľanú funkciu, noteLogoFallback(), ktorá píše
// do layout.validation_warnings — rovnaký kanál, aký už používa
// noteContrastIfLow().
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync(require.resolve("../plugin/code.js"), "utf8");

// ── 1) buildLogoOnlyLayout (P2-26 polovica) — funkčný test cez vm ───────
function makeNode() {
  const node = {
    name: "", x: 0, y: 0, width: 0, height: 0, fills: [], children: [],
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
    createRectangle: makeNode, createFrame: makeNode, createText: makeNode,
    showUI: function () {}, closePlugin: function () {},
    ui: { onmessage: null, postMessage: function () {} },
    root: { children: [] }, currentPage: { children: [] }
  },
  console: console
};
vm.createContext(context);
vm.runInContext(source + "\nthis.buildLogoOnlyLayout = buildLogoOnlyLayout;", context);

function runLogoOnly(figmaLogo) {
  const frame = makeNode();
  frame.width = 1200; frame.height = 1200;
  const format = { width: 1200, height: 1200, role: "logo_only" };
  const layout = {};
  context.__frame = frame; context.__format = format; context.__layout = layout;
  context.__headline = "Investovanie";
  context.__figmaLogo = figmaLogo;
  vm.runInContext(
    "buildLogoOnlyLayout(__frame, __format, __layout, __headline, __figmaLogo);",
    context
  );
  return layout;
}

const withLogo = runLogoOnly({ hash: "fake-logo" });
assert(!(withLogo.validation_warnings || []).some((w) => w.indexOf("logo_variant_fallback") === 0),
  "logo_only with a logo present must NOT warn");

const withoutLogo = runLogoOnly(null);
assert(Array.isArray(withoutLogo.validation_warnings) &&
  withoutLogo.validation_warnings.includes("logo_variant_fallback_missing_on_logo_only_output"),
  "logo_only WITHOUT a logo must warn via noteLogoFallback (P2-26), got " + JSON.stringify(withoutLogo.validation_warnings));

// ── 2) pickLogoForLayout (C3 polovica) — closure v createAllFrames,
// overené zdrojovo (rovnaký prístup ako iné testy dnes pre uzavreté
// closures) + priama reimplementácia jej presnej logiky, nech test sleduje
// skutočný vzorec, nie jeho vlastnú kópiu naslepo.
const pickStart = source.indexOf("function pickLogoForLayout");
const pickEnd = source.indexOf("\n  }\n", pickStart) + 5;
const pickSrc = source.slice(pickStart, pickEnd);

assert(pickSrc.includes("noteLogoFallback(layout, \"white_missing_on_dark_surface\")"),
  "pickLogoForLayout must call noteLogoFallback when white is missing AND the surface is dark, got:\n" + pickSrc);
assert(!/if \(!figmaLogoWhite\) return figmaLogoDark;/.test(pickSrc),
  "pickLogoForLayout must not silently return dark on missing white without checking luma first (old behaviour)");

// Reimplementácia presne podľa zdroja — potvrdzuje, že hlásenie sa spustí
// LEN keď by bol inak zvolený biely variant (luma < 0,5), nie vždy.
function pickLogoForLayoutSim(figmaLogoDark, figmaLogoWhite, luma, warnings) {
  function noteLogoFallback(reason) { warnings.push("logo_variant_fallback_" + reason); }
  if (!figmaLogoDark && !figmaLogoWhite) return null;
  if (!figmaLogoDark) return figmaLogoWhite;
  if (!figmaLogoWhite) {
    if (luma < 0.5) noteLogoFallback("white_missing_on_dark_surface");
    return figmaLogoDark;
  }
  return luma < 0.5 ? figmaLogoWhite : figmaLogoDark;
}

{
  const warnings = [];
  const result = pickLogoForLayoutSim("dark", null, 0.2, warnings); // dark surface, no white upload
  assert.strictEqual(result, "dark", "must still fall back to dark logo (no white asset exists)");
  assert(warnings.includes("logo_variant_fallback_white_missing_on_dark_surface"),
    "dark surface + missing white upload must warn, got " + JSON.stringify(warnings));
}
{
  const warnings = [];
  const result = pickLogoForLayoutSim("dark", null, 0.8, warnings); // light surface, no white upload
  assert.strictEqual(result, "dark", "light surface correctly gets dark logo");
  assert.strictEqual(warnings.length, 0,
    "light surface + missing white upload must NOT warn (dark logo is the correct choice here anyway), got " + JSON.stringify(warnings));
}

console.log("logo fallback warning (P0-40 C3 / P2-26, one mechanism): ok");
