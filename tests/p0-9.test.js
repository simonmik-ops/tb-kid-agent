// P0-9: pravidlá per formát — kde headline/subheadline/CTA/logo nemajú byť.
//
// plugin/code.js beží v Figma plugin sandboxe (globálny `figma`), takže sa
// nedá priamo require-núť v Node. resolveCreativeRule() a
// shouldShowSubheadline() sú ale čisté funkcie (žiadne volanie figma.*),
// preto sú tu zrkadlené 1:1 z plugin/code.js pre účely testu — pri zmene
// jednej strany treba zmeniť aj druhú.

const assert = require("assert");
const FORMATS = require("../formats.js");

function resolveCreativeRule(format) {
  if (!format) return null;

  const profiles = {
    clean_image: { layoutType: "clean_image", headline: false, subheadline: false, cta: false, logo: false, ai: false },
    logo_only: { layoutType: "logo_only", headline: false, subheadline: false, cta: false, logo: true, ai: false },
    meta_full: { layoutType: "master_safe", headline: true, subheadline: true, cta: false, logo: true, ai: true },
    full_creative: { layoutType: "master_safe", headline: true, subheadline: true, cta: true, logo: true, ai: true },
    headline_only: { layoutType: "master_safe", headline: true, subheadline: false, cta: false, logo: false, ai: true },
    native_clean: { layoutType: "native_center", headline: false, subheadline: false, cta: false, logo: false, ai: false },
    publisher_branding: { layoutType: null, headline: true, subheadline: true, cta: true, logo: true, ai: true }
  };

  let profile = null;

  if (format.rules) {
    if (format.rules.logoOnly) profile = "logo_only";
    else if (format.rules.noText) profile = format.role === "native" ? "native_clean" : "clean_image";
    else if (format.rules.headlineOnly) profile = "headline_only";
  }

  if (!profile && format.role) {
    const roleMap = {
      clean_image: "clean_image",
      logo_only: "logo_only",
      headline_only: "headline_only",
      meta_full: "meta_full",
      full_creative: "full_creative",
      native: "native_clean"
    };
    profile = roleMap[format.role] || null;
  }

  if (!profile) {
    const id = format.id || "";
    const channel = format.channel || "";
    if (id.indexOf("google_rsa") !== -1) profile = "clean_image";
    else if (id.indexOf("google_logo") !== -1) profile = "logo_only";
    else if (id.indexOf("pmax") !== -1 || channel === "Google PMax") profile = "headline_only";
    else if (id.indexOf("meta_") !== -1 || channel === "Meta") profile = "meta_full";
    else if (id.indexOf("demandgen") !== -1 || channel === "Google DemandGen") profile = "full_creative";
    else if (id.indexOf("engerio") !== -1) profile = "native_clean";
    else profile = "publisher_branding";
  }

  const def = profiles[profile];
  if (!def) return { id: "publisher_branding", ...profiles.publisher_branding };
  return { id: profile, ...def };
}

function shouldShowSubheadline(format, layout, availableHeight) {
  const subheadlineSize = Math.max(12, Math.round(
    0.1399 * Math.pow(format.width, 0.518) * Math.pow(format.height, 0.364) * 0.60
  ));
  if (layout && layout.show_subheadline === false) return false;
  if (typeof availableHeight === "number" && availableHeight < subheadlineSize * 1.6) {
    return false;
  }
  return true;
}

function findFormat(id) {
  const item = FORMATS.find((f) => f.id === id);
  assert.ok(item, "format " + id + " must exist in formats.js");
  return item;
}

// ── Google RSA: frame obsahuje len obrázok, žiadna textová vrstva ──────────
["google_rsa_landscape", "google_rsa_square", "kkv_google_rsa_landscape", "hyp_google_rsa_square"].forEach((id) => {
  const rule = resolveCreativeRule(findFormat(id));
  assert.strictEqual(rule.id, "clean_image", id + " -> clean_image profile");
  assert.strictEqual(rule.headline, false, id + " headline off");
  assert.strictEqual(rule.subheadline, false, id + " subheadline off");
  assert.strictEqual(rule.cta, false, id + " cta off");
  assert.strictEqual(rule.logo, false, id + " logo off");
});

// ── PMax: len headline, žiadne CTA ani logo ────────────────────────────────
["pmax_landscape", "pmax_square", "kkv_pmax_portrait"].forEach((id) => {
  const rule = resolveCreativeRule(findFormat(id));
  assert.strictEqual(rule.id, "headline_only", id + " -> headline_only profile");
  assert.strictEqual(rule.headline, true, id + " headline on");
  assert.strictEqual(rule.cta, false, id + " cta off");
  assert.strictEqual(rule.logo, false, id + " logo off");
});

// ── Meta image: headline + logo, žiadne CTA button ─────────────────────────
["meta_img_1x1", "kkv_meta_img_4x5", "hyp_meta_img_9x16"].forEach((id) => {
  const rule = resolveCreativeRule(findFormat(id));
  assert.strictEqual(rule.id, "meta_full", id + " -> meta_full profile");
  assert.strictEqual(rule.headline, true, id + " headline on");
  assert.strictEqual(rule.logo, true, id + " logo on");
  assert.strictEqual(rule.cta, false, id + " cta off");
});

// ── Google Logo: len logo na transparentnom pozadí ─────────────────────────
["google_logo_square", "google_logo_wide", "kkv_google_logo_square"].forEach((id) => {
  const rule = resolveCreativeRule(findFormat(id));
  assert.strictEqual(rule.id, "logo_only", id + " -> logo_only profile");
  assert.strictEqual(rule.headline, false, id + " headline off");
  assert.strictEqual(rule.logo, true, id + " logo on");
});

// ── Engerio: čistý obrázok (native_clean) ──────────────────────────────────
["engerio_native", "kkv_engerio_native"].forEach((id) => {
  const rule = resolveCreativeRule(findFormat(id));
  assert.strictEqual(rule.id, "native_clean", id + " -> native_clean profile");
  assert.strictEqual(rule.headline, false, id + " headline off");
  assert.strictEqual(rule.logo, false, id + " logo off");
});

// ── Demand Gen: graficky kompletné — headline + CTA + logo ─────────────────
["demandgen_landscape", "kkv_demandgen_square", "bsu_demandgen_portrait", "tig_demandgen_landscape"].forEach((id) => {
  const rule = resolveCreativeRule(findFormat(id));
  assert.strictEqual(rule.id, "full_creative", id + " -> full_creative profile");
  assert.strictEqual(rule.headline, true, id + " headline on");
  assert.strictEqual(rule.cta, true, id + " cta on");
  assert.strictEqual(rule.logo, true, id + " logo on");
});

// ── resolveCreativeRule funguje aj mimo kkvisa (P0-9 hlavný bug) ──────────
["hyp_google_rsa_landscape", "bsu_google_logo_square", "tig_demandgen_logo"].forEach((id) => {
  const rule = resolveCreativeRule(findFormat(id));
  assert.notStrictEqual(rule, null, id + " must resolve a rule outside kkvisa");
});

// Malý rozmer sám osebe nesmie zahodiť dodaný podnadpis. Renderer ho môže
// vypnúť až podľa skutočne dostupnej výšky po odpočítaní CTA a loga.
assert.strictEqual(
  shouldShowSubheadline({ width: 300, height: 250 }, {}),
  true,
  "small formats may show a subheadline when the template has room"
);

// ── nedostatok reálne dostupnej výšky vypne subheadline aj nad 400 px ─────
assert.strictEqual(
  shouldShowSubheadline({ width: 750, height: 1624 }, {}, 30),
  false,
  "insufficient availableHeight must suppress subheadline"
);
assert.strictEqual(
  shouldShowSubheadline({ width: 750, height: 1624 }, {}, 500),
  true,
  "ample availableHeight must allow subheadline"
);

// ── layout.show_subheadline === false vždy vyhráva ─────────────────────────
assert.strictEqual(
  shouldShowSubheadline({ width: 1200, height: 1200 }, { show_subheadline: false }, 500),
  false,
  "explicit show_subheadline:false must be respected"
);

console.log("P0-9 creative rule + subheadline guard: ok");
