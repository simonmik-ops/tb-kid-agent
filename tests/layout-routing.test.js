// Zadanie 26.8, blok G / P0-30 korekcia: master_safe je "univerzálny
// fallback" (useMasterSafe = true, vždy) a ticho prebral formáty, ktoré mali
// vlastný dedikovaný builder bez KV cropu — branding_leader_text a
// branding_leader_full chýbali v masterExcludedLayouts. Namerané na živom
// výstupe: markiza_branding_leader (1000×200) skončil s master_safe cropom
// (hlava modelky odrezaná) a master_safe headline boxom (295×18 px) namiesto
// buildBrandingLeaderTextLayout, ktorý žiaden crop nerobí a headline sadzí
// vlastným vzorcom (format.height*0,24, plná šírka, vertikálne centrované).
//
// Tento test extrahuje presne ten istý rozhodovací blok zo zdroja (nie
// ručne prekopírovanú kópiu) a overuje smerovanie pre konkrétne KID
// formáty spomenuté v zadaní.
const assert = require("assert");
const fs = require("fs");

const source = fs.readFileSync(require.resolve("../plugin/code.js"), "utf8");
const start = source.indexOf("const masterExcludedLayouts = [");
const end = source.indexOf(";", source.indexOf("const layoutType = hasLocalAdformTemplate", start)) + 1;
assert(start >= 0 && end > start, "layout routing decision block must exist");
const snippet = source.slice(start, end);

function resolveLayoutType(backendLayoutType, format, hasLocalAdformTemplate) {
  const useMasterSafe = true;
  const body = snippet + "\nreturn layoutType;";
  return new Function("backendLayoutType", "format", "hasLocalAdformTemplate", "useMasterSafe", body)(
    backendLayoutType, format, hasLocalAdformTemplate, useMasterSafe
  );
}

// markiza_branding_leader — 1000×200, role branding_leader_text.
assert.strictEqual(
  resolveLayoutType("branding_leader_text", { width: 1000, height: 200 }, false),
  "branding_leader_text",
  "1000×200 branding_leader_text must keep its own builder, not fall through to master_safe"
);

// ringier_leaderboard — 1200×400, role branding_leader_full.
assert.strictEqual(
  resolveLayoutType("branding_leader_full", { width: 1200, height: 400 }, false),
  "branding_leader_full",
  "1200×400 branding_leader_full must keep its own builder, not fall through to master_safe"
);

// zenske_branding_top — 1200×200, role branding_leader_text.
assert.strictEqual(
  resolveLayoutType("branding_leader_text", { width: 1200, height: 200 }, false),
  "branding_leader_text",
  "1200×200 branding_leader_text (Ženské weby TOP) must keep its own builder"
);

// Regresná poistka: formáty, ktoré master_safe naozaj má pokrývať (napr.
// Meta 1200×1200, backendLayoutType full_bleed/master_safe), musia doň
// stále smerovať — táto oprava sa týka len branding_leader_*.
assert.strictEqual(
  resolveLayoutType("master_safe", { width: 1200, height: 1200 }, false),
  "master_safe",
  "genuine master_safe formats must be unaffected by the branding_leader_* exclusion"
);

console.log("layout routing (branding_leader_* excluded from master_safe fallback): ok");
