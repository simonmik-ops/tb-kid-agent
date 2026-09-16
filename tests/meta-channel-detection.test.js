// 16.9. — isMetaChannel v createAllFrames porovnávalo kanál presnou rovnosťou
// s "meta". V katalógu majú Meta formáty kanál presne "Meta", takže sa bug
// neprejavil. Reálny Excel od mediálky ale posiela kanál v znení z TP, napr.
// "Meta (Facebook & Instagram) - Automatic placements" — rovnosť zlyhala,
// isMetaSquare/isMetaWide/isMetaPortrait boli všetky false a kreslil sa
// generický master_safe namiesto Meta kompozície (commit 2c1f910 sa
// preskočil). Namerané na sade 16.9. (Figma 252:27560): 1080×1920 malo KV
// 1080×1080 @0,0, panel y=1080 — presne pred-2c1f910 stav.
//
// Oprava testuje kanál cez prefix "meta" (case/trim-insensitive) ALEBO rolu
// meta_full, aby nezáležalo na presnom znení kanála z Excelu.
const assert = require("assert");
const fs = require("fs");

const source = fs.readFileSync(require.resolve("../plugin/code.js"), "utf8");
const NORMALIZED_FORMATS = require("../formats.js");

// a) starý presný-rovnosťový vzor už nesmie byť v zdroji
assert(
  !/const isMetaChannel = String\(format\.channel[^)]*\)\.toLowerCase\(\) === "meta";/.test(source),
  "the old exact-equality isMetaChannel pattern must be gone"
);

// b) nový prefix-test musí byť v zdroji
assert(source.includes('metaChannelName.indexOf("meta") === 0'),
  "isMetaChannel must detect the channel via a \"meta\" prefix, not exact equality");

// c) rola meta_full musí byť tiež zohľadnená
assert(source.includes('String(format.role || "") === "meta_full"'),
  "isMetaChannel must also treat role meta_full as Meta, regardless of channel wording");

// d) rovnaká logika, reprodukovaná v teste, na priame prípady
function jeMeta(format) {
  const kanal = String(format.channel || "").trim().toLowerCase();
  return kanal.indexOf("meta") === 0 || String(format.role || "") === "meta_full";
}

const musiaByt = [
  { channel: "Meta", role: "meta_full" },
  { channel: "Meta (Facebook & Instagram) - Automatic placements", role: "meta_full" },
  { channel: "", role: "meta_full" }
];
for (const f of musiaByt) {
  assert.strictEqual(jeMeta(f), true, "must detect Meta for " + JSON.stringify(f));
}

const nesmiuByt = [
  { channel: "Google DemandGen", role: "full_creative" },
  { channel: "Google PMax", role: "headline_only" },
  { channel: "Social", role: "publisher_branding" },
  { channel: "Adform", role: "publisher_branding" }
];
for (const f of nesmiuByt) {
  assert.strictEqual(jeMeta(f), false, "must NOT detect Meta for " + JSON.stringify(f));
}

// e) na celom katalógu (152 formátov) musí nová detekcia dávať rovnaký
// výsledok ako STARÝ presný test s "meta" — počet rozdielov musí byť 0,
// pretože katalóg sám vždy nesie kanál presne "Meta" pre Meta formáty.
let rozdiely = 0;
for (const format of NORMALIZED_FORMATS) {
  const stary = String(format.channel || "").toLowerCase() === "meta";
  const novy = jeMeta(format);
  if (stary !== novy) {
    rozdiely++;
    console.log("rozdiel:", format.id, JSON.stringify({ channel: format.channel, role: format.role }));
  }
}
assert.strictEqual(NORMALIZED_FORMATS.length, 152,
  "expected the catalog to have 152 formats, got " + NORMALIZED_FORMATS.length);
assert.strictEqual(rozdiely, 0,
  "new Meta detection must match the old exact-equality result on every catalog format (0 differences), got " + rozdiely);

console.log("meta channel detection (16.9.): ok");
