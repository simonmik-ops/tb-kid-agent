// Regresia 10.9.2026 (P0-40 C1): keď formát deklaruje publisher safe zónu
// (safeZones.centerWidth+topOffset — Markíza/JOJ 2000×1400, kde web
// publishera prekryje stred KV), validácia doteraz o tom vôbec nevedela —
// KV subjekt mohol ležať prevažne pod prekrytou zónou a Validation report
// by to nikdy neoznačil.
//
// Plugin nevidí obsah fotky (kde presne je tvár/produkt) — toto je preto
// GEOMETRICKÝ odhad (deklarovaná centrálna zóna >= 50 % šírky formátu),
// nie skutočná detekcia subjektu. Vedomé, Simonou potvrdené riziko:
// "Games branding" (1920×1080) má tiež centerWidth >= 50 % šírky, ale jeho
// stred je ZÁMERNE prázdny (herná plocha, nie skrytý subjekt) — táto
// kontrola ho označí tiež, hoci nejde o chybu. Preto je to len hlásenie na
// ručné overenie (qa_publisher_zone_subject_risk), nie tichý predpoklad.
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync(require.resolve("../plugin/code.js"), "utf8");

function makeNode() {
  const node = {
    name: "", x: 0, y: 0, width: 0, height: 0, fills: [], children: [], visible: true,
    fontName: null, fontSize: 0, characters: "", textAutoResize: "NONE", opacity: 1,
    resize: function (w, h) { this.width = w; this.height = h; },
    appendChild: function (child) { child.parent = this; this.children.push(child); },
    remove: function () {},
    findOne: function () { return null; },
    findAll: function () { return []; }
  };
  return node;
}

const context = {
  __html__: "<html></html>",
  figma: {
    createRectangle: makeNode, createFrame: makeNode, createText: makeNode,
    showUI: function () {}, closePlugin: function () {},
    ui: { onmessage: null, postMessage: function () {} },
    root: { children: [] }, currentPage: { children: [] }
  },
  console: console
};
vm.createContext(context);
vm.runInContext(source + "\nthis.validateGeneratedFrame = validateGeneratedFrame;", context);

function runQa(format) {
  const frame = makeNode();
  frame.width = format.width; frame.height = format.height;
  frame.clipsContent = true;
  const layout = {};
  const content = { headline: null, subheadline: null, ctaText: null, legalText: null, badgeText: null, hasLogo: false };
  context.__frame = frame; context.__format = format; context.__layout = layout; context.__content = content;
  return vm.runInContext(
    "validateGeneratedFrame(__frame, __format, __layout, \"branding_skin\", __content, null);",
    context
  );
}

// Markíza/JOJ 2000×1400 (formats.js: safeZones {centerWidth:1000, topOffset:200})
const markiza = runQa({ width: 2000, height: 1400, safeZones: { centerWidth: 1000, topOffset: 200 } });
assert(markiza.issues.includes("qa_publisher_zone_subject_risk"),
  "2000x1400 Markíza/JOJ (centerWidth 50% of width) must flag qa_publisher_zone_subject_risk, got " + JSON.stringify(markiza.issues));

// Games branding 1920×1080 (formats.js: safeZones {centerWidth:1000, topOffset:100})
// — vedomý falošný poplach, potvrdený Simonou (stred je herná plocha).
const games = runQa({ width: 1920, height: 1080, safeZones: { centerWidth: 1000, topOffset: 100 } });
assert(games.issues.includes("qa_publisher_zone_subject_risk"),
  "1920x1080 Games branding is a KNOWN/accepted false positive (center is the game area, not a hidden subject) — " +
  "still expected to flag, since the plugin cannot distinguish it geometrically, got " + JSON.stringify(games.issues));

// Bežný formát bez publisher safe zóny nesmie nikdy dostať toto hlásenie.
const normal = runQa({ width: 1200, height: 628, safeZones: { top: 0, bottom: 0 } });
assert(!normal.issues.includes("qa_publisher_zone_subject_risk"),
  "1200x628 (no centerWidth safe zone) must not flag qa_publisher_zone_subject_risk, got " + JSON.stringify(normal.issues));

// Malá centrálna zóna (< 50% šírky) nesmie flagovať — riziko prekrytia
// subjektu je nízke.
const smallZone = runQa({ width: 2000, height: 1400, safeZones: { centerWidth: 400, topOffset: 200 } });
assert(!smallZone.issues.includes("qa_publisher_zone_subject_risk"),
  "safe zone under 50% of width must not flag qa_publisher_zone_subject_risk, got " + JSON.stringify(smallZone.issues));

console.log("qa_publisher_zone_subject_risk (P0-40 C1): ok");
