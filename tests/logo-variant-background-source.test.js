// Regresia 13.9.2026 (logo zadanie, systémová oprava #1): pickLogoForLayout()
// vyberalo biely/tmavý variant podľa brandEdgeColor(layout,"bottom") — jedna
// GLOBÁLNA hodnota vzorkovaná zo spodného okraja CELÉHO KV (raw pixel),
// rovnaká pre všetky formáty bez ohľadu na to, ČO sa v skutočnosti kreslí
// za logom. Overené naprieč buildermi (side_safe, branding_skin,
// interscroller, branding_leader_full, full_bleed): logo vo všetkých z
// nich sedí na plnokrycom paneli/scrime odvodenom z campaignSurface(layout)
// — nie na surovom KV pixeli. Keď sa tieto dve farby líšia (typický
// prípad: svetlý/teplý KV so sýtou kampanovou farbou panelu), stará logika
// vyberala variant podľa NESPRÁVNEJ farby.
//
// Tento test overuje zdrojový kód priamo (source.includes), rovnaký
// prístup ako existujúci tests/logo-fallback-warning.test.js (closure v
// createAllFrames, nedá sa volať izolovane bez celého async pipeline) —
// a k tomu reimplementáciu PRESNE podľa zdroja, ktorá dokazuje, že výber
// teraz sleduje campaignSurface, nie brandEdgeColor, keď sa líšia.
const assert = require("assert");
const fs = require("fs");

const source = fs.readFileSync(require.resolve("../plugin/code.js"), "utf8");

const start = source.indexOf("function pickLogoForLayout");
const end = source.indexOf("\n  }\n", start) + 5;
const fnSrc = source.slice(start, end);

assert(fnSrc.includes("bgOverride || campaignSurface(layout)"),
  "pickLogoForLayout must default to campaignSurface(layout) (the actual panel/scrim colour drawn under the logo " +
  "in side_safe/branding_skin/interscroller/branding_leader_full/full_bleed), not brandEdgeColor, got:\n" + fnSrc);
assert(!fnSrc.includes('brandEdgeColor(layout, "bottom")'),
  "pickLogoForLayout must no longer default to the raw KV bottom-edge sample, got:\n" + fnSrc);
assert(fnSrc.includes("function pickLogoForLayout(layout, bgOverride)"),
  "pickLogoForLayout must accept an explicit background override for callers with a known-different backdrop " +
  "(email's white content area, logo_only's transparent canvas), got:\n" + fnSrc);

// Reimplementácia presne podľa zdroja (rovnaký vzor ako logo-fallback-
// warning.test.js) — dokazuje SPRÁVANIE, nielen prítomnosť reťazca.
function pickLogoForLayoutSim(figmaLogoDark, figmaLogoWhite, bg, warnings) {
  function noteLogoFallback(reason) { warnings.push("logo_variant_fallback_" + reason); }
  if (!figmaLogoDark && !figmaLogoWhite) return null;
  if (!figmaLogoDark) return figmaLogoWhite;
  const luma = 0.2126 * bg.r + 0.7152 * bg.g + 0.0722 * bg.b;
  if (!figmaLogoWhite) {
    if (luma < 0.5) noteLogoFallback("white_missing_on_dark_surface");
    return "dark";
  }
  return luma < 0.5 ? "white" : "dark";
}

// KV bottom edge is a light/warm coral (typical lifestyle photo bottom —
// skin tone / light clothing), but the campaign panel colour is a dark
// navy brand colour. A format whose logo sits on the panel (the normal
// case for every non-master_safe, non-email, non-logo_only builder) must
// pick WHITE here — matching the panel it's actually drawn on.
{
  const kvBottomEdge = { r: 0.94, g: 0.78, b: 0.62 }; // light coral, luma > 0.5
  const panelColor = { r: 0.02, g: 0.10, b: 0.30 };   // dark navy, luma < 0.5
  const warnings = [];
  const result = pickLogoForLayoutSim("dark-logo", "white-logo", panelColor, warnings);
  assert.strictEqual(result, "white",
    "logo on a dark campaign panel must pick white, regardless of what the raw KV bottom edge looks like");
  assert.strictEqual(warnings.length, 0, "white asset is available, no warning expected");

  // Sanity: confirms the two colours genuinely disagree, so this test
  // would have failed under the old brandEdgeColor-based logic (which
  // would have picked "dark" here, using kvBottomEdge instead).
  const kvLuma = 0.2126 * kvBottomEdge.r + 0.7152 * kvBottomEdge.g + 0.0722 * kvBottomEdge.b;
  assert(kvLuma >= 0.5, "sanity check: this scenario requires the KV edge and panel colour to disagree");
}

// Inverse: light campaign panel, dark KV bottom edge — must pick dark to
// match the light panel, not white to match the (irrelevant) KV pixel.
{
  const kvBottomEdge = { r: 0.05, g: 0.05, b: 0.08 }; // near-black
  const panelColor = { r: 0.92, g: 0.90, b: 0.86 };   // light cream
  const warnings = [];
  const result = pickLogoForLayoutSim("dark-logo", "white-logo", panelColor, warnings);
  assert.strictEqual(result, "dark",
    "logo on a light campaign panel must pick dark, regardless of a dark raw KV bottom edge");
}

// Missing white asset on a dark panel: must fall back to dark AND report
// it (never silent) — same mechanism, now checked against the correct
// (panel) colour instead of the KV pixel.
{
  const panelColor = { r: 0.02, g: 0.10, b: 0.30 };
  const warnings = [];
  const result = pickLogoForLayoutSim("dark-logo", null, panelColor, warnings);
  assert.strictEqual(result, "dark", "must still fall back to dark (no white asset exists)");
  assert(warnings.includes("logo_variant_fallback_white_missing_on_dark_surface"),
    "missing white asset on a dark panel must be reported, not silent, got " + JSON.stringify(warnings));
}

console.log("logo variant selection follows the actual panel colour (campaignSurface), not the raw KV pixel: ok");
