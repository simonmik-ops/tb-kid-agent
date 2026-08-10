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

// ── easedAlphaStops (prechody / gradienty zadanie) ──────────────────────────
function easedAlphaStops(color, targetAlpha, rampEndFrac) {
  const rf = Math.max(0.02, Math.min(1, rampEndFrac));
  const stopAt = (fracOfRamp, alphaRatio) => ({
    position: Math.min(0.999, rf * fracOfRamp),
    color: { r: color.r, g: color.g, b: color.b, a: Math.round(targetAlpha * alphaRatio * 1000) / 1000 }
  });
  const stops = [
    { position: 0, color: { r: color.r, g: color.g, b: color.b, a: 0 } },
    stopAt(0.35, 0.30),
    stopAt(0.70, 0.75),
    stopAt(1.00, 1.00)
  ];
  if (rf < 0.999) stops.push({ position: 1, color: { r: color.r, g: color.g, b: color.b, a: targetAlpha } });
  return stops;
}

const BLACK = { r: 0, g: 0, b: 0 };

// rampEndFrac = 1 (edge-prechod prípad): žiadny extra "drž" stop, presne 4.
const edgeStops = easedAlphaStops(BLACK, 1, 1);
assert.strictEqual(edgeStops.length, 4, "rampEndFrac=1 must not add a redundant trailing hold stop");
assert.strictEqual(edgeStops[0].color.a, 0, "must start fully transparent");
assert.strictEqual(edgeStops[edgeStops.length - 1].color.a, 1, "must end at targetAlpha");
// Pozícia je zámerne stropovaná na 0.999 (nie presne 1) — Math.min(0.999, ...)
// v easedAlphaStops, nech posledný segment nemá nulovú šírku pri rampEndFrac=1.
assert.ok(edgeStops[edgeStops.length - 1].position >= 0.999, "last stop must reach ~1 (capped at 0.999 by design)");

// rampEndFrac < 1 (scrim/panel prípad): pridá sa "drž" stop na pozícii 1.
const scrimStops = easedAlphaStops(BLACK, 0.8, 0.3);
assert.strictEqual(scrimStops.length, 5, "rampEndFrac<1 must add the trailing hold stop");
assert.strictEqual(scrimStops[scrimStops.length - 1].position, 1);
assert.strictEqual(scrimStops[scrimStops.length - 1].color.a, 0.8, "hold stop must equal targetAlpha, not drift");
// stop pred "drž" musí byť presne na rampEndFrac s plnou targetAlpha.
assert.ok(Math.abs(scrimStops[3].position - 0.3) < 1e-6, "ramp must complete exactly at rampEndFrac");
assert.strictEqual(scrimStops[3].color.a, 0.8);

// Alfa musí byť monotónne rastúca (žiadny "skok späť", ktorý by vyzeral ako pás).
[edgeStops, scrimStops].forEach((stops, i) => {
  for (let k = 1; k < stops.length; k++) {
    assert.ok(stops[k].color.a >= stops[k - 1].color.a - 1e-9,
      "stop " + k + " must not be darker than the previous one (set " + i + ")");
    assert.ok(stops[k].position >= stops[k - 1].position - 1e-9,
      "stop " + k + " position must not go backwards (set " + i + ")");
  }
});

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

// ── textNaPodklade: WCAG large-text prah (3:1) pre headline/podnadpis ──────
// Mirror z plugin/code.js — pri zmene jednej strany treba zmeniť aj druhú.
function textNaPodklade(farba, minWhiteRatio) {
  const prah = typeof minWhiteRatio === "number" ? minWhiteRatio : 4.5;
  const L = relativeLuminance(farba);
  const kBiela = 1.05 / (L + 0.05);
  if (kBiela >= prah) return WHITE;
  const tmava = { r: 0.04, g: 0.10, b: 0.24 };
  const Lt = relativeLuminance(tmava);
  const kTmava = (L + 0.05) / (Lt + 0.05);
  return kTmava > kBiela ? tmava : WHITE;
}

// Farba zvolená tak, aby biela dala kontrast v [3, 4.5) A ZÁROVEŇ aby tmavá
// navy pod starou "čo kontrastuje lepšie" logikou vyhrala — presne prípad,
// ktorý spôsobil regresiu (biely headline na Surďovej referencii sa
// preklopil na tmavý, hoci 3:1 pre veľký Bold text stačí).
const midCoral = { r: 0.75, g: 0.40, b: 0.30 };
const kBielaMid = 1.05 / (relativeLuminance(midCoral) + 0.05);
assert.ok(kBielaMid >= 3.0 && kBielaMid < 4.5,
  "test color must land in the 3:1-4.5:1 gap that demonstrates the fix, got " + kBielaMid.toFixed(2));

// Headline/podnadpis (prah 3.0): biela musí vyhrať, keďže 3:1 stačí pre
// veľký Bold text — presne to, čo Surďova referenčná Figma robí.
const headlineColor = textNaPodklade(midCoral, 3.0);
assert.deepStrictEqual(headlineColor, WHITE,
  "large/bold text (headline/subheadline) must get white when it clears 3:1, matching the reference Figma");

// Legal / AI tag (default prah 4.5): rovnaká farba plochy, ale malý text —
// tu má zostať prísnejšia požiadavka, správanie sa NESMIE zmeniť.
const legalColor = textNaPodklade(midCoral);
assert.notDeepStrictEqual(legalColor, WHITE,
  "small text (legal/AI tag) must keep the stricter 4.5:1 requirement and fall back to dark here");

console.log("contrast: ok");
