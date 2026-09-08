// Regresia 8.9.2026: "modré tabuľky" na branding_full (2000×1400,
// markíza/tvnoviny/joj) — brandColor() vždy skončil na natvrdo modrej.
//
// Príčina bola v agent.js: `bg_r: visualAnalysis.bg_r || 0.1` (a rovnako
// bg_g/bg_b) VŽDY vrátilo číslo — či už reálnu AI-vzorkovanú hodnotu, alebo
// natvrdo (0.1, 0.1, 0.18), teda tmavú navy. Toto číslo (aj ten fallback)
// sa poslalo do plugin/code.js ako layout.bg_r. Tam ale platí:
//   if (kvBg && typeof layout.bg_r !== "number") { layout.bg_r = kvBg.r; ... }
// — teda presný, klientom vzorkovaný kvBackgroundColor() (overený proti
// #C55E4D v tests/kv-background-color.test.js) sa NIKDY nepoužil pri
// serverovej ceste (agent.js), lebo layout.bg_r už bolo číslo. branding_full
// je jediná rola, kde je brandColor() vidieť na celej ploche, preto tam bol
// bug najviditeľnejší — inde ho prekryla fotka.
//
// Oprava: agent.js už bg_r/bg_g/bg_b vôbec nenastavuje (žiadny natvrdý
// fallback), takže sa vždy použije presnejší klientsky kvBg vzorok.
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

console.log("campaign color fallback (branding_full navy box regression): ok");
