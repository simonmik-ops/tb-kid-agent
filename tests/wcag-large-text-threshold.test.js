// P0-16 dodatok, 9.9.2026: headline/subheadline (buildMasterSafeLayout —
// wide/portrait/scrim vetvy) sú vždy veľký tučný text (TB.headline()/
// TB.subheadline()), WCAG 2.1 pre ne vyžaduje len 3:1, nie 4,5:1 (ten platí
// pre malý text — legal/AI tag/prelepka, ktoré tú istú plochu zdieľajú).
// Predtým sa kontrolovalo len 4,5:1 (small_text) — headline/subheadline
// nemali ŽIADNU kontrastnú kontrolu vôbec.
//
// Dôležité: toto NIE JE aktívna oprava (nestmavuje plochu) — v kóde je
// explicitné pravidlo "Krok 3 pravidlo 2: panel sa NESMIE stmavovať kvôli
// kontrastu" (stmavenie korálovej dávalo bahnistú hnedú, nahlásené a
// zakázané v skoršej revízii). Je to len QA hlásenie navyše, rovnaký vzor
// ako existujúci small_text check — plocha (campaignSurface(layout))
// zostáva presne rovnaká, nemenená.
//
// Samostatný prípad: buildMicroLayout kreslí LEN headline (bez CTA/
// subheadline/prelepky — komentár funkcie to hovorí priamo), takže tam
// nejde o "pridanie" veľký-text kontroly vedľa small_text, ale o OPRAVU
// existujúcej (jedinej) kontroly z 4,5 na 3,0 — 4,5 tam bolo vecne
// nesprávne, žiadny malý text sa tam nekontroluje.
const assert = require("assert");
const fs = require("fs");

const source = fs.readFileSync(require.resolve("../plugin/code.js"), "utf8");

for (const name of ["wide_panel_headline_text", "portrait_panel_headline_text", "scrim_headline_text"]) {
  assert(new RegExp('noteContrastIfLow\\([\\s\\S]*?3\\.0,\\s*"' + name + '"[\\s\\S]*?\\)').test(source),
    name + " musí byť kontrolovaný na prahu 3.0 (WCAG veľký text)");
}
// Small-text kontroly musia zostať nezmenené na 4.5.
for (const name of ["wide_panel_small_text", "portrait_panel_small_text", "scrim_small_text"]) {
  assert(new RegExp('noteContrastIfLow\\([\\s\\S]*?4\\.5,\\s*"' + name + '"[\\s\\S]*?\\)').test(source),
    name + " musí zostať na prahu 4.5 (WCAG malý text) — nezmenené");
}

// buildMicroLayout: jediná kontrola tam musí byť opravená na 3.0 (nie
// pridaná navyše — 4.5 už tam nesmie zostať, keďže žiadny small_text sa
// tam nekontroluje).
const microStart = source.indexOf("function buildMicroLayout");
const microEnd = source.indexOf("\nfunction ", microStart + 1);
const microSrc = source.slice(microStart, microEnd);
assert(/noteContrastIfLow\([\s\S]*?3\.0,\s*"micro_headline_text"[\s\S]*?\)/.test(microSrc),
  "buildMicroLayout musí kontrolovať headline na prahu 3.0");
assert(!/noteContrastIfLow\([\s\S]*?4\.5/.test(microSrc),
  "buildMicroLayout nesmie mať žiadnu 4.5 kontrolu — nemá žiadny malý text");

// Pravidlo "panel sa nesmie stmavovať kvôli kontrastu" musí zostať
// nedotknuté — campaignSurface(layout) sa nesmie meniť na
// ensureReadableSurface(...) ani inú tmaviacu funkciu pri priradení do
// frame.fills / panel.fills v master_safe wide/portrait/scrim vetvách.
assert(source.includes("const brand = campaignSurface(layout);"),
  "wide panel farba musí zostať čistá campaignSurface(layout), bez stmavovania");
assert(source.includes("const portraitPanelColor = campaignSurface(layout);"),
  "portrait panel farba musí zostať čistá campaignSurface(layout), bez stmavovania");
assert(source.includes("const scrimBrand = campaignSurface(layout);"),
  "scrim farba musí zostať čistá campaignSurface(layout), bez stmavovania");

console.log("WCAG large-text threshold (P0-16): ok");
