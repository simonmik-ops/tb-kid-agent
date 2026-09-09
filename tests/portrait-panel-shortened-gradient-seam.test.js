// Regresia 9.9.2026 (nájdené pri vizuálnej kontrole živého výstupu,
// L6yFpLkKcHe9flUk3i11T1, Httpool 1000×1500 publisher): keď sa "Adaptive
// portrait content panel" retroaktívne skráti (P0-29-S8 blok, contentTop >
// pôvodná panelY), gradient dostával napevno boundaryStop=0,12 bez ohľadu
// na to, kde fotka voči NOVEJ (posunutej) pozícii panelu skutočne končí.
// Pixelovo overené na živom výstupe: presne na hranici fotky (y=1000 z
// 1500) farba SKOČILA z (140,67,54) na (192,95,77) — asi o 50 bodov
// jasnejšie — lebo panel v tom bode ešte nedosiahol plnú krycosť (0,12 z
// jeho 541px výšky = 65px nábeh, no fotka končí už po 41px do panelu), takže
// sa nakrátko odhalila NEZATIENENÁ campaignSurface farba namiesto plynulého
// nadviazania na už stmavený spodný okraj fotky.
//
// Oprava počíta boundaryStop rovnakým vzorcom ako pôvodná (nie-skrátená)
// vetva vyššie ((portraitImageH - contentTop) / (format.height -
// contentTop)) — plná krycosť presne tam, kde fotka končí — namiesto
// napevno zapísanej 0,12.
//
// Test overuje zdroj priamo (rovnaký prístup ako
// tests/lower-panel-gradient-ramp.test.js): funkčná reprodukcia cez vm je
// tu krehká (JS mock textového zalamovania sa nezhoduje presne so
// skutočným Figma enginom, takže presné namerané súradnice 959/1000/1500
// sa v mocku nedajú spoľahlivo zopakovať) — kontrola zdrojového tvaru je
// preto spoľahlivejšia a naďalej sleduje skutočný commitnutý kód.
const assert = require("assert");
const fs = require("fs");

const source = fs.readFileSync(require.resolve("../plugin/code.js"), "utf8");

const blockStart = source.indexOf("if (contentTop > adaptivePanel.y)");
assert(blockStart >= 0, "P0-29-S8 retroaktívne skrátenie panelu musí existovať");
const blockEnd = source.indexOf("\n    }\n", blockStart);
const blockSrc = source.slice(blockStart, blockEnd);

assert(!/sampledPortraitOverlayGradient\(layout,\s*0\.12,/.test(blockSrc),
  "retroaktívne skrátenie nesmie znova použiť napevno zapísaný boundaryStop=0.12 (namerená príčina švíku)");

assert(/const shortenedBoundary\s*=\s*clamp\(\s*\(\s*portraitImageH\s*-\s*contentTop\s*\)\s*\/\s*Math\.max\(1,\s*format\.height\s*-\s*contentTop\s*\)/.test(blockSrc),
  "boundaryStop musí byť dopočítaný z (portraitImageH - contentTop) / (format.height - contentTop), rovnako ako pôvodná (nie-skrátená) vetva");

// sampledPortraitOverlayGradient() má vlastný interný floor 0,16 — príliš
// vysoký pre tento prípad (typické prekrytie fotky s panelom je tu oveľa
// menšie), takže gradient sa tu musí stavať priamo (nie cez zdieľanú
// funkciu), s vlastným floorom 0,02.
assert(!/sampledPortraitOverlayGradient\(layout,\s*shortenedBoundary/.test(blockSrc),
  "shortenedBoundary sa nesmie posielať cez sampledPortraitOverlayGradient — jej vlastný floor 0.16 by opravu potlačil (namerané: alfa 0.47 namiesto ~1.00)");
assert(/clamp\(\s*\(\s*portraitImageH\s*-\s*contentTop\s*\)\s*\/\s*Math\.max\(1,\s*format\.height\s*-\s*contentTop\s*\),\s*0\.02,\s*0\.98\s*\)/.test(blockSrc),
  "shortenedBoundary musí byť clampnutý s floorom 0.02, nie 0.16");
assert(/position:\s*shortenedBoundary,\s*color:\s*\{\s*r:\s*shortenedDark\.r/.test(blockSrc),
  "gradient stop musí použiť shortenedBoundary priamo ako position");

// mirror lineárnej interpolácie medzi stopmi (rovnaká logika ako Figma
// GRADIENT_LINEAR pri vykresľovaní) — overí, že SAMOTNÝ vzorec (nie len
// jeho prítomnosť v zdroji) skutočne dáva plnú alfu presne na hranici fotky.
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function fixedGradientStops(boundary) {
  const b = clamp(boundary, 0.02, 0.98);
  return [
    { position: 0, alpha: 0 },
    { position: b, alpha: 1 },
    { position: 1, alpha: 1 }
  ];
}
function oldSharedFnStops(boundary) {
  const b = clamp(boundary, 0.16, 0.72);
  return [
    { position: 0, alpha: 0 },
    { position: b, alpha: 1 },
    { position: 1, alpha: 1 }
  ];
}
function alphaAt(position, stops) {
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i], b = stops[i + 1];
    if (position >= a.position && position <= b.position) {
      const t = (position - a.position) / (b.position - a.position || 1);
      return a.alpha + t * (b.alpha - a.alpha);
    }
  }
  return stops[stops.length - 1].alpha;
}

// Presné namerané čísla zo živého výstupu.
const portraitImageH = 1000, contentTop = 959, formatHeight = 1500;
const positionInPanel = (portraitImageH - contentTop) / (formatHeight - contentTop);
const shortenedBoundary = positionInPanel; // rovnaký vzorec, floor 0.02 sa tu ani nedotkne (0.076 > 0.02)

const fixedStops = fixedGradientStops(shortenedBoundary);
const alphaAtPhotoEdge = alphaAt(positionInPanel, fixedStops);
assert(alphaAtPhotoEdge >= 0.99,
  "s opraveným vzorcom (floor 0.02, mimo zdieľanej funkcie) musí byť alfa presne na hranici fotky takmer plná (>=0.99), got " +
  alphaAtPhotoEdge.toFixed(3));

// Kontrola predpokladu #1: STARÝ pevný boundaryStop=0,12 (pôvodná chyba)
// dával na tej istej pozícii viditeľne neplnú alfu.
const alphaWithOldFixed = alphaAt(positionInPanel, fixedGradientStops(0.12));
assert(alphaWithOldFixed < 0.99,
  "kontrola predpokladu: starý pevný boundaryStop=0.12 musí na tejto pozícii dávať neplnú alfu (regresia), got " +
  alphaWithOldFixed.toFixed(3));

// Kontrola predpokladu #2: aj SPRÁVNY vzorec by cez zdieľanú
// sampledPortraitOverlayGradient() (floor 0,16) zlyhal presne rovnako —
// dôvod, prečo sa gradient musí stavať priamo, nie cez tú funkciu.
const alphaViaSharedFn = alphaAt(positionInPanel, oldSharedFnStops(shortenedBoundary));
assert(alphaViaSharedFn < 0.99,
  "kontrola predpokladu: aj správny vzorec cez zdieľanú funkciu (floor 0.16) by dal neplnú alfu — musí sa obísť, got " +
  alphaViaSharedFn.toFixed(3));

console.log("portrait panel shortened-gradient seam (Httpool regression): ok");
