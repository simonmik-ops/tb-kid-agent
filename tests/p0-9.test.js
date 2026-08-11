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
    publisher_branding: { layoutType: null, headline: true, subheadline: true, cta: true, logo: true, ai: true },
    branding_full: { layoutType: "branding_skin", headline: true, subheadline: false, cta: true, logo: true, ai: true },
    branding_side: { layoutType: "side_safe", headline: true, subheadline: false, cta: true, logo: true, ai: true },
    interscroller: { layoutType: "interscroller_safe", headline: true, subheadline: false, cta: true, logo: true, ai: true },
    email: { layoutType: "email_layout", headline: true, subheadline: false, cta: true, logo: true, ai: true }
  };

  let profile = null;

  if (format.rules) {
    if (format.rules.logoOnly) profile = "logo_only";
    else if (format.rules.noText) profile = "clean_image";
    else if (format.rules.headlineOnly) profile = "headline_only";
  }

  if (!profile && format.role) {
    const roleMap = {
      clean_image: "clean_image",
      logo_only: "logo_only",
      headline_only: "headline_only",
      meta_full: "meta_full",
      full_creative: "full_creative",
      native: "native_clean",
      branding_full: "branding_full",
      branding_side: "branding_side",
      interscroller: "interscroller",
      email: "email"
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

// Bolo tu zrkadlenie STARÉHO pravidla (min(W,H) < 400 -> vždy false),
// ktoré P0-21 v plugin/code.js zrušilo — tento mirror sa vtedy nezosynchronizoval,
// takže test nižšie overoval iný (starý) kód, nie aktuálne správanie.
function jeRovnakyText(a, b) {
  if (!a || !b) return false;
  const n = function (x) { return String(x).replace(/\s+/g, " ").trim().toLowerCase(); };
  return n(a) === n(b);
}

function tbHeadline(W, H) {
  return Math.max(12, Math.round(0.1399 * Math.pow(W, 0.518) * Math.pow(H, 0.364)));
}

function tbSubheadline(W, H) {
  return Math.max(12, Math.round(tbHeadline(W, H) * 0.60));
}

function shouldShowSubheadline(format, layout, availableHeight, headline, subheadline) {
  if (layout && layout.show_subheadline === false) return false;
  if (jeRovnakyText(headline, subheadline)) return false;
  if (typeof availableHeight === "number") {
    const potrebne = Math.max(12, tbSubheadline(format.width, format.height)) * 1.5;
    if (availableHeight < potrebne) return false;
  }
  return true;
}

function findFormat(id) {
  const item = FORMATS.find((f) => f.id === id);
  assert.ok(item, "format " + id + " must exist in formats.js");
  return item;
}

// ── Google RSA: frame obsahuje len obrázok, žiadna textová vrstva ──────────
// Konflikt medzi Surďovou referenčnou Figmou (headline prítomný) a TP
// (klientom schválené technické parametre pre reálnu kampaň): "obrázky
// bez textu". TP vyhráva — je to skutočná dodacia požiadavka, nie mockup.
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

// ── publisher_branding (fallback pre Pinterest, Markíza, JOJ, Ringier,
// Ženské weby, Topky, e-mail, Vinted...): podnadpis TERAZ povolený.
// 61/143 formátov v katalógu padá do tohto profilu — dotazník
// (Surdo_odpovede_do_pluginu.md) definuje "perex" ako štandardný
// typografický prvok bez kanálovej výnimky, takže hardcoded false tu
// nemal oporu v žiadnom zdroji. Skutočnú medzeru rieši priestorový
// guard v shouldShowSubheadline(), nie tento flag.
["adform_300x250", "pinterest_pin", "vinted_300x250"].forEach((id) => {
  const rule = resolveCreativeRule(findFormat(id));
  assert.strictEqual(rule.id, "publisher_branding", id + " -> publisher_branding profile");
  assert.strictEqual(rule.subheadline, true, id + " subheadline now allowed");
});

// ── branding_full/branding_side/interscroller/email: NEZMENENÉ, zámerne.
// Tieto kanály (Markíza/JOJ/Ringier/Ženské weby/Topky branding+interscroller,
// e-mail) nemajú v Surďovej referenčnej Figme žiadnu sekciu vôbec — na
// rozdiel od publisher_branding tu nie je ani nepriamy zdroj z dotazníka,
// ktorý by ospravedlnil zmenu. claude/Plugin_podla_Surdu.md tieto kanály
// navyše výslovne označuje ako "zatiaľ nedávať do demo". Test len fixuje
// aktuálny (nevyriešený) stav, nech prípadná budúca zmena je vedomá, nie
// tichá regresia.
["kkv_markiza_branding_full", "kkv_markiza_branding_side", "kkv_int_markiza"].forEach((id) => {
  const rule = resolveCreativeRule(findFormat(id));
  assert.strictEqual(rule.subheadline, false, id + " subheadline intentionally unresolved, still off");
});

// ── resolveCreativeRule funguje aj mimo kkvisa (P0-9 hlavný bug) ──────────
["hyp_google_rsa_landscape", "bsu_google_logo_square", "tig_demandgen_logo"].forEach((id) => {
  const rule = resolveCreativeRule(findFormat(id));
  assert.notStrictEqual(rule, null, id + " must resolve a rule outside kkvisa");
});

// ── P0-21: pevný prah min(W,H) < 400 je preč — malý formát sám o sebe
// nesmie blokovať podnadpis (blokoval ho predtým na VÄČŠINE bannerov:
// 300×250, 300×600, 160×600, 320×600...). Bez zadaného availableHeight
// (rozhodnutie ešte nespočítané) sa musí správať rovnako pre malý aj
// veľký formát — rozhoduje výlučne reálne dostupný priestor, nie rozmer.
FORMATS
  .filter((f) => Math.min(f.width, f.height) < 400)
  .slice(0, 15)
  .forEach((f) => {
    assert.strictEqual(
      shouldShowSubheadline(f, {}, undefined, "Headline", "Iný text"),
      true,
      f.id + " (" + f.width + "x" + f.height + ") small format alone must not block subheadline"
    );
  });

// ── nedostatok reálne dostupnej výšky vypne subheadline, aj na veľkom formáte ─
assert.strictEqual(
  shouldShowSubheadline({ width: 750, height: 1624 }, {}, 30, "Headline", "Sub"),
  false,
  "insufficient availableHeight must suppress subheadline"
);
assert.strictEqual(
  shouldShowSubheadline({ width: 750, height: 1624 }, {}, 500, "Headline", "Sub"),
  true,
  "ample availableHeight must allow subheadline"
);
// ── priestorový guard platí aj na malom formáte (300×250), keď je miesta dosť ─
assert.strictEqual(
  shouldShowSubheadline({ width: 300, height: 250 }, {}, 200, "Headline", "Sub"),
  true,
  "300x250 with ample room must allow subheadline (no more hardcoded size cutoff)"
);
// ── zhodný text headline/subheadline sa nekreslí duplicitne ──────────────
assert.strictEqual(
  shouldShowSubheadline({ width: 1200, height: 1200 }, {}, 500, "Rovnaký text", "Rovnaký  text"),
  false,
  "identical headline/subheadline text must suppress the duplicate subheadline"
);

// ── layout.show_subheadline === false vždy vyhráva ─────────────────────────
assert.strictEqual(
  shouldShowSubheadline({ width: 1200, height: 1200 }, { show_subheadline: false }, 500),
  false,
  "explicit show_subheadline:false must be respected"
);

console.log("P0-9 creative rule + subheadline guard: ok");
