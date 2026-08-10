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

console.log("contrast: ok");
