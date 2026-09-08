// Regresia 8.9.2026: sampledLowerPanelGradient() (zdieľaná medzi
// buildSideSafeLayout, buildInterscrollerSafeLayout a Adform "Dark lower
// panel") mala alfa rampu 0,10 → 1,00 dokončenú až na 45 % výšky panelu.
// Volajúci ale kladú headline oveľa bližšie k vrchu panelu (namerané na
// živom Figma výstupe, L6yFpLkKcHe9flUk3i11T1: 720×1280 interscroller,
// panelY=933/panelH=307, headline na y=964 — pozícia ~0,10 v paneli).
// Pri starej rampe tam bola alfa len ~0,30 — headline sedel takmer priamo
// na fotke (u tejto kampane tmavá sukňa modelky pod panelom), čo dávalo
// "bahnistú hnedú" namiesto čistej brandovej plochy — presne princíp, čo
// ZADANIE_kompozicny_model.md (bod 1, Surdova referencia) vyžaduje: text
// musí vždy sedieť na PLNE KRYCEJ brandovej ploche, nikdy priamo na fotke.
//
// Tento test neduplikuje presnú pixelovú kontrolu (to sa robí vizuálne vo
// Figme) — overuje mechanizmus: rampa musí dosiahnuť plnú alfu na pozícii
// dostatočne nízkej, aby headline (kladený na comp.inner/panelH pozíciu u
// oboch reálnych volajúcich) bol vždy na alfe blízkej 1,00, nie ~0,30.
const assert = require("assert");
const fs = require("fs");

const source = fs.readFileSync(require.resolve("../plugin/code.js"), "utf8");

const fnStart = source.indexOf("function sampledLowerPanelGradient");
const fnEnd = source.indexOf("\nfunction ", fnStart + 1);
assert(fnStart >= 0 && fnEnd > fnStart, "sampledLowerPanelGradient must exist in plugin/code.js");
const fnSrc = source.slice(fnStart, fnEnd);

// Extrahuj skutočné gradientStops z kódu (position/alpha dvojice), nie
// natvrdo predpokladaj tvar — nech test sleduje kód, nie naopak.
const stopMatches = [...fnSrc.matchAll(/position:\s*([\d.]+),\s*color:\s*\{[^}]*a:\s*([\d.]+)/g)]
  .map((m) => ({ position: Number(m[1]), alpha: Number(m[2]) }));
assert.strictEqual(stopMatches.length, 3, "sampledLowerPanelGradient must have exactly 3 gradient stops, got " + stopMatches.length);
assert.strictEqual(stopMatches[0].position, 0, "prvý stop musí byť na position 0");
assert.strictEqual(stopMatches[2].position, 1, "posledný stop musí byť na position 1");
assert.strictEqual(stopMatches[2].alpha, 1, "posledný stop musí mať plnú alfu");

const rampEnd = stopMatches[1];
assert.strictEqual(rampEnd.alpha, 1, "prostredný stop musí dosahovať plnú alfu (1,00), inak panel nikdy nie je plne krycí");

// mirror lineárnej interpolácie medzi stopmi (rovnaká logika ako Figma
// GRADIENT_LINEAR pri vykresľovaní)
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

// Skutočná nameraná pozícia headlinu v buildInterscrollerSafeLayout na
// živom výstupe (720×1280, panelY=933/panelH=307, headline y=964).
const interscrollerHeadlinePosition = (964 - 933) / 307;
const alphaAtInterscrollerHeadline = alphaAt(interscrollerHeadlinePosition, stopMatches);
assert(alphaAtInterscrollerHeadline >= 0.99,
  "interscroller headline (pozícia " + interscrollerHeadlinePosition.toFixed(3) +
  " v paneli) musí sedieť na takmer plnej alfe (>=0.99), inak sa opakuje bahnistá hnedá regresia, got " +
  alphaAtInterscrollerHeadline.toFixed(3));

console.log("lower panel gradient ramp (muddy brown regression): ok");
