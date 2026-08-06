const assert = require("assert");
const fs = require("fs");

const html = fs.readFileSync(require.resolve("../plugin/ui.html"), "utf8");
const start = html.indexOf("function normalizedCell");
const end = html.indexOf("function renderExcelReview", start);
assert.ok(start >= 0 && end > start, "Excel parser functions must exist in ui.html");
const source = html.slice(start, end);

const XLSX = { utils: { sheet_to_json: (sheet) => sheet.rows } };
const api = new Function("XLSX", source + "; return { extractDims, deliverableDimensions, roleFromContext, materializeExcelFormat };")(XLSX);

const workbook = {
  SheetNames: ["PPC", "TP"],
  Sheets: {
    PPC: { rows: [
      ["FÁZA", "FORMÁT", "PODKLADY", "ROZMERY", "ŠPECIFIKÁCIE", "DODATOČNÉ INFO"],
      ["Awareness", "Adform", "IAB banners", "300x250, 300x600, 160x600, 970x250", "100 kB", ""],
      ["Performance", "Google - Responsive ads", "obrázok", "1200x628 (minimum 600x314)\n1200x1200\n900x1600", "max 5 MB", "obrázky bez textu"],
      ["", "", "logo", "1200x1200 (minimum 128x128)\n1200x300 (minimum 512x128)", "max 5 MB", "transparentné pozadie"],
      ["", "Google - Demand gen", "Video", "1920x1080, 1080x1080, 1080x1920", "URL", ""],
      ["", "", "obrázok - single image", "1200x628 (minimum 600x314)\n960x1200 (minimum 480x600)", "", "kompletné"],
    ]},
    TP: { rows: [
      ["Supplier", "Placement", "Format", "Resolution (px)", "Data limits", "Technical specification"],
      ["Publisher", "pravda.sk", "branding / interscroller", "1200x200+2x200x700\n300x600 - safe area 50px left + 50px right", "250 kB", ""],
      ["Publisher", "cas.sk", "interscroller", "recommended size 750x1624 with center safe zone 750x982. Min resolution is 375x812 with center safe zone 375x491", "100 kB", ""],
    ]}
  }
};

const parsed = api.extractDims(workbook);
const keys = parsed.map((item) => item.w + "x" + item.h + ":" + item.roleHint);

for (const expected of [
  "300x250:full_creative", "300x600:full_creative", "160x600:full_creative", "970x250:full_creative",
  "1200x628:clean_image", "1200x1200:clean_image", "900x1600:clean_image",
  "1200x1200:logo_only", "1200x300:logo_only",
  "1200x628:full_creative", "960x1200:full_creative",
  "1200x200:branding_full", "200x700:branding_side", "300x600:interscroller",
  "750x1624:interscroller"
]) assert.ok(keys.includes(expected), "missing " + expected + " in " + keys.join(", "));

for (const forbidden of ["600x314", "128x128", "512x128", "1920x1080", "1080x1080", "1080x1920", "750x982", "375x812", "375x491", "480x600"]) {
  assert.ok(!parsed.some((item) => item.w + "x" + item.h === forbidden), "must not import helper/video dimension " + forbidden);
}

const sameSizeA = api.materializeExcelFormat({
  w: 1200, h: 628, placement: "Google Responsive Ads", assetType: "obrázok", roleHint: "clean_image",
  candidates: [{ id: "tpl_clean_landscape", channel: "Clean assets", role: "clean_image", width: 1200, height: 628 }],
  selectedId: "tpl_clean_landscape"
}, 0);
const sameSizeB = api.materializeExcelFormat({
  w: 1200, h: 628, placement: "Google Demand Gen", assetType: "single image", roleHint: "full_creative",
  candidates: [{ id: "tpl_full_landscape", channel: "Performance", role: "full_creative", width: 1200, height: 628 }],
  selectedId: "tpl_full_landscape"
}, 1);
assert.strictEqual(sameSizeA.format.channel, "Google Responsive Ads");
assert.strictEqual(sameSizeB.format.channel, "Google Demand Gen");
assert.notStrictEqual(sameSizeA.format.baseId, sameSizeB.format.baseId, "same dimensions from different placements must not deduplicate");

const adform = api.materializeExcelFormat({
  w: 300, h: 250, placement: "Adform", assetType: "IAB banner", roleHint: "full_creative", candidates: []
}, 2);
assert.strictEqual(adform.format.template, "adform_300x250");

console.log("Excel semantic parser: ok");
