const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync(require.resolve("../plugin/code.js"), "utf8");
const start = source.indexOf("function qaOutside");
const end = source.indexOf("function validateGeneratedFrame");
assert(start >= 0 && end > start, "pure visual QA geometry helpers must exist");

const context = {};
vm.createContext(context);
vm.runInContext(source.slice(start, end), context);

assert.strictEqual(context.qaOutside({ x: 0, y: 0, w: 300, h: 250 }, { width: 300, height: 250 }, 2), false);
assert.strictEqual(context.qaOutside({ x: -4, y: 0, w: 300, h: 250 }, { width: 300, height: 250 }, 2), true);
assert.strictEqual(context.qaOverlap({ x: 10, y: 10, w: 80, h: 30 }, { x: 70, y: 20, w: 60, h: 30 }, 2), true);
assert.strictEqual(context.qaOverlap({ x: 10, y: 10, w: 40, h: 30 }, { x: 60, y: 10, w: 40, h: 30 }, 2), false);
assert.strictEqual(context.qaNear(425.8, 425, 2), true);
assert.strictEqual(context.qaNear(429, 425, 2), false);

assert(source.includes('frame.setPluginData("tbQaStatus"'), "every rendered frame must persist its QA result");
assert(source.includes('qaFailedCount'), "generation summary must expose QA failures");
assert(source.includes('qa_psd_geometry'), "Adform outputs must be checked against PSD geometry");
assert(source.includes('FONT.family !== STYLE.fontFamily'), "font fallback must fail visual QA");
assert(source.includes('qa_content_overlap'), "content collisions must fail visual QA");
// P1-7: AI tag musí byť súčasťou kolíznej detekcie — chýbal, preto QA
// nehlásila prekryv potvrdený na 5 topky.sk formátoch (Figma 1293:1504).
assert(source.includes('qaFind(frame, "AI generované")'), "AI disclosure node must be looked up for QA");
assert(/collisionPairs = \[[\s\S]{0,400}aiTag\]/.test(source), "AI tag must be checked against headline/subheadline/CTA/logo for collisions");
// Reálne nameraný prípad (120×600, topky.sk branding beh): headline y=168
// h=369 (bottom 537) vs. AI tag y=524 h=13 — 13 px prekryv, presne ako
// zadanie namieralo. Musí sa teraz detegovať.
assert.strictEqual(
  context.qaOverlap({ x: 12, y: 168, w: 96, h: 369 }, { x: 15, y: 524, w: 88, h: 13 }, 2),
  true,
  "measured topky.sk 120×600 headline/AI-tag overlap must be detected"
);
assert(source.includes('qa_logo_scale'), "logo dimensions must be validated against format tokens");
assert(source.includes('qa_cta_style'), "CTA size and brand blue must be validated");
assert(source.includes('qa_text_spacing'), "headline/subheadline optical spacing must be validated");
assert(source.includes('qa_wide_color_extension'), "wide color continuation must be validated against seams");
assert(source.includes('qa_unsafe_single_master_crop'), "unsafe square-to-portrait/landscape cover crops must fail QA");
assert(source.includes('tbGeneratedBy: "tb-kid-agent@" + TB_GENERATOR_VERSION'), "every frame must identify the exact generator version");
assert(source.includes('tbVisualReview: "REQUIRED_FOR_NEW_CAMPAIGN"'), "runtime QA must not be presented as campaign-specific pixel approval");
assert(source.includes('TB_QA_SCOPE = "runtime-geometry+material-rules; pixel-reference-required"'), "every format must declare that pixel review is a separate mandatory gate");

// P0-29-S8 (25.8. večer): portrétový "Adaptive portrait content panel" bol
// naviazaný len na percento formátu/obrázka, nezávisle od skutočnej výšky
// obsahu — namerané 50–84 % prázdnej plochy na 5 formátoch (1080×1920 Meta,
// 960×1200 PMax/DemandGen, 1000×1500 Httpool, 320×480 topky). Panel sa musí
// po výpočte headlineY retroaktívne skrátiť, keď je pôvodná rezerva väčšia,
// než obsah potrebuje — nikdy nerásť.
assert(source.includes("contentTop > adaptivePanel.y"), "portrait content panel must shrink toward actual content, never grow past its original reservation");
assert(source.includes("adaptivePanel.resize(format.width, format.height - contentTop)"), "shrunk portrait panel must still span full frame width");

// Regresia 8.9.2026: qa_typography_scale (headline) porovnávalo KAŽDÝ
// layoutType proti TB.headline(W,H) — vzorcu, ktorý reálne používa len
// buildMasterSafeLayout. branding_leader_text/branding_skin/side_safe/
// interscroller_safe majú vlastné, zámerne odlišné vzorce (napr.
// format.height*0,24 pre branding_leader_text), takže dostávali falošné
// "typografia mimo tolerancie" vo Validation reporte naprieč desiatkou
// formátov (namerané: L6yFpLkKcHe9flUk3i11T1, node 33:5585 "Validation
// report"). Kontrola musí byť obmedzená rovnako ako susedné subheadline/
// logo/CTA kontroly nižšie (layoutType === "master_safe"), s výnimkou pre
// adform_psd (ten má vlastný zmysluplný vzorec cez resolvedAdformRules).
assert(/if \(\(layoutType === "master_safe" \|\| layoutType === "adform_psd"\) &&\s*\n\s*headline && headline\.type === "TEXT"\)/.test(source),
  "qa_typography_scale (headline) musí byť obmedzené na master_safe/adform_psd, inak falošne hlási vlastné vzorce iných layoutov");

// Mirror presného predtým-nahláseného prípadu: branding_leader_text na
// 1000×200 má skutočnú (zámernú) veľkosť 48px, TB.headline(1000,200)
// vracia 18px (pomer strán 5:1 spadá do "wide" vetvy, H*0,082 orezané na
// min 18) — mimo tolerancie 0,82–1,08, čiže pred opravou by to VŽDY
// nahlásilo qa_typography_scale bez ohľadu na to, že 48px je presne to,
// čo buildBrandingLeaderTextLayout zámerne kreslí.
function tbHeadline(W, H) {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const r = W / H;
  if (r > 1.45) return Math.round(clamp(H * 0.082, 18, 96));
  if (r < 0.75) return Math.round(clamp(W * 0.060, 22, 68));
  return Math.round(clamp(Math.min(W, H) * 0.056, 22, 68));
}
const brandingLeaderExpected = tbHeadline(1000, 200);
const brandingLeaderActualSize = Math.round(Math.max(20, Math.min(48, 200 * 0.24)));
assert.strictEqual(brandingLeaderExpected, 18, "kontrola predpokladu: TB.headline(1000,200) = 18");
assert.strictEqual(brandingLeaderActualSize, 48, "kontrola predpokladu: branding_leader_text 1000x200 skutočne kreslí 48px");
assert(brandingLeaderActualSize > brandingLeaderExpected * 1.08,
  "kontrola predpokladu: 48px je mimo tolerancie voči 18px — presne preto qa_typography_scale bez layoutType-gate vždy falošne hlásilo tento formát");

console.log("frame visual QA: ok");
