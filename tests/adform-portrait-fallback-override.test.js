// Regresia 9.9.2026 (MERANIE_adform_vs_PSD_8_9): resolveAdformPsdRules()
// mala pre adform_300x600 a adform_160x600, keď layout.asset_fallback_kind
// === "portrait" (KV odvodený z jediného nahraného mastera — teda takmer
// vždy, keď nikto nenahral samostatný portrétový variant), natvrdo
// prepísané panel/headline/headlineSize/cta/bankLogo/ai vlastnými ručne
// doladenými súradnicami — nezávisle od toho, čo hovorí ADFORM_PSD_RULES
// (odmerané priamo z PSD).
//
// Pixel-porovnanie exportov proti schváleným PSD artboardom
// (tests/visual-baselines/) potvrdilo rozdiel presne v CTA pozícii:
//   300×600: override cta=[20,455,124,42] vs. PSD cta=[20,496,140,48]
//            (o 41 px vyššie, o 16 px užšie, o 6 px nižšie)
//   160×600: override cta=[15,320,130,42] vs. PSD cta=[10,340,140,48]
//            (o 20 px vyššie, o 5 px vpravo)
// Fallback KV orientácie (portrét vs. štvorec) nemá dôvod hýbať CTA
// tlačidlom, headlineom, logom ani AI tagom — tie sú súčasťou PSD
// template geometrie, nezávislej od fotky. Override odstránený celý;
// rules teraz vždy vychádza priamo z ADFORM_PSD_RULES (resp. compactCopy
// variantu), bez ohľadu na asset_fallback_kind.
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync(require.resolve("../plugin/code.js"), "utf8");
const context = {};
vm.createContext(context);
vm.runInContext(
  source.slice(
    source.indexOf("const ADFORM_PSD_RULES"),
    source.indexOf("function addTemplateText")
  ) + "\nthis.__resolveAdformPsdRules = resolveAdformPsdRules;",
  context
);
const resolveAdformPsdRules = context.__resolveAdformPsdRules;
// vm.createContext má vlastný Array/Object realm — deepStrictEqual medzi
// hodnotami z rôznych realmov padá aj pri rovnakom obsahu; normalizuj cez JSON.
const j = (x) => JSON.parse(JSON.stringify(x === undefined ? null : x));

const longHeadlineContent = { headline: "Toto je zámerne dlhší headline text", badgeText: null, legalText: null };
const portraitLayout = { asset_fallback_kind: "portrait" };
const squareLayout = { asset_fallback_kind: null };

for (const templateId of ["adform_300x600", "adform_160x600"]) {
  const withPortraitFallback = resolveAdformPsdRules(templateId, longHeadlineContent, portraitLayout);
  const withoutFallback = resolveAdformPsdRules(templateId, longHeadlineContent, squareLayout);
  assert.deepStrictEqual(j(withPortraitFallback.cta), j(withoutFallback.cta),
    templateId + ": cta musí byť rovnaké bez ohľadu na asset_fallback_kind");
  assert.deepStrictEqual(j(withPortraitFallback.headline), j(withoutFallback.headline),
    templateId + ": headline musí byť rovnaké bez ohľadu na asset_fallback_kind");
  assert.strictEqual(withPortraitFallback.headlineSize, withoutFallback.headlineSize,
    templateId + ": headlineSize musí byť rovnaké bez ohľadu na asset_fallback_kind");
  assert.deepStrictEqual(j(withPortraitFallback.bankLogo), j(withoutFallback.bankLogo),
    templateId + ": bankLogo musí byť rovnaké bez ohľadu na asset_fallback_kind");
}

// Konkrétne nameraná regresia: CTA musí sedieť na PSD hodnotu, nie na
// starý override.
const r300 = resolveAdformPsdRules("adform_300x600", longHeadlineContent, portraitLayout);
assert.deepStrictEqual(j(r300.cta), [20, 496, 140, 48],
  "adform_300x600 CTA musí sedieť na ADFORM_PSD_RULES (namerané z PSD), got " + JSON.stringify(r300.cta));
assert.strictEqual(r300.panel, undefined,
  "adform_300x600 nemá v ADFORM_PSD_RULES panel — nesmie sa objaviť ani cez fallback override");

const r160 = resolveAdformPsdRules("adform_160x600", longHeadlineContent, portraitLayout);
assert.deepStrictEqual(j(r160.cta), [10, 340, 140, 48],
  "adform_160x600 CTA musí sedieť na ADFORM_PSD_RULES (namerané z PSD), got " + JSON.stringify(r160.cta));
assert.deepStrictEqual(j(r160.panel), [0, 310, 160, 290],
  "adform_160x600 panel musí sedieť na ADFORM_PSD_RULES, got " + JSON.stringify(r160.panel));

// ── Regresia #2 (9.9., objavená priamo po prvej oprave): keď panel zmizol,
// adform_300x600 padá na celoplošný takmer čierny "Bottom readability
// gradient" (addAdformBackgroundTreatment) — ale pickLogoForLayout() vyberá
// biele/tmavé logo podľa farby FOTKY, nie podľa tohto scrimu navrchu.
// Namerané na živom výstupe (node 47:404): tmavé logo takmer nečitateľné
// na tmavom scrime. 300×250 má rovnaký typ scrimu, ale len na ľavej
// strane — logo (x=215) sedí mimo neho (overené screenshotom), takže
// výnimka sa týka len 300×600. ──────────────────────────────────────────
const adformDispatchStart = source.indexOf('layoutType === "adform_psd"');
const adformDispatchEnd = source.indexOf("} else if (", adformDispatchStart);
const adformDispatchSrc = source.slice(adformDispatchStart, adformDispatchEnd);
assert(/localAdformTemplate === "adform_300x600" && figmaLogoWhite/.test(adformDispatchSrc),
  "adform_300x600 musí vynútiť biele logo, keď je k dispozícii — inak je logo nečitateľné na čiernom scrime");
assert(/buildAdformPsdLayout\([^;]*,\s*adformLogo\s*,\s*localAdformTemplate\)/.test(adformDispatchSrc),
  "buildAdformPsdLayout sa musí volať s prepočítaným adformLogo, nie priamo s pôvodným figmaLogo");

console.log("adform portrait-fallback override (PSD geometry regression): ok");
