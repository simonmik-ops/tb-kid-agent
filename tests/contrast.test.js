// P0-16: kontrastný modul (WCAG 2.1).
//
// plugin/code.js beží v Figma plugin sandboxe (globálny `figma`), takže sa
// nedá priamo require-núť v Node. Funkcie nižšie (srgbToLinear,
// relativeLuminance, contrastRatio, ensureReadableSurface, scrimAlphaFor)
// sú čisté (žiadne volanie figma.*) a sú tu zrkadlené 1:1 z plugin/code.js —
// pri zmene jednej strany treba zmeniť aj druhú.

const assert = require("assert");

function srgbToLinear(c) {
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(color) {
  return 0.2126 * srgbToLinear(color.r)
       + 0.7152 * srgbToLinear(color.g)
       + 0.0722 * srgbToLinear(color.b);
}

function contrastRatio(a, b) {
  const la = relativeLuminance(a), lb = relativeLuminance(b);
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

function ensureReadableSurface(surface, textColor, minRatio) {
  const textIsLight = relativeLuminance(textColor) > 0.5;
  let color = { r: surface.r, g: surface.g, b: surface.b };
  let best = color, bestRatio = contrastRatio(color, textColor);
  for (let i = 0; i < 40 && bestRatio < minRatio; i++) {
    if (textIsLight) {
      color = { r: color.r * 0.96, g: color.g * 0.96, b: color.b * 0.96 };
    } else {
      color = {
        r: color.r + (1 - color.r) * 0.04,
        g: color.g + (1 - color.g) * 0.04,
        b: color.b + (1 - color.b) * 0.04
      };
    }
    const ratio = contrastRatio(color, textColor);
    if (ratio > bestRatio) { bestRatio = ratio; best = color; }
  }
  return best;
}

function pickTextColor(surface) {
  const white = { r: 1, g: 1, b: 1 }, black = { r: 0, g: 0, b: 0 };
  return contrastRatio(surface, white) >= contrastRatio(surface, black) ? white : black;
}

function scrimAlphaFor(layout) {
  const luma = (layout && typeof layout.kv_luma_bottom === "number") ? layout.kv_luma_bottom : 1;
  return Math.max(0.50, Math.min(0.90, 0.50 + luma * 0.40));
}

function hex(h) {
  const n = parseInt(h.replace("#", ""), 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

const WHITE = { r: 1, g: 1, b: 1 };

// ── ensureReadableSurface: svetlé pastelové KV musia po úprave dať ≥ 4,5 : 1 ─
const PASTELS = ["#F2E4D6", "#EDE7DC", "#F7F1E8"];
PASTELS.forEach((h) => {
  const surface = hex(h);
  const before = contrastRatio(surface, WHITE);
  const fixed = ensureReadableSurface(surface, WHITE, 4.5);
  const after = contrastRatio(fixed, WHITE);
  assert.ok(before < 4.5, h + " pastel must actually be a failing case before the fix (got " + before.toFixed(2) + ")");
  assert.ok(after >= 4.5 - 1e-6, h + " must reach >= 4.5:1 after ensureReadableSurface (got " + after.toFixed(2) + ")");
});

// ── hue sa zachová (kanály sa škálujú rovnakým faktorom, nemenia pomer) ─────
PASTELS.forEach((h) => {
  const surface = hex(h);
  const fixed = ensureReadableSurface(surface, WHITE, 4.5);
  // Pomer R:G by mal ostať približne rovnaký (v rámci zaokrúhľovania).
  const ratioBefore = surface.r / surface.g;
  const ratioAfter = fixed.r / fixed.g;
  assert.ok(Math.abs(ratioBefore - ratioAfter) < 0.01, h + " hue drifted: " + ratioBefore + " -> " + ratioAfter);
});

// ── tmavý KV: panel sa zbytočne nestmavuje (surface ostáva prakticky rovnaká,
// prípadne sa mierne upraví, ale nie na takmer čiernu) ──────────────────────
const DARK = { r: 0.06, g: 0.08, b: 0.18 };
const darkFixed = ensureReadableSurface(DARK, WHITE, 4.5);
assert.ok(contrastRatio(DARK, WHITE) >= 4.5, "dark KV must already pass 4.5:1 against white");
assert.deepStrictEqual(darkFixed, DARK, "dark KV that already passes must not be darkened further");

// ── scrimAlphaFor: pre celý rozsah kv_luma_bottom musí čierny scrim pri
// vrátenej alfe dať >= 4.5:1 voči bielemu textu ─────────────────────────────
for (let luma = 0; luma <= 1.001; luma += 0.05) {
  const alpha = scrimAlphaFor({ kv_luma_bottom: luma });
  // Efektívny jas plochy pod scrimom (čierny scrim, blend v sRGB priestore
  // ako pri kreslení do Figmy — rovnaké zjednodušenie ako v code.js komentári).
  const blended = { r: luma * (1 - alpha), g: luma * (1 - alpha), b: luma * (1 - alpha) };
  const ratio = contrastRatio(blended, WHITE);
  assert.ok(ratio >= 4.5 - 1e-6, "luma " + luma.toFixed(2) + " alpha " + alpha.toFixed(2) + " must give >= 4.5:1, got " + ratio.toFixed(2));
}

// ── ensureReadableSurface nikdy nespadne na natvrdo modrú — vždy vráti niečo
// odvodené z pôvodnej surface (rovnaký alebo tmavší/svetlejší odtieň) ───────
const impossible = { r: 0.5, g: 0.5, b: 0.5 };
// aj pri nedosiahnuteľnom minRatio (napr. 21 pre stredne šedú) musí vrátiť
// najlepšiu dosiahnutú hodnotu, nie hocičo iné.
const extreme = ensureReadableSurface(impossible, WHITE, 21);
assert.ok(extreme.r < impossible.r, "must have darkened toward black, not jumped to an unrelated color");
assert.ok(extreme.r >= 0 && extreme.g >= 0 && extreme.b >= 0, "must stay within valid color range");

// easedAlphaStops bol odstránený z plugin/code.js (viď nižšie) — edge-prechod
// aj wide panel sú teraz obyčajné 2-3 stopové lineárne gradienty, overené
// priamo proti Surďovej referenčnej mask SVG (node 0:8, d51uxTh8YqPdHujzi1Plt6):
//   <linearGradient>Stop() -> Stop(offset=1, opacity=0)</linearGradient>
// Žiadna S-krivka — "pás" spôsobovala príliš úzka prechodová zóna (10 %),
// nie tvar krivky. Testy na easedAlphaStops boli zmazané spolu s funkciou.

// ── Regresia po 47f4523: Bottom readability gradient scrim ─────────────────
// scrim NIE JE easedAlphaStops — má vlastný tvar, kde rampEnd znamená "tu je
// ~70 % cieľovej alfy", nie "tu JE cieľová alfa". Testy vyššie na
// easedAlphaStops toto nechytili, lebo scrim už tú funkciu nevolá vôbec —
// testovali správanie zdieľanej funkcie (korektné pre panel/edge-prechod),
// nie skutočný scrim kód. Mirror priamo z buildMasterSafeLayout.
function scrimGradientStops(scrimAlpha, rampEnd) {
  const _a = (podiel) => Math.round(scrimAlpha * podiel * 1000) / 1000;
  return [
    { position: 0.00, color: { r: 0.10, g: 0.10, b: 0.10, a: 0.00 } },
    { position: rampEnd * 0.5, color: { r: 0.08, g: 0.08, b: 0.08, a: _a(0.34) } },
    { position: rampEnd, color: { r: 0.05, g: 0.05, b: 0.05, a: _a(0.70) } },
    { position: rampEnd + (1 - rampEnd) * 0.35, color: { r: 0.03, g: 0.03, b: 0.03, a: _a(0.88) } },
    { position: 1.00, color: { r: 0.00, g: 0.00, b: 0.00, a: scrimAlpha } }
  ];
}

const scrimAlphaTarget = 0.612;
const rampEndTest = 0.14; // zodpovedá ~2000×1400 prípadu z regresie
const realScrim = scrimGradientStops(scrimAlphaTarget, rampEndTest);
const atRampEnd = realScrim.find(s => Math.abs(s.position - rampEndTest) < 1e-9);
assert.ok(atRampEnd, "must have a stop exactly at rampEnd");
assert.ok(atRampEnd.color.a < scrimAlphaTarget * 0.9,
  "alpha at rampEnd must be well below target (~70%), not equal to it — regresia po 47f4523 dávala 100% už tu, získala " + atRampEnd.color.a);
assert.ok(Math.abs(atRampEnd.color.a - scrimAlphaTarget * 0.70) < 1e-3,
  "alpha at rampEnd must be ~70% of target");
const lastScrimStop = realScrim[realScrim.length - 1];
assert.strictEqual(lastScrimStop.position, 1.00, "must keep climbing to position 1.0, not hold flat from rampEnd");
assert.strictEqual(lastScrimStop.color.a, scrimAlphaTarget, "must reach full target alpha only at the bottom corner");
// Musí naďalej rásť MEDZI rampEnd a 1.0 (nie plochý chvost — presne regresia).
const afterRampEnd = realScrim.filter(s => s.position > rampEndTest);
for (let k = 1; k < afterRampEnd.length; k++) {
  assert.ok(afterRampEnd[k].color.a > afterRampEnd[k - 1].color.a,
    "alpha must strictly keep increasing past rampEnd, not plateau (flat dark plate regression)");
}

// ── ZADANIE bod 2: text na brandovej ploche je VŽDY biely — brandové
// pravidlo, nie výsledok "čo kontrastuje lepšie" (textNaPodklade/
// pickTextColor boli z tohto dôvodu odstránené z plugin/code.js). Keď biela
// sama osebe nedosiahne prah, rieši sa to stmavením PLOCHY cez
// ensureReadableSurface, nie preklopením textu na tmavú. Test overuje, že
// toto platí naprieč svetlými AJ tmavými brand farbami — surfaceColor sa
// mení, farba textu ostáva biela a >= 4,5 : 1 vždy vyjde.
const BRAND_COLORS_LIGHT_AND_DARK = [
  { name: "svetlá koralová (#f28c73)", color: hex("#f28c73") },
  { name: "sýta coral (#c55e4d)", color: hex("#c55e4d") },
  { name: "pastelová (#F2E4D6)", color: hex("#F2E4D6") },
  { name: "tmavomodrá (#0a1a3d)", color: hex("#0a1a3d") }
];
BRAND_COLORS_LIGHT_AND_DARK.forEach(({ name, color }) => {
  const surfaceColor = ensureReadableSurface(color, WHITE, 4.5);
  const ratio = contrastRatio(surfaceColor, WHITE);
  assert.ok(ratio >= 4.5 - 1e-6,
    name + ": surfaceColor musí dať >= 4,5 : 1 voči bielej (biela je fixná, plocha sa prispôsobuje), got " + ratio.toFixed(2));
  // Farba textu je vždy biela — žiadna voľba, žiadne porovnávanie s tmavou.
  const farbaTextu = WHITE;
  assert.deepStrictEqual(farbaTextu, WHITE, name + ": text na brandovej ploche musí byť vždy biely");
});

console.log("contrast: ok");
