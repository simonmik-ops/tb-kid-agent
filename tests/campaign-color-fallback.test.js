// Regresia 8.9.2026: "modré tabuľky" na branding_full (2000×1400,
// markíza/tvnoviny/joj) — dva NEZÁVISLÉ zdroje toho istého vizuálneho bugu.
//
// Bug #1 — agent.js: `bg_r: visualAnalysis.bg_r || 0.1` (a rovnako
// bg_g/bg_b) VŽDY vrátilo číslo — či už reálnu AI-vzorkovanú hodnotu, alebo
// natvrdo (0.1, 0.1, 0.18), teda tmavú navy. Toto číslo (aj ten fallback)
// sa poslalo do plugin/code.js ako layout.bg_r. Tam ale platí:
//   if (kvBg && typeof layout.bg_r !== "number") { layout.bg_r = kvBg.r; ... }
// — teda presný, klientom vzorkovaný kvBackgroundColor() (overený proti
// #C55E4D v tests/kv-background-color.test.js) sa NIKDY nepoužil pri
// serverovej ceste (agent.js), lebo layout.bg_r už bolo číslo. branding_full
// je jediná rola, kde je brandColor() vidieť na celej ploche, preto tam bol
// bug najviditeľnejší — inde ho prekryla fotka.
// Oprava: agent.js už bg_r/bg_g/bg_b vôbec nenastavuje (žiadny natvrdý
// fallback), takže sa vždy použije presnejší klientsky kvBg vzorok.
//
// Bug #2 — plugin/code.js, buildBrandingSkinLayout (2000×1400): "Readability
// panel" (podložka za headline v oboch bočných stĺpcoch) mal natvrdo
// `BRAND_COLOR` (vždy navy), hoci pár riadkov vyššie v TEJ ISTEJ funkcii je
// už správne vypočítané `const edge = campaignSurface(layout);` a použité
// pre "Dim brand background". Namerané priamo na živom Figma výstupe
// (L6yFpLkKcHe9flUk3i11T1, node 32:2395): pozadie aj okraje korálové,
// "Readability panel" boxy (32:2401/32:2402) sýto navy — nesúlad v tej istej
// ploche. Oprava: `BRAND_COLOR` → `edge` (žiadna nová logika, len použitie
// premennej, čo už bola v scope).
const assert = require("assert");
const fs = require("fs");

const agentSrc = fs.readFileSync(require.resolve("../agent.js"), "utf8");
assert(!/bg_[rgb]\s*:/.test(agentSrc),
  "agent.js nesmie znova nastavovať layout.bg_r/g/b (natvrdo ani z visualAnalysis) — blokuje presnejší kvBg sampler v code.js");

const codeSrc = fs.readFileSync(require.resolve("../plugin/code.js"), "utf8");
assert(/if \(kvBg && typeof layout\.bg_r !== "number"\)/.test(codeSrc),
  "code.js musí ponechať kvBg-fallback guard — inak sa presný sampler nikdy nepoužije");

// ── simulácia celého reťazca: server layout BEZ bg_r + kvBg prítomný ───────
// (mirror brandColor() z plugin/code.js — CAMPAIGN_COLOR > layout.bg_r > BRAND_COLOR)
const BRAND_COLOR = { r: 0.0, g: 0.18, b: 0.55 }; // natvrdo modrá — presne ten bug, čo sa nesmie zobraziť
function brandColor(layout, CAMPAIGN_COLOR) {
  if (CAMPAIGN_COLOR) return CAMPAIGN_COLOR;
  if (layout && typeof layout.bg_r === "number") {
    return { r: layout.bg_r, g: layout.bg_g, b: layout.bg_b };
  }
  return BRAND_COLOR;
}

// Layout presne v tvare, aký po oprave posiela agent.js (bez bg_r/g/b vôbec).
const serverLayoutAfterFix = { layout_type: "branding_skin" };
const kvBg = { r: 197 / 255, g: 94 / 255, b: 77 / 255 }; // #C55E4D, klientsky vzorok

// code.js: if (kvBg && typeof layout.bg_r !== "number") { layout.bg_r = kvBg.r; ... }
if (kvBg && typeof serverLayoutAfterFix.bg_r !== "number") {
  serverLayoutAfterFix.bg_r = kvBg.r;
  serverLayoutAfterFix.bg_g = kvBg.g;
  serverLayoutAfterFix.bg_b = kvBg.b;
}

const finalColor = brandColor(serverLayoutAfterFix, null);
assert.deepStrictEqual(finalColor, kvBg,
  "bez CAMPAIGN_COLOR musí branding_full použiť presný kvBg vzorok, nie natvrdú modrú");
assert.notDeepStrictEqual(finalColor, BRAND_COLOR,
  "výsledná farba nesmie skončiť na natvrdo modrej BRAND_COLOR — presne to bol nahlásený bug");

// ── stará (pred-opravná) cesta pre porovnanie: keby agent.js bg_r nastavilo ─
// (dokumentuje PREČO bug vznikol — tento blok simuluje stav PRED opravou)
const serverLayoutBeforeFix = { layout_type: "branding_skin", bg_r: 0.1, bg_g: 0.1, bg_b: 0.18 };
if (kvBg && typeof serverLayoutBeforeFix.bg_r !== "number") {
  serverLayoutBeforeFix.bg_r = kvBg.r; // toto by sa NIKDY nespustilo pred opravou
}
const oldBuggyColor = brandColor(serverLayoutBeforeFix, null);
assert.notDeepStrictEqual(oldBuggyColor, kvBg,
  "kontrola predpokladu: pred opravou kvBg guard skutočne nikdy nezasiahol");

// ── Bug #2 regresia: buildBrandingSkinLayout musí "Readability panel"
// kresliť farbou campaignSurface(layout) (premenná `edge`), nie natvrdo
// BRAND_COLOR ────────────────────────────────────────────────────────────
const skinStart = codeSrc.indexOf("function buildBrandingSkinLayout");
const skinEnd = codeSrc.indexOf("\nfunction ", skinStart + 1);
assert(skinStart >= 0 && skinEnd > skinStart, "buildBrandingSkinLayout musí existovať v code.js");
const skinSrc = codeSrc.slice(skinStart, skinEnd);
assert(/const edge = campaignSurface\(layout\)/.test(skinSrc),
  "buildBrandingSkinLayout musí mať campaignSurface(layout) v premennej edge");
const readabilityPanelCall = skinSrc.slice(skinSrc.indexOf('"Readability panel"'));
assert(!/BRAND_COLOR/.test(readabilityPanelCall.slice(0, 200)),
  "Readability panel nesmie použiť natvrdo BRAND_COLOR — musí použiť edge (campaignSurface), rovnako ako Dim brand background v tej istej funkcii");
assert(/,\s*edge,\s*0\.82/.test(readabilityPanelCall.slice(0, 200)),
  "Readability panel musí byť vykreslený farbou edge (campaignSurface), nie natvrdou hodnotou");

// ── Bug #3 regresia (8.9.): "Dim brand background — left/right" v
// buildBrandingSkinLayout mali na vnútornom okraji (najbližšie k fotke)
// alfu 0,10, nie 0 — posledný pixel panelu niesol ešte 10% farby, hneď za
// hranicou obdĺžnika (kde panel vôbec neexistuje) bola alfa 0. Tento skok
// 0,10→0,00 presne na hranici bol viditeľná ostrá hrana, namerané na
// živom Figma výstupe (L6yFpLkKcHe9flUk3i11T1, node 33:3267). Oprava:
// gradient sa dotiahne na skutočnú 0 alfu presne na hranici obdĺžnika,
// nie maskovanie (to bolo raz vyskúšané — "c5b762a" — a v Figme sa
// vôbec nevykreslilo, viď komentár v code.js pri clean_image wide) ───────
const leftPanelSrc = skinSrc.slice(
  skinSrc.indexOf('"Dim brand background — left"'),
  skinSrc.indexOf('"Dim brand background — right"')
);
const rightPanelSrc = skinSrc.slice(skinSrc.indexOf('"Dim brand background — right"'));
const leftInnerEdgeAlpha = leftPanelSrc.match(/position:\s*1\.00,\s*color:\s*\{[^}]*a:\s*([\d.]+)/);
const rightInnerEdgeAlpha = rightPanelSrc.match(/position:\s*0\.00,\s*color:\s*\{[^}]*a:\s*([\d.]+)/);
assert(leftInnerEdgeAlpha, "Dim brand background — left musí mať gradient stop na position 1.00");
assert(rightInnerEdgeAlpha, "Dim brand background — right musí mať gradient stop na position 0.00");
assert.strictEqual(Number(leftInnerEdgeAlpha[1]), 0,
  "Dim brand background — left: alfa na vnútornom okraji (position 1.00, najbližšie k fotke) musí byť presne 0, inak vzniká skok na hranici panelu, got " + leftInnerEdgeAlpha[1]);
assert.strictEqual(Number(rightInnerEdgeAlpha[1]), 0,
  "Dim brand background — right: alfa na vnútornom okraji (position 0.00, najbližšie k fotke) musí byť presne 0, inak vzniká skok na hranici panelu, got " + rightInnerEdgeAlpha[1]);

console.log("campaign color fallback (branding_full navy box regression): ok");
