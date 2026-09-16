// Regresia 13.9.2026 (logo zadanie, systémová oprava #1, pokračovanie
// tests/logo-variant-background-source.test.js): campaignSurface(layout)
// je správny predvolený zdroj farby pre VÄČŠINU builderov (side_safe,
// branding_skin, interscroller, branding_leader_full, full_bleed, adform
// non-300x600, master_safe wide/square/portrait) — ale DVA layoutType majú
// systematicky INÉ pozadie, ktoré by campaignSurface nesprávne odhadol:
//
//   - email_layout: logo sedí na "Content area", VŽDY plnej bielej
//     (addSolidRect biela, nezávisle od kampanovej farby) — musí dostať
//     explicitný biely bgOverride, inak by na tmavú/farebnú kampaň
//     dostalo (nesprávne) biele logo na bielom pozadí.
//   - logo_only: kreslí na priehľadné plátno (frame.fills = []) — otvorená
//     otázka P2-7 (Surďovi, 5.8., stále nezodpovedaná), ktorú predchádzajúce
//     zadanie výslovne zakázalo riešiť. Musí si zachovať PÔVODNÝ zdroj
//     (brandEdgeColor), nech táto oprava jeho výsledok nezmení.
//
// Overené priamo v zdroji (orchestrácia je async closure v createAllFrames,
// nedá sa volať izolovane) — rovnaký prístup ako ostatné testy v tejto
// sérii pre uzavreté closures.
const assert = require("assert");
const fs = require("fs");

const source = fs.readFileSync(require.resolve("../plugin/code.js"), "utf8");

const start = source.indexOf("const logoBgOverride =");
const end = source.indexOf(";\n      figmaLogo = pickLogoForLayout", start) + 1;
const overrideSrc = source.slice(start, end);

assert(overrideSrc.includes('layoutType === "email_layout" ? { r: 1, g: 1, b: 1 }'),
  "email_layout must override to an explicit white background (its logo always sits on a solid white " +
  "Content area, never the campaign colour), got:\n" + overrideSrc);
assert(overrideSrc.includes('layoutType === "logo_only" ? brandEdgeColor(layout, "bottom")'),
  "logo_only must keep its original brandEdgeColor-based source unchanged (P2-7 is an open question, " +
  "explicitly not to be decided here), got:\n" + overrideSrc);
assert(source.includes("figmaLogo = pickLogoForLayout(layout, logoBgOverride);"),
  "the orchestration call site must pass the resolved override through to pickLogoForLayout");

console.log("logo variant per-layout background override (email=white, logo_only=unchanged): ok");
