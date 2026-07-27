const assert = require("assert");
const { TEMPLATE_GROUPS, getRequestedFormats } = require("../template-library");
const { getCreativeRule } = require("../campaign-rules");
const { getLayoutStrategy } = require("../agent");

const VISUAL = { bg_r: 0.1, bg_g: 0.2, bg_b: 0.3 };
const RECIPE = {
  visualType: "centered_subject",
  subjectPosition: "center",
  cropMode: "protect_subject",
  smallFormatMode: "brand_panel",
  textMode: "auto",
  logoMode: "auto",
  masterSafeMode: true
};

assert.strictEqual(TEMPLATE_GROUPS.length, 5);
assert.strictEqual(getRequestedFormats([]).length, 0);

function inspect(groupId) {
  const formats = getRequestedFormats([groupId]);
  assert(formats.length > 0, `Missing formats for ${groupId}`);
  return formats.map(format => ({
    format,
    rule: getCreativeRule(format),
    layout: getLayoutStrategy(format, VISUAL, RECIPE)
  }));
}

for (const item of inspect("meta_full")) {
  assert.strictEqual(item.rule.id, "meta_full");
  assert.strictEqual(item.layout.layout_type, "master_safe");
  assert.strictEqual(item.layout.show_headline, true);
  assert.strictEqual(item.layout.show_cta, false);
  assert.strictEqual(item.layout.show_logo, true);
}

for (const item of inspect("clean_image")) {
  assert.strictEqual(item.layout.layout_type, "clean_image");
  assert.strictEqual(item.layout.show_headline, false);
  assert.strictEqual(item.layout.show_cta, false);
  assert.strictEqual(item.layout.show_logo, false);
}

for (const item of inspect("full_creative")) {
  assert.strictEqual(item.layout.layout_type, "master_safe");
  assert.strictEqual(item.layout.show_headline, true);
  assert.strictEqual(item.layout.show_subheadline, true);
  assert.strictEqual(item.layout.show_cta, true);
  assert.strictEqual(item.layout.show_logo, true);
  assert.strictEqual(item.layout.show_legal, true);
  assert.strictEqual(item.layout.show_badge, true);
}

for (const item of inspect("headline_only")) {
  assert.strictEqual(item.layout.layout_type, "master_safe");
  assert.strictEqual(item.layout.show_headline, true);
  assert.strictEqual(item.layout.show_subheadline, false);
  assert.strictEqual(item.layout.show_cta, false);
  assert.strictEqual(item.layout.show_logo, false);
}

for (const item of inspect("native_clean")) {
  assert.strictEqual(item.layout.layout_type, "native_center");
  assert.strictEqual(item.layout.show_headline, false);
  assert.strictEqual(item.layout.show_logo, false);
}

const chosen = getRequestedFormats(["meta_full", "native_clean"]);
assert.strictEqual(chosen.length, 4);
assert(chosen.every(item => !item.campaign), "Universal formats must not belong to historical campaigns");

console.log("universal templates: ok");
