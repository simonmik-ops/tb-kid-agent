// Regresia 10.9.2026 (zadanie C): subheadline gate malo len jeden hardcoded
// boolean per profil (resolveCreativeRule) a ZIADEN sposob, ako vo Validation
// reporte odlisit "formát to naozaj nemá mať" (headline_only/PMax — dizajn to
// potvrdzuje) od "nevieme, lebo chýba predloha" (branding_full/branding_side/
// interscroller/branding_leader_*/email — Surďova Figma tieto kanály vôbec
// neobsahuje). Oba prípady vyzerali navonok identicky (subheadline: false,
// žiadne hlásenie).
//
// Táto oprava PRIDÁVA SUBHEADLINE_POLICY (required/allowed/forbidden/
// conflict/unknown) a QA hlásenie qa_subheadline_policy_unknown/_conflict,
// ale NEMENÍ existujúce hardcoded false hodnoty (explicitná inštrukcia:
// "hardcoded false NEODSTRAŇUJ"). Test preto overuje DVE veci:
//   1. Adform predtým padalo na profil "publisher_branding" cez náhodný
//      catch-all fallback (žiadna vlastná vetva) — teraz má vlastný
//      explicitný profil "adform_psd" s rovnakými hodnotami (žiadna zmena
//      SPRÁVANIA, len explicitná namiesto náhodnej). FAIL pred opravou:
//      creativeRule.id by bolo "publisher_branding", nie "adform_psd".
//   2. Validation report teraz rozlišuje "unknown — čaká na predlohu"
//      (branding_side a pod.) od skutočne dizajnom potvrdeného "forbidden"
//      (headline_only/PMax) — oba dnes vyzerajú v.show_subheadline rovnako
//      (false), ale nová QA kontrola ich odlišuje. FAIL pred opravou:
//      qa_subheadline_policy_unknown by v issues neexistovalo vôbec
//      (subheadlinePolicyFor nebola definovaná).
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync(require.resolve("../plugin/code.js"), "utf8");

function makeNode() {
  const node = {
    name: "", x: 0, y: 0, width: 0, height: 0, fills: [], children: [], visible: true,
    fontName: null, fontSize: 0, characters: "", textAutoResize: "NONE",
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
vm.runInContext(
  source +
    "\nthis.resolveCreativeRule = resolveCreativeRule;" +
    "\nthis.subheadlinePolicyFor = subheadlinePolicyFor;" +
    "\nthis.validateGeneratedFrame = validateGeneratedFrame;",
  context
);

// ── 1) Adform dostáva vlastný explicitný profil, nie náhodný fallback ───
const adformRule = vm.runInContext(
  "resolveCreativeRule({ id: \"adform_300x600\", channel: \"Adform\", width: 300, height: 600 });",
  context
);
assert.strictEqual(adformRule.id, "adform_psd",
  "Adform must resolve to its own explicit profile id, not the accidental publisher_branding catch-all, got " +
  JSON.stringify(adformRule));
assert.strictEqual(adformRule.subheadline, true,
  "Adform's subheadline behaviour must stay unchanged (true), got " + adformRule.subheadline);

// Vinted 300×600/970×250 sú Adform PSD aliasy (ADFORM_PSD_ALIASES) — musia
// dostať ten istý explicitný profil, nie zvyšné Vinted formáty (300×250 atď,
// ktoré NEMAJÚ lokálnu Adform šablónu).
const vintedAliasRule = vm.runInContext(
  "resolveCreativeRule({ id: \"vinted_300x600\", channel: \"Vinted\", width: 300, height: 600 });",
  context
);
assert.strictEqual(vintedAliasRule.id, "adform_psd",
  "Vinted 300x600 (Adform PSD alias) must resolve to adform_psd, got " + vintedAliasRule.id);

const vintedPlainRule = vm.runInContext(
  "resolveCreativeRule({ id: \"vinted_300x250\", channel: \"Vinted\", width: 300, height: 250 });",
  context
);
assert.notStrictEqual(vintedPlainRule.id, "adform_psd",
  "Vinted 300x250 (no local Adform template) must NOT be misclassified as adform_psd, got " + vintedPlainRule.id);

// ── 2) SUBHEADLINE_POLICY klasifikuje referenčné rodiny, ostatné "unknown" ──
function policyFor(id) {
  context.__profileId = id;
  return vm.runInContext("subheadlinePolicyFor(__profileId);", context);
}
assert.strictEqual(policyFor("meta_full"), "allowed", "Meta must be 'allowed' (has a design reference)");
assert.strictEqual(policyFor("full_creative"), "allowed", "Google DemandGen must be 'allowed'");
assert.strictEqual(policyFor("adform_psd"), "allowed", "Adform must be 'allowed'");
assert.strictEqual(policyFor("headline_only"), "forbidden", "Google PMax must be 'forbidden' (design confirms headline-only)");
assert.strictEqual(policyFor("clean_image"), "conflict", "Google RSA must be 'conflict' (unresolved 3-way source conflict), not silently decided");
for (const unresolved of ["branding_full", "branding_side", "branding_leader_text", "branding_leader_full", "interscroller", "email", "publisher_branding"]) {
  assert.strictEqual(policyFor(unresolved), "unknown",
    unresolved + " has no design reference in Surďova Figma — must be 'unknown', not silently 'forbidden', got " + policyFor(unresolved));
}

// ── 3) Validation report surfaces "unknown"/"conflict" distinctly, without
// touching the existing hardcoded-false gate (subheadline stays absent
// either way — only the QA code differs).
function runQa(layoutType, creativeProfile, hasSubheadlineText) {
  const frame = makeNode();
  frame.width = 1200; frame.height = 1200; frame.clipsContent = true;
  const layout = { creative_profile: creativeProfile, show_subheadline: false };
  const content = {
    headline: "Investovanie", subheadline: hasSubheadlineText ? "Od 50 eur mesačne." : null,
    ctaText: null, legalText: null, badgeText: null, hasLogo: false
  };
  context.__frame = frame; context.__format = { width: 1200, height: 1200 };
  context.__layout = layout; context.__content = content;
  return vm.runInContext(
    "validateGeneratedFrame(__frame, __format, __layout, \"" + layoutType + "\", __content, null);",
    context
  );
}

const unknownQa = runQa("branding_skin", "branding_full", true);
assert(unknownQa.issues.includes("qa_subheadline_policy_unknown"),
  "branding_full with supplied subheadline text must surface qa_subheadline_policy_unknown, got " + JSON.stringify(unknownQa.issues));

const conflictQa = runQa("clean_image", "clean_image", true);
assert(conflictQa.issues.includes("qa_subheadline_policy_conflict"),
  "clean_image with supplied subheadline text must surface qa_subheadline_policy_conflict, got " + JSON.stringify(conflictQa.issues));

const forbiddenQa = runQa("master_safe", "headline_only", true);
assert(!forbiddenQa.issues.includes("qa_subheadline_policy_unknown") && !forbiddenQa.issues.includes("qa_subheadline_policy_conflict"),
  "headline_only (genuinely forbidden by design, not unknown) must NOT surface either policy code, got " + JSON.stringify(forbiddenQa.issues));

const noTextQa = runQa("branding_skin", "branding_full", false);
assert(!noTextQa.issues.includes("qa_subheadline_policy_unknown"),
  "without any supplied subheadline text there is nothing to flag, got " + JSON.stringify(noTextQa.issues));

console.log("subheadline required/allowed/forbidden/unknown policy table (zadanie C): ok");
