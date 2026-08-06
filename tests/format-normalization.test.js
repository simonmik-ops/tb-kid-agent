const assert = require("assert");
const FORMATS = require("../formats");
const { getCreativeRule } = require("../campaign-rules");

assert.strictEqual(FORMATS.length, 143, "catalog size must stay stable");

for (const format of FORMATS) {
  assert.ok(format.role, format.id + " must have a role");
  assert.ok(format.rules, format.id + " must have rules");
  assert.ok(format.safeBox, format.id + " must have safeBox");
  assert.ok(Array.isArray(format.deadZones), format.id + " must have deadZones");
  assert.ok(Object.prototype.hasOwnProperty.call(format, "template"), format.id + " must have template");
  ["top", "right", "bottom", "left"].forEach((edge) => {
    assert.ok(Number.isFinite(format.safeBox[edge]), format.id + " safeBox." + edge + " must be numeric");
  });
}

const staticMeta45 = FORMATS.filter((f) => /meta_img_4x5$/.test(f.id));
assert.ok(staticMeta45.length > 1, "expected campaign-specific Meta 4:5 formats");
staticMeta45.forEach((format) => {
  assert.deepStrictEqual([format.width, format.height], [1200, 1628], format.id + " must follow TP");
});

assert.strictEqual(FORMATS.find((f) => f.id === "topky_branding").name, "Topky branding 450×800");
assert.strictEqual(FORMATS.find((f) => f.id === "bsu_adform_300x250").template, "adform_300x250");
assert.strictEqual(FORMATS.find((f) => f.id === "hyp_adform_970x250").template, "adform_970x250");
assert.strictEqual(getCreativeRule(FORMATS.find((f) => f.id === "hyp_google_rsa_landscape")).id, "clean_image");
assert.strictEqual(getCreativeRule(FORMATS.find((f) => f.id === "bsu_google_logo_square")).id, "logo_only");
assert.strictEqual(getCreativeRule(FORMATS.find((f) => f.id === "tig_demandgen_landscape")).id, "full_creative");

for (const id of ["engerio_native", "kkv_engerio_native", "bsu_engerio_native"]) {
  const format = FORMATS.find((f) => f.id === id);
  assert.ok(format, id + " must exist");
  assert.deepStrictEqual([format.width, format.height, format.ratio], [600, 400, "3:2"], id + " must follow current Engerio rules");
  assert.strictEqual(format.rules.noText, true, id + " must not bake text into the image");
  assert.strictEqual(format.rules.noLogo, true, id + " must not bake a logo into the image");
}

console.log("format normalization: ok");
