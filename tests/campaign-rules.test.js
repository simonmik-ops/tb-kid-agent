const assert = require("assert");
const FORMATS = require("../formats");
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

function format(id) {
  const found = FORMATS.find(item => item.id === id);
  assert(found, `Missing format ${id}`);
  return found;
}

function expectProfile(id, profile, elements) {
  const rule = getCreativeRule(format(id));
  assert(rule, `Missing rule for ${id}`);
  assert.strictEqual(rule.id, profile, `${id} profile`);
  for (const [key, value] of Object.entries(elements)) {
    assert.strictEqual(rule.elements[key], value, `${id} ${key}`);
  }
}

expectProfile("kkv_meta_img_1x1", "meta_full", {
  headline: true, cta: false, logo: true
});
expectProfile("kkv_google_rsa_landscape", "clean_image", {
  headline: false, subheadline: false, cta: false, logo: false
});
expectProfile("kkv_demandgen_square", "full_creative", {
  headline: true, subheadline: true, cta: true, logo: true
});
expectProfile("kkv_pmax_portrait", "headline_only", {
  headline: true, subheadline: false, cta: false, logo: false
});
expectProfile("kkv_google_logo_wide", "logo_only", {
  headline: false, cta: false, logo: true
});
expectProfile("kkv_engerio_native", "native_clean", {
  headline: false, cta: false, logo: false
});

expectProfile("meta_img_1x1", "meta_full", {
  headline: true, cta: false, logo: true
});

function expectLayout(id, expected) {
  const layout = getLayoutStrategy(format(id), VISUAL, RECIPE);
  for (const [key, value] of Object.entries(expected)) {
    assert.strictEqual(layout[key], value, `${id} layout ${key}`);
  }
}

expectLayout("kkv_meta_img_1x1", {
  layout_type: "master_safe",
  show_headline: true, show_subheadline: true, show_cta: false, show_logo: true
});
expectLayout("kkv_google_rsa_landscape", {
  layout_type: "clean_image",
  show_headline: false, show_subheadline: false, show_cta: false, show_logo: false
});
expectLayout("kkv_demandgen_square", {
  layout_type: "master_safe",
  show_headline: true, show_subheadline: true, show_cta: true, show_logo: true
});
expectLayout("kkv_pmax_portrait", {
  layout_type: "master_safe",
  show_headline: true, show_subheadline: false, show_cta: false, show_logo: false
});
console.log("campaign rules: ok");
