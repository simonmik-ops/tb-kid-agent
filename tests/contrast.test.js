// Krok 2e: kontrastný modul (WCAG 2.1), prenesené z master (commit 97b5d3f).
//
// plugin/code.js beží v Figma plugin sandboxe (globálny `figma`), takže sa
// nedá priamo require-núť v Node. Funkcie nižšie (srgbToLinear,
// relativeLuminance, contrastRatio, ensureReadableSurface) sú čisté (žiadne
// volanie figma.*) a sú tu zrkadlené 1:1 z plugin/code.js — pri zmene
// jednej strany treba zmeniť aj druhú.
//
// Tento súbor testuje LEN samotné funkcie ako čistú matematiku. Testy na to,
// AKO sa majú (ne)používať pri renderovaní (biela na brandovej ploche vždy,
// bez automatického stmavovania — Krok 3 pravidlo 2) patria ku Kroku 3,
// kde sa tá logika skutočne zapája do buildMasterSafeLayout a pod.

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
  const ratioBefore = surface.r / surface.g;
  const ratioAfter = fixed.r / fixed.g;
  assert.ok(Math.abs(ratioBefore - ratioAfter) < 0.01, h + " hue drifted: " + ratioBefore + " -> " + ratioAfter);
});

// ── tmavý KV: plocha sa zbytočne nestmavuje, keď už prah spĺňa ──────────────
const DARK = { r: 0.06, g: 0.08, b: 0.18 };
const darkFixed = ensureReadableSurface(DARK, WHITE, 4.5);
assert.ok(contrastRatio(DARK, WHITE) >= 4.5, "dark KV must already pass 4.5:1 against white");
assert.deepStrictEqual(darkFixed, DARK, "dark KV that already passes must not be darkened further");

// ── ensureReadableSurface nikdy nespadne na natvrdo modrú — vždy vráti niečo
// odvodené z pôvodnej surface (rovnaký alebo tmavší/svetlejší odtieň) ───────
const impossible = { r: 0.5, g: 0.5, b: 0.5 };
const extreme = ensureReadableSurface(impossible, WHITE, 21);
assert.ok(extreme.r < impossible.r, "must have darkened toward black, not jumped to an unrelated color");
assert.ok(extreme.r >= 0 && extreme.g >= 0 && extreme.b >= 0, "must stay within valid color range");

// ── pickTextColor: vyberá stranu s vyšším kontrastom ────────────────────────
assert.deepStrictEqual(pickTextColor({ r: 0.05, g: 0.05, b: 0.05 }), WHITE, "dark surface must pick white text");
assert.deepStrictEqual(pickTextColor({ r: 0.95, g: 0.95, b: 0.95 }), { r: 0, g: 0, b: 0 }, "light surface must pick black text");

console.log("contrast: ok");
