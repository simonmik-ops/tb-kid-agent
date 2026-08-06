// code.js

// Menný priestor pre metadáta na frameoch. Musí zostať stabilný — čítajú
// ho externé nástroje cez getSharedPluginData.
var TB_NS = "tbgen";

var TB = {
  headline: function (W, H) {
    // Optická škála podľa rodiny formátu. Jedna mocninová krivka zväčšovala
    // portraity (1080×1920 = 82 px) a pritom nedržala rovnakú hierarchiu vo
    // wide formátoch. Limity vychádzajú z InvestQ Figmy a Adform PSD.
    var r = W / H;
    if (r > 1.45) return Math.round(clamp(H * 0.076, 18, 48));
    if (r < 0.75) return Math.round(clamp(W * 0.055, 22, 60));
    return Math.round(clamp(Math.min(W, H) * 0.050, 22, 60));
  },
  subheadline: function (W, H) { return Math.max(12, Math.round(TB.headline(W, H) * 0.48)); },
  legal: function (W, H) { return Math.max(12, Math.min(24, Math.round(TB.headline(W, H) * 0.30))); },
  padding: function (W, H) { return Math.max(12, Math.round(0.060 * Math.sqrt(W * H))); },
  logoBox: function (W, H) {
    var r = W / H;
    var h = r > 1.45
      ? Math.min(H * 0.19, W * 0.125)
      : (r < 0.75 ? Math.min(W * 0.125, H * 0.09) : Math.min(W * 0.12, H * 0.12));
    h = Math.max(50, Math.round(h));
    var w = Math.round(h * (255/243));
    var maxW = Math.round(W * 0.32);
    if (w > maxW) {
      w = maxW;
      h = Math.round(w * (243/255));
      if (h < 50) { h = 50; w = Math.round(h * (255/243)); }
    }
    return { height: h, width: w };
  },
  logoClear: function (W, H) { return Math.max(30, Math.round(TB.logoBox(W, H).height / 3)); },
  button: function (W, H) {
    // CTA nesmie dominovať nad headline/KV. Predošlých 10 % geometrického
    // priemeru vytváralo na 1200×1200 až 120 px vysoké tlačidlo.
    var h = Math.max(36, Math.min(56, Math.round(0.047 * Math.sqrt(W * H))));
    return { height: h, width: Math.round(h * 2.9), fontSize: Math.max(12, Math.round(h * 0.36)),
             radius: Math.max(4, Math.round(h * 0.08)) };
  }
};

try {
  figma.showUI(__html__, { width: 500, height: 760 });
} catch(e) {
  figma.closePlugin("Chyba pri štarte: " + e.message);
}

figma.ui.onmessage = async (msg) => {
  if (msg.type === "ping") {
    figma.ui.postMessage({ type: "pong" });
  }
  if (msg.type === "create-frames") {
    try {
      await createAllFrames(msg.payload);
    } catch (err) {
      figma.ui.postMessage({ type: "error", message: err.message });
    }
  }
  if (msg.type === "close") {
    figma.closePlugin();
  }
};

const BRAND_COLOR = { r: 0.0, g: 0.18, b: 0.55 };
const LOCAL_ADFORM_PSD_IDS = [
  "adform_300x250",
  "adform_300x600",
  "adform_160x600",
  "adform_970x250"
];

function adformTemplateId(format) {
  if (!format) return null;
  if (format.template && LOCAL_ADFORM_PSD_IDS.indexOf(format.template) !== -1) return format.template;
  const key = String(format.width) + "x" + String(format.height);
  const bySize = {
    "300x250": "adform_300x250", "300x600": "adform_300x600",
    "160x600": "adform_160x600", "970x250": "adform_970x250"
  };
  const isAdform = String(format.id || "").toLowerCase().indexOf("adform") !== -1 ||
    String(format.channel || "").toLowerCase() === "adform";
  return isAdform ? (bySize[key] || null) : null;
}

// Rozhoduje, ktoré prvky (headline/subheadline/CTA/logo/AI tag) sa pre daný
// formát vôbec majú kresliť. Pôvodne (localKkVisaRule) fungovalo len pre
// campaign==="kkvisa" — pre hypo/bsu/tiger sa nikdy nič nenastavilo a
// všetko sa kreslilo defaultne (P0-9).
//
// Zdroj pravdy, v tomto poradí:
//   1. format.rules  — cieľový tvar z P1-9, zatiaľ vždy undefined.
//   2. format.role   — kurátorské dáta vo formats.js (primárny zdroj, kým
//      nie je P1-9 hotové).
//   3. odvodenie z format.id / format.channel — len fallback pre formáty,
//      ktoré role ešte nemajú.
function resolveCreativeRule(format) {
  if (!format) return null;

  const profiles = {
    clean_image: { layoutType: "clean_image", headline: false, subheadline: false, cta: false, logo: false, ai: false },
    logo_only: { layoutType: "logo_only", headline: false, subheadline: false, cta: false, logo: true, ai: false },
    meta_full: { layoutType: "master_safe", headline: true, subheadline: true, cta: false, logo: true, ai: true },
    full_creative: { layoutType: "master_safe", headline: true, subheadline: true, cta: true, logo: true, ai: true },
    headline_only: { layoutType: "master_safe", headline: true, subheadline: false, cta: false, logo: false, ai: true },
    native_clean: { layoutType: "native_center", headline: false, subheadline: false, cta: false, logo: false, ai: false },
    video_placeholder: { layoutType: "video_placeholder", headline: false, subheadline: false, cta: false, logo: false, ai: false },
    publisher_branding: { layoutType: null, headline: true, subheadline: true, cta: true, logo: true, ai: true },
    // P0-9b: JOJ/Markíza skin, bočné skyscrapery, interscroller a e-mail —
    // CTA aj AI disclosure zostávajú zapnuté (rovnako ako predtým cez
    // master_safe / publisher_branding fallback — nedropovať, čo tam bolo).
    branding_full: { layoutType: "branding_skin", headline: true, subheadline: false, cta: true, logo: true, ai: true },
    branding_side: { layoutType: "side_safe", headline: true, subheadline: false, cta: true, logo: true, ai: true },
    interscroller: { layoutType: "interscroller_safe", headline: true, subheadline: false, cta: true, logo: true, ai: true },
    email: { layoutType: "email_layout", headline: true, subheadline: false, cta: true, logo: true, ai: true }
  };

  let profile = null;

  // 1. format.rules (P1-9 cieľový tvar).
  if (format.rules) {
    if (format.rules.logoOnly) profile = "logo_only";
    else if (format.rules.noText) profile = format.role === "native" ? "native_clean" : "clean_image";
    else if (format.rules.headlineOnly) profile = "headline_only";
  }

  // 2. format.role — priamo z formats.js.
  if (!profile && format.role) {
    const roleMap = {
      clean_image: "clean_image",
      logo_only: "logo_only",
      headline_only: "headline_only",
      meta_full: "meta_full",
      full_creative: "full_creative",
      native: "native_clean",
      video_placeholder: "video_placeholder",
      branding_full: "branding_full",
      branding_side: "branding_side",
      interscroller: "interscroller",
      email: "email"
    };
    profile = roleMap[format.role] || null;
  }

  // 3. fallback — odvodenie z id/channel, funguje naprieč kampaňami
  // (nielen kkv_ prefixom), pre formáty bez role.
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

// ── ŠTÝLOVÉ TOKENY — odčítané zo Surďovej Figmy (InvestQ predloha) ──────
// Cesta A: plugin kreslí, ale podľa reálnych hodnôt z dizajnu, nie od oka.
const STYLE = {
  fontFamily: "Tatra banka Sans",   // hlavný font; fallback Inter ak nie je vo Figme
  headlineStyle: "Bold",
  minTextPx: 12,                     // dotazník: min. 12 px
  minLogoPx: 50,                     // dotazník: nikdy pod 50 px
  paddingPct: 0.05,                  // Surď: band padding 5 % (60px / 1200)
  logoWidthPct: 0.15,                // Surď: logo ~180px / 1200 = 15 %, vpravo dole
  headlinePct: 0.066,                // Surď: headline ~80px / 1200
  scrimHeightPct: 0.42,              // gradient dole ~42 %
  scrimOpacity: 0.55,               // tmavý gradient pre čitateľnosť (Surď: jemný)
  aiTagText: "AI generované",        // vľavo dole (potvrdené z Figmy)
  ctaText: "Zistiť viac >"           // dotazník: vždy rovnaké CTA
};

// Rozlíšený font (nastaví sa v createAllFrames; fallback Inter)
let FONT = { family: "Inter", style: "Bold" };
let FONT_REGULAR = { family: "Inter", style: "Regular" };
let FONT_LIGHT = { family: "Inter", style: "Regular" };

// Pomer strán nahraného KV (nastaví sa v createAllFrames) — na rozhodnutie
// FILL vs CONTAIN podľa Surďovho pravidla „keď sa subjekt nezmestí → Contain".
let KV_RATIO = null;

// Podnadpis (Surď: prvok SUBHDL) — voliteľný, pod headlineom.
let SUBHEAD = "";

// Je AI disclosure zapnutá? (aby si text vyhradil miesto a neprekryl AI tag)
let AI_ON = false;

// Rozmery aktuálne kresleného KV (nastaví sa v slučke cez getSizeAsync) —
// slúžia na výpočet viditeľnej plochy pri CONTAIN, nech text/logo/AI sadnú
// na obrázok a nie do brand pásu.
let CUR_IMG_W = 0;
let CUR_IMG_H = 0;

async function resolveBrandFont() {
  try {
    await Promise.all([
      figma.loadFontAsync({ family: STYLE.fontFamily, style: "Bold" }),
      figma.loadFontAsync({ family: STYLE.fontFamily, style: "Regular" }),
      figma.loadFontAsync({ family: STYLE.fontFamily, style: "Light" })
    ]);
    FONT = { family: STYLE.fontFamily, style: STYLE.headlineStyle };
    FONT_REGULAR = { family: STYLE.fontFamily, style: "Regular" };
    FONT_LIGHT = { family: STYLE.fontFamily, style: "Light" };
  } catch (e) {
    FONT = { family: "Inter", style: "Bold" }; // Tatra banka Sans nie je vo Figme → Inter
    FONT_REGULAR = { family: "Inter", style: "Regular" };
    FONT_LIGHT = { family: "Inter", style: "Regular" };
    figma.notify("Font „" + STYLE.fontFamily + "“ nie je vo Figme — použil sa Inter. Nainštaluj font pre finál.", { timeout: 4000 });
  }
}

// Farba brand plochy = z analýzy vizuálu (nie natvrdo modrá); fallback brand blue
function brandColor(layout) {
  if (layout && typeof layout.bg_r === "number") {
    return { r: layout.bg_r, g: layout.bg_g, b: layout.bg_b };
  }
  return BRAND_COLOR;
}

// Veľkosť „AI generované" textu — jednotná pre vykreslenie aj rezervu miesta.
function aiNoteFontSize(format) {
  return Math.round(clamp(Math.min(format.width, format.height) * 0.015, 12, 16));
}

// AI disclosure — jemný, integrovaný text vľavo dole (potvrdené z Figmy).
// Ladený tak, aby pôsobil ako súčasť kompozície: nižšia sýtosť, jemný
// letter-spacing, zarovnaný na rovnaký ľavý okraj ako headline.
function addAiNote(frame, format, contentBox) {
  const cb = contentBox || { x: 0, y: 0, w: format.width, h: format.height };
  const t = figma.createText();
  t.name = "AI generované";
  t.fontName = FONT_REGULAR;
  t.characters = "✧  " + STYLE.aiTagText;
  t.fontSize = aiNoteFontSize(format);
  t.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  t.opacity = 0.80;                       // presne podľa PSD disclosure vrstvy
  try { t.letterSpacing = { value: -1.5, unit: "PERCENT" }; } catch (e) {}
  t.textAutoResize = "WIDTH_AND_HEIGHT";
  const pad = TB.padding(format.width, format.height);
  frame.appendChild(t);
  // Ukotvi tag na spodok SKUTOČNÉHO KV obrázka, nech je vždy NA vizuáli a nie
  // v prázdnom brand páse pod ním. Nájde najväčší rect s IMAGE výplňou (mimo
  // loga). Keď KV vypĺňa celý frame (fill), obrázok je fill rámu (žiadny child)
  // → padne na spodok frame-u, čo je stále na obrázku.
  let img = null;
  try {
    const kids = frame.children || [];
    for (let i = 0; i < kids.length; i++) {
      const n = kids[i];
      if (n.name === "Logo") continue;
      const fills = n.fills;
      if (Array.isArray(fills) && fills.some(function (fl) { return fl.type === "IMAGE"; })) {
        if (!img || (n.width * n.height > img.width * img.height)) img = n;
      }
    }
  } catch (e) {}
  const imgBottom = img ? (img.y + img.height) : (cb.y + cb.h);
  const imgLeft = img ? img.x : cb.x;
  var textCol = null;
  try {
    var hlNode = frame.findOne(function (q) { return q.name === "Headline"; });
    if (hlNode) textCol = Math.round(hlNode.x);
  } catch (e) {}
  t.x = textCol !== null ? textCol : Math.max(cb.x + pad, Math.round(imgLeft) + pad);
  t.y = Math.min(cb.y + cb.h - t.height - pad, Math.round(imgBottom) - t.height - pad);
  try {
    var kolizie = ["Logo", "CTA button", "Subheadline", "Headline", "Legal text"]
      .map(function (nm) { return frame.findOne(function (q) { return q.name === nm; }); })
      .filter(function (q) {
        return q && (t.x < q.x + q.width) && (t.x + t.width > q.x) &&
               (t.y < q.y + q.height) && (t.y + t.height > q.y);
      });
    if (kolizie.length) {
      var najvyssia = kolizie.reduce(function (a, b) { return a.y < b.y ? a : b; });
      var novaY = najvyssia.y - t.height - Math.round(t.height * 0.5);
      if (novaY >= pad) {
        t.y = novaY;
      } else {
        t.x = pad;
        t.y = format.height - t.height - pad;
      }
    }
  } catch (e) {}
  t.locked = true;

}

async function createAllFrames({
  formats, headline, subheadline, ctaText, legalText, badgeText, adType,
  imageBytes, kvSquareBytes, kvPortraitBytes, kvLandscapeBytes,
  logoBytes, visualRecipe, tagging, showGuides, aiGenerated, kvBg, kvLumaBottom
}) {
  SUBHEAD = (subheadline || "").trim();

  // Univerzálny (master_safe) layout je fallback pre formáty bez šablóny,
  // nie voľba používateľa — preto sa dedup jedného master vizuálu na
  // formát vždy aplikuje, bez podmienky na visualRecipe.
  {
    const seenSingleMasters = {};
    formats = formats.filter(item => {
      const format = item.format;
      const key = format.baseId || format.id;
      if (!key) return true;
      const pairedSide = !!format.variantSide &&
        (key.indexOf("side") !== -1 || key.indexOf("branding") !== -1);
      if (pairedSide) return true;
      if (seenSingleMasters[key]) return false;
      seenSingleMasters[key] = true;
      return true;
    });
  }

  const campaignTag = tagging || "kid-062026";
  // QA vrstvy sú opt-in. Ak staršia UI verzia hodnotu vôbec nepošle,
  // produkčný frame musí zostať čistý a bez exportovateľného ohraničenia.
  const guides = showGuides === true;
  const aiNote = aiGenerated === true; // AI disclosure len keď je vizuál AI-generovaný
  AI_ON = aiNote;

  // Brandingové zápisy typu 2×200×700 predstavujú ľavý a pravý diel.
  // Excel posiela jeden formát s count=2; tu ho rozbalíme na oba framy.
  formats = expandPairedBrandingFormats(formats);

  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  await figma.loadFontAsync({ family: "Inter", style: "Bold" });
  await resolveBrandFont(); // Tatra banka Sans, fallback Inter

  function mkImage(bytes) {
    if (!bytes || !bytes.length) return null;
    try { return figma.createImage(new Uint8Array(bytes)); } catch (e) { return null; }
  }
  // KV pre 3 orientácie; imageBytes = spätná kompatibilita (starý single vstup → štvorec)
  const imgSquare = mkImage(kvSquareBytes || imageBytes);
  const imgPortrait = mkImage(kvPortraitBytes);
  const imgLandscape = mkImage(kvLandscapeBytes);

  // Vyber KV podľa orientácie formátu — každý formát dostane vizuál pre svoj
  // tvar, takže sa nič neoreže zle. Fallback na dostupné.
  function pickKV(format) {
    const r = format.width / format.height;
    if (r >= 1.25) return imgLandscape || imgSquare || imgPortrait;
    if (r <= 0.8) return imgPortrait || imgSquare || imgLandscape;
    return imgSquare || imgPortrait || imgLandscape;
  }

  // Šablóny z vetvy adform-psd počítajú s jedným vizuálom a jeho rozmermi.
  // Držíme ich ako východiskové, per-formát ich prepíše pickKV nižšie.
  var figmaImage = imgSquare || imgPortrait || imgLandscape;
  var figmaImageSize = null;
  if (figmaImage) {
    try { figmaImageSize = await figmaImage.getSizeAsync(); } catch (e) { figmaImageSize = null; }
  }

  var figmaLogo = mkImage(logoBytes);

  const byChannel = {};
  for (const item of formats) {
    const ch = item.format.channel;
    if (!byChannel[ch]) byChannel[ch] = [];
    byChannel[ch].push(item);
  }

  const allFrames = [];
  const channels = Object.keys(byChannel);
  let riskFlaggedCount = 0;

  for (const channel of channels) {
    const items = byChannel[channel];

    let page = Array.from(figma.root.children).find(p => p.name === channel);
    if (!page) {
      page = figma.createPage();
      page.name = channel;
    }

    let xOffset = 0;

    for (const item of items) {
      const format = item.format;
      // Excel cesta: keď layout nepríde zo servera, vyrieš ho lokálne z rozmerov.
      const layout = item.layout || resolveLayoutLocal(format);

      // Headline pre tento formát = tvoj ručný text. Tool sám rozhodne (per
      // formát), kde ho zobraziť a kde nie (show_headline / show_subhead).
      const hl = headline;

      // --- pravidlá univerzálnych šablón (vetva adform-psd) ---------------
      // Lokálny plugin môže testovať PSD šablóny ešte pred nasadením nového
      // backendu na Railway. Starší backend template nepozná, ale stabilné ID áno.
      const localAdformTemplate = adformTemplateId(format);
      const hasLocalAdformTemplate = !!localAdformTemplate;
      // Univerzálny master_safe layout je fallback pre formáty bez šablóny,
      // nie prepínateľná voľba — šablóna (adform_psd) má aj tak vždy prednosť
      // cez hasLocalAdformTemplate nižšie.
      const useMasterSafe = true;
      const creativeRule = resolveCreativeRule(format);
      if (creativeRule) {
        layout.show_headline = creativeRule.headline;
        layout.show_subheadline = creativeRule.subheadline;
        layout.show_cta = creativeRule.cta;
        layout.show_logo = creativeRule.logo;
        layout.show_ai_disclosure = creativeRule.ai;
        layout.creative_profile = creativeRule.id;
      }
      const backendLayoutType = (creativeRule && creativeRule.layoutType) || layout.layout_type || "full_bleed";
      const masterExcludedLayouts = [
        "video_placeholder", "logo_only", "micro", "branding_skin", "side_safe",
        "interscroller_safe", "native_center", "email_layout", "pinterest_pin",
        "clean_image"
      ];
      const masterEligible = masterExcludedLayouts.indexOf(backendLayoutType) === -1 &&
        format.height > 100 && !(format.width / format.height > 4.5 && format.height < 150);
      const layoutType = hasLocalAdformTemplate
        ? "adform_psd"
        : (useMasterSafe && masterEligible ? "master_safe" : backendLayoutType);
      if (useMasterSafe && (hasLocalAdformTemplate || masterEligible) && backendLayoutType === "master_safe") {
        const ratio = format.width / format.height;
        layout.master_family = ratio > 1.45 ? "wide" : (ratio < 0.75 ? "portrait" : "square");
        layout.master_safe_zone = true;
      }

      if (kvBg && typeof layout.bg_r !== "number") {
        layout.bg_r = kvBg.r; layout.bg_g = kvBg.g; layout.bg_b = kvBg.b;
      }
      if (typeof kvLumaBottom === "number" && typeof layout.kv_luma_bottom !== "number") {
        layout.kv_luma_bottom = kvLumaBottom;
      }

      // --- KV podľa orientácie formátu (vetva clean-frames) ---------------
      const figmaImage = pickKV(format);

      // Rozmery zvoleného KV (na výpočet viditeľnej plochy pri contain).
      CUR_IMG_W = 0; CUR_IMG_H = 0;
      if (figmaImage) {
        try { const sz = await figmaImage.getSizeAsync(); CUR_IMG_W = sz.width; CUR_IMG_H = sz.height; } catch (e) {}
      }
      // Šablóny master_safe/adform_psd potrebujú rozmery práve toho KV,
      // ktoré sa pre formát použilo — nie východiskového.
      const curImgSize = (CUR_IMG_W && CUR_IMG_H)
        ? { width: CUR_IMG_W, height: CUR_IMG_H }
        : figmaImageSize;

      const frame = figma.createFrame();
      const variantName = format.variantLabel ? " \u2014 " + format.variantLabel : "";
      const sideName = format.variantSide ? " " + format.variantSide.toUpperCase() : "";
      var roleLabels = {
        clean_image: "čistý vizuál", logo_only: "logo", meta_full: "Meta",
        full_creative: "kompletná kreatíva", headline_only: "iba headline",
        native: "native", branding_full: "branding", branding_side: "bočný branding",
        interscroller: "interscroller", email: "e-mail", publisher_branding: "publisher"
      };
      var formatDescriptor = String(format.width) + "×" + String(format.height) + " · " +
        String(format.channel || "Nezaradené") + (format.role && roleLabels[format.role] ? " / " + roleLabels[format.role] : "");
      frame.name = formatDescriptor + variantName + sideName + " \u2014 " + adType.toUpperCase() + " [" + campaignTag + "]";
      // Metadáta pre export: limit a ID formátu sa inak z názvu frameu nedajú zistiť.
      // Zapisujeme dvojmo — setPluginData je súkromné pre tento plugin,
      // setSharedPluginData vedia prečítať aj externé nástroje a kontroly.
      try {
        var meta = {
          tbLimit: String(format.limit || ""),
          tbFormatId: String(format.id || ""),
          tbTagging: String(campaignTag || ""),
          tbChannel: String(format.channel || channel || ""),
          tbWidth: String(format.width || ""),
          tbHeight: String(format.height || "")
        };
        for (var mk in meta) {
          frame.setPluginData(mk, meta[mk]);
          frame.setSharedPluginData(TB_NS, mk, meta[mk]);
        }
      } catch (e) {}
      frame.resize(format.width, format.height);
      frame.x = xOffset;
      frame.y = 0;
      frame.clipsContent = true;

      if (layoutType === "video_placeholder") {
        buildVideoPlaceholderLayout(frame, format, layout, hl, figmaImage, figmaLogo);
      } else if (layoutType === "clean_image") {
        buildCleanImageLayout(frame, format, layout, figmaImage);
      } else if (layoutType === "headline_only") {
        buildHeadlineOnlyLayout(frame, format, layout, hl, figmaImage);
      } else if (layoutType === "branding_skin") {
        buildBrandingSkinLayout(frame, format, layout, hl, ctaText, figmaImage, figmaLogo);
      } else if (layoutType === "side_safe") {
        buildSideSafeLayout(frame, format, layout, hl, ctaText, figmaImage, figmaLogo);
      } else if (layoutType === "interscroller_safe") {
        buildInterscrollerSafeLayout(frame, format, layout, hl, ctaText, figmaImage, figmaLogo);
      } else if (layoutType === "native_center") {
        buildNativeCenterLayout(frame, format, layout, hl, figmaImage);
      } else if (layoutType === "email_layout") {
        buildEmailLayout(frame, format, layout, hl, ctaText, figmaImage, figmaLogo);
      } else if (layoutType === "pinterest_pin") {
        buildPinterestPinLayout(frame, format, layout, hl, figmaImage, figmaLogo);
      } else if (layoutType === "strip") {
        buildStripLayout(frame, format, layout, hl, figmaImage, figmaLogo);
      } else if (layoutType === "split") {
        buildSplitLayout(frame, format, layout, hl, figmaImage, figmaLogo);
      } else if (layoutType === "stacked") {
        buildStackedLayout(frame, format, layout, hl, figmaImage, figmaLogo);
      } else if (layoutType === "blurred_bg") {
        buildBlurredBgLayout(frame, format, layout, hl, figmaImage, figmaLogo);
      } else if (layoutType === "logo_only") {
        buildLogoOnlyLayout(frame, format, layout, hl, figmaLogo);
      } else if (layoutType === "micro") {
        buildMicroLayout(frame, format, layout, hl, figmaImage, figmaLogo);
      } else if (layoutType === "adform_psd") {
        buildAdformPsdLayout(frame, format, layout, {
          headline,
          subheadline,
          ctaText,
          legalText,
          badgeText,
          aiGenerated: aiNote
        }, figmaImage, curImgSize, figmaLogo, localAdformTemplate);
      } else if (layoutType === "master_safe") {
        buildMasterSafeLayout(frame, format, layout, {
          headline,
          subheadline,
          ctaText,
          legalText,
          badgeText,
          aiGenerated: aiNote,
          showGuides: guides
        }, figmaImage, curImgSize, figmaLogo, resolveContentBox(format));
      } else {
        buildFullBleedLayout(frame, format, layout, hl, figmaImage, figmaLogo);
      }

      // AI disclosure (vľavo dole) — mimo logo-only a native formátov
      if (
        aiNote && layout.show_ai_disclosure !== false &&
        layoutType !== "logo_only" && layoutType !== "micro" && layoutType !== "clean_image" &&
        layoutType !== "adform_psd" && layoutType !== "master_safe"
      ) {
        addAiNote(frame, format);
      }

      const hasRiskFlags = !!(layout.risk_flags && layout.risk_flags.length);
      if (hasRiskFlags) riskFlaggedCount++;

      if (guides) {
        // Kontrolné rámy a štítky patria iba do výslovne zapnutého QA režimu.
        // Produkčné bannery musia zostať čisté a exportovateľné.
        addRiskFlagBadge(frame, format, layout.risk_flags);
        addRecipeTag(frame, layout.visual_recipe || visualRecipe);
        addValidationBadge(frame, layout);
        addSafeZones(frame, format);
      }

      page.appendChild(frame);
      allFrames.push(frame);
      xOffset += format.width + 80;

      figma.ui.postMessage({ type: "progress", done: allFrames.length, total: formats.length });
    }
  }

  const firstPage = Array.from(figma.root.children).find(p => p.name === channels[0]);
  if (firstPage) figma.currentPage = firstPage;
  if (guides) createValidationReport(formats, headline, adType);
  if (allFrames.length > 0) figma.viewport.scrollAndZoomIntoView(allFrames.slice(0, 3));

  figma.ui.postMessage({ type: "done", formatCount: formats.length, pageCount: channels.length, riskFlaggedCount });
}

// Human-čitateľné popisky pre risk_flags z agent.js — musia sedieť s kódmi tam generovanými.
const RISK_FLAG_LABELS = {
  small_format_no_image: "Malý formát — bez fotky",
  small_format_brand_panel: "Malý formát — brand panel",
  ai_detected_baked_in_text: "AI odhadla, že vizuál už má text",
  ai_detected_baked_in_logo: "AI odhadla, že vizuál už má logo"
};

// Vizuálne upozornenie na frame, keď plugin nie je istý (odhad, nie pravidlo).
// Vracia true, ak bol frame oznacený, aby vedela zratať count na summary hlásenie.
function addRiskFlagBadge(frame, format, flags) {
  if (!flags || flags.length === 0) return false;

  const WARN_COLOR = { r: 0.93, g: 0.52, b: 0.05 };
  const labels = flags.map(f => RISK_FLAG_LABELS[f] || f);

  const badge = figma.createText();
  badge.name = "Risk flag text";
  badge.fontName = { family: "Inter", style: "Bold" };
  badge.characters = "⚠ SKONTROLUJ: " + labels.join(", ");
  badge.fontSize = Math.max(9, Math.min(14, Math.round(Math.min(format.width, format.height) * 0.03)));
  badge.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  badge.textAutoResize = "WIDTH_AND_HEIGHT";
  badge.locked = true;

  const badgeBg = figma.createRectangle();
  badgeBg.name = "Risk flag bg";
  badgeBg.resize(badge.width + 16, badge.height + 10);
  badgeBg.x = 4;
  badgeBg.y = 4;
  badgeBg.fills = [{ type: "SOLID", color: WARN_COLOR }];
  badgeBg.locked = true;

  badge.x = badgeBg.x + 8;
  badge.y = badgeBg.y + 5;

  frame.appendChild(badgeBg);
  frame.appendChild(badge);
  return true;
}

function createValidationReport(formats, headline, adType) {
  const rows = [];
  for (const item of formats) {
    const warnings = (item.layout && item.layout.validation_warnings) || [];
    if (!warnings.length) continue;
    const format = item.format;
    rows.push({
      name: format.name + (format.variantLabel ? " " + format.variantLabel : ""),
      channel: format.channel,
      warnings
    });
  }

  let page = Array.from(figma.root.children).find(p => p.name === "Validation report");
  if (!page) {
    page = figma.createPage();
    page.name = "Validation report";
  }

  const frame = figma.createFrame();
  frame.name = "Validation report - " + adType.toUpperCase();
  frame.resize(1100, Math.max(620, 180 + rows.length * 72));
  frame.x = 0;
  frame.y = 0;
  frame.fills = [{ type: "SOLID", color: { r: 0.97, g: 0.98, b: 1 } }];
  page.appendChild(frame);

  addText(frame, "Kontrola exportov", 48, 40, 900, 48, 34, BRAND_COLOR);
  addText(frame, headline || "Bez headline", 48, 92, 900, 36, 18, { r: 0.25, g: 0.28, b: 0.33 });

  if (!rows.length) {
    addText(frame, "Bez automatických upozornení. Stále skontroluj crop, čitateľnosť a logo pred exportom.", 48, 170, 900, 80, 20, { r: 0.15, g: 0.44, b: 0.24 });
    return;
  }

  let y = 160;
  for (const row of rows) {
    addSolidRect(frame, "Warning row", 40, y - 10, 1020, 58, { r: 1, g: 1, b: 1 }, 1);
    addText(frame, row.channel + " / " + row.name, 56, y, 320, 30, 15, BRAND_COLOR);
    addText(frame, humanizeWarnings(row.warnings), 390, y, 640, 42, 13, { r: 0.32, g: 0.23, b: 0.08 });
    y += 72;
  }
}

function humanizeWarnings(warnings) {
  const labels = {
    video_needs_manual_motion: "Video: vytvorený je iba statický placeholder.",
    static_thumbnail_only: "Skontrolovať thumbnail a ručný motion/export.",
    video_format_requires_manual_animation_or_export: "Vyžaduje video export alebo animáciu mimo tohto pluginu.",
    uploaded_visual_contains_text_but_this_asset_should_be_clean_image: "Google/DemandGen image asset má byť bez textu/loga.",
    headline_may_overflow_small_format: "Headline môže byť dlhý pre malý formát.",
    pinterest_text_over_5_words: "Pinterest text by mal mať max. 5 slov / 30% plochy.",
    image_uses_fit_check_background_edges: "Obrázok je vo FIT režime, skontroluj okraje/pozadie.",
    small_or_wide_format_check_readability: "Malý alebo veľmi široký formát, skontroluj čitateľnosť.",
    safe_zone_overlay_present_check_final_export: "Je pridaná safe-zone vrstva, pred exportom skontroluj pravidlá.",
    master_core_50pct_check: "Master: dôležitá grafika musí zostať v stredovej polovici (2000×2000 z 4000×4000)."
  };
  return warnings.map(w => labels[w] || w).join(" ");
}

function addValidationBadge(frame, layout) {
  const warnings = (layout && layout.validation_warnings) || [];
  if (!warnings.length) return;

  const pad = Math.round(clamp(Math.min(frame.width, frame.height) * 0.025, 8, 20));
  const badgeW = Math.round(clamp(frame.width * 0.44, 120, 420));
  const badgeH = Math.round(clamp(frame.height * 0.055, 28, 54));
  addSolidRect(frame, "Validation warning badge", frame.width - badgeW - pad, pad, badgeW, badgeH, { r: 1, g: 0.78, b: 0.20 }, 0.92);

  const text = figma.createText();
  text.name = "Validation warning";
  text.fontName = FONT;
  text.characters = warnings.length + " check" + (warnings.length > 1 ? "s" : "");
  text.fontSize = Math.round(clamp(badgeH * 0.42, 10, 18));
  text.fills = [{ type: "SOLID", color: { r: 0.22, g: 0.16, b: 0.02 } }];
  text.textAlignHorizontal = "CENTER";
  text.textAutoResize = "HEIGHT";
  text.resize(badgeW - 12, badgeH);
  text.x = frame.width - badgeW - pad + 6;
  text.y = pad + Math.round(badgeH * 0.25);
  text.locked = true;
  frame.appendChild(text);
}

function addRecipeTag(frame, recipe) {
  if (!recipe) return;

  const tag = figma.createText();
  tag.name = "Recipe";
  tag.fontName = { family: "Inter", style: "Regular" };
  tag.characters = "Recipe: " + recipe.visualType + " / " + recipe.subjectPosition + " / " + recipe.cropMode;
  tag.fontSize = Math.max(8, Math.min(13, Math.round(frame.height * 0.018)));
  tag.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 }, opacity: 0.7 }];
  tag.textAutoResize = "WIDTH_AND_HEIGHT";
  tag.x = Math.round(Math.min(frame.width, frame.height) * 0.025);
  tag.y = frame.height - Math.round(Math.min(frame.width, frame.height) * 0.025) - tag.height;
  tag.locked = true;
  frame.appendChild(tag);
}

// Pomocná funkcia: vloží logo do ľavého horného rohu (alebo inej pozície)
// logoH = výška logo rectu, pad = vnútorný padding
function placeLogo(frame, figmaLogo, x, y, w, h) {
  if (!figmaLogo) return;
  // min. veľkosť loga 50 px (dotazník) — proporčne dorovnaj
  if (w < STYLE.minLogoPx) { const k = STYLE.minLogoPx / w; w = Math.round(w * k); h = Math.round(h * k); }
  const logoRect = figma.createRectangle();
  logoRect.name = "Logo";
  logoRect.resize(w, h);
  logoRect.x = x;
  logoRect.y = y;
  logoRect.fills = [{ type: "IMAGE", imageHash: figmaLogo.hash, scaleMode: "FIT" }];
  frame.appendChild(logoRect);
}

// Lokálny layout resolver — použije sa pri Excel ceste (rozmery z tabuľky od
// mediálky), keď layout nepríde zo servera. Deterministický, podľa pomeru strán
// (mirror agent.js). Default FILL (žiadne brand pásy).
function resolveLayoutLocal(format) {
  const ratio = format.width / format.height;
  const base = {
    show_headline: true,
    show_logo: true,
    image_fit: "fill",
    headline_size_px: Math.min(72, Math.max(10, Math.round(format.height * 0.07)))
  };
  if (format.height <= 120 || (ratio > 6 && format.height <= 150)) {
    const forcedLogoOnly = (format.id && format.id.indexOf("google_logo") !== -1) ||
      !!(format.rules && format.rules.logoOnly);
    if (forcedLogoOnly) {
      return Object.assign({}, base, { layout_type: "logo_only", image_fit: "none", show_headline: false });
    }
    return Object.assign({}, base, { layout_type: "micro" });
  }
  if (ratio > 3.5 && format.height < 300) return Object.assign({}, base, { layout_type: "strip" });
  if (ratio > 3.5) return Object.assign({}, base, { layout_type: "split" });
  if (ratio < 0.3) return Object.assign({}, base, { layout_type: "stacked" });
  return Object.assign({}, base, { layout_type: "full_bleed" }); // portrét, štvorec, landscape
}

function shouldShowHeadline(layout, headline) {
  return layout.show_headline !== false && !!headline;
}

function shouldShowLogo(format, layout, figmaLogo) {
  return !!figmaLogo && !format.noLogo && layout.show_logo !== false;
}

// Jednotné rozhodnutie, či sa má kresliť subheadline — volá sa z
// buildFullBleedLayout aj z oboch vetiev buildMasterSafeLayout, nech
// logika nie je na dvoch miestach v dvoch tvaroch (P0-9).
// availableHeight (voliteľné): koľko výšky reálne ostáva pre subheadline
// po odpočítaní CTA, loga a AI tagu — keď sa nepošle, kontroluje sa len
// minimálny rozmer formátu.
function shouldShowSubheadline(format, layout, availableHeight) {
  if (layout && layout.show_subheadline === false) return false;
  if (typeof availableHeight === "number" &&
      availableHeight < TB.subheadline(format.width, format.height) * 1.6) {
    return false;
  }
  return true;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function expandPairedBrandingFormats(formats) {
  return formats.flatMap(function (item) {
    const f = item.format || {};
    if (f.role !== "branding_side" || Number(f.count || 1) !== 2 || f.variantSide) return [item];
    return ["left", "right"].map(function (side, index) {
      return {
        format: Object.assign({}, f, {
          variantSide: side,
          variantLabel: "v" + (index + 1) + "/2",
          baseId: String(f.baseId || f.id) + "_branding_side"
        }),
        layout: item.layout
      };
    });
  });
}

// Krytie scrimu/panelu odvodené z priemernej luminancie dolných 40 % KV
// (layout.kv_luma_bottom, poslané z ui.html cez <canvas>+getImageData).
// Svetlý KV → menej krytia, tmavý → viac, ale v jemnom rozsahu 46–64 %.
// Bez dát používame referenčnú strednú hodnotu 58 %.
function scrimAlphaFor(layout) {
  if (!layout || typeof layout.kv_luma_bottom !== "number") return 0.58;
  const luma = layout.kv_luma_bottom;
  // Jemný brand scrim: fotografia zostáva viditeľná. Predošlý rozsah až
  // 90 % robil z gradientu takmer čierny panel a odporoval 55 % referencii.
  return clamp(0.46 + (1 - luma) * 0.18, 0.46, 0.64);
}

function addImageRect(frame, figmaImage, name, x, y, w, h, scaleMode) {
  const rect = figma.createRectangle();
  rect.name = name;
  rect.resize(w, h);
  rect.x = x;
  rect.y = y;
  rect.fills = figmaImage
    ? [{ type: "IMAGE", imageHash: figmaImage.hash, scaleMode: scaleMode || "FILL" }]
    : [{ type: "SOLID", color: { r: 0.86, g: 0.88, b: 0.92 } }];
  frame.appendChild(rect);
  return rect;
}

function addText(frame, headline, x, y, w, h, fontSize, color, align) {
  const txt = figma.createText();
  txt.fontName = FONT;
  txt.characters = headline || "HEADLINE";
  txt.fontSize = fontSize;
  txt.fills = [{ type: "SOLID", color: color || { r: 1, g: 1, b: 1 } }];
  txt.textAlignHorizontal = align || "LEFT";
  txt.textAutoResize = "HEIGHT";
  txt.resize(w, h);
  txt.x = x;
  txt.y = y;
  frame.appendChild(txt);
  return txt;
}

function addSolidRect(frame, name, x, y, w, h, color, opacity) {
  const rect = figma.createRectangle();
  rect.name = name;
  rect.resize(w, h);
  rect.x = x;
  rect.y = y;
  rect.fills = [{ type: "SOLID", color, opacity: opacity === undefined ? 1 : opacity }];
  frame.appendChild(rect);
  return rect;
}

function buildVideoPlaceholderLayout(frame, format, layout, headline, figmaImage, figmaLogo) {
  frame.fills = [{ type: "SOLID", color: BRAND_COLOR }];
  addImageRect(frame, figmaImage, "Thumbnail base - manual video needed", 0, 0, format.width, format.height, "FILL");
  addSolidRect(frame, "Video dim overlay", 0, 0, format.width, format.height, BRAND_COLOR, 0.46);

  const topSafe = (format.safeZones && format.safeZones.top) || 0;
  const bottomSafe = (format.safeZones && format.safeZones.bottom) || 0;
  const pad = getReadablePad(format);
  const safeY = topSafe + pad;
  const safeH = format.height - topSafe - bottomSafe - pad * 2;

  if (shouldShowLogo(format, layout, figmaLogo)) {
    const logoH = Math.round(clamp(format.height * 0.055, 42, 76));
    const logoW = Math.min(Math.round(logoH * 3.5), format.width - pad * 2);
    placeLogo(frame, figmaLogo, pad, safeY, logoW, logoH);
  }

  const panelH = Math.round(clamp(format.height * 0.18, 140, 260));
  const panelY = topSafe + safeH - panelH;
  addSolidRect(frame, "Manual video note panel", pad, panelY, format.width - pad * 2, panelH, { r: 1, g: 1, b: 1 }, 0.92);
  addText(frame, "VIDEO PLACEHOLDER", pad * 1.6, panelY + pad, format.width - pad * 3.2, 34, Math.round(clamp(format.width * 0.038, 22, 42)), BRAND_COLOR, "CENTER");
  addText(frame, headline || "Doplniť motion/storyboard", pad * 1.6, panelY + pad + 52, format.width - pad * 3.2, panelH - pad * 2 - 52, Math.round(clamp(format.width * 0.032, 18, 34)), { r: 0.12, g: 0.14, b: 0.18 }, "CENTER");
}

function getReadablePad(format) {
  return Math.round(clamp(Math.min(format.width, format.height) * 0.055, 12, 64));
}

// Google RSA / Demand Gen image assets: no text, no logo.
function buildCleanImageLayout(frame, format, layout, figmaImage) {
  frame.fills = [{ type: "SOLID", color: { r: 0.96, g: 0.97, b: 0.98 } }];
  if (layout.image_fit === "contain" || !CUR_IMG_W || !CUR_IMG_H) {
    addImageRect(frame, figmaImage, "Image asset - no text / no logo", 0, 0, format.width, format.height, layout.image_fit === "contain" ? "FIT" : "FILL");
  } else {
    // Clean assets majú vyplniť plátno bez bielych technických pásov z KV.
    const cleanRatio = format.width / format.height;
    const cleanFocal = {
      x: typeof layout.crop_anchor_x === "number" ? layout.crop_anchor_x : 0.5,
      y: typeof layout.crop_anchor_y === "number" ? layout.crop_anchor_y : 0.5
    };
    addFocalImageFrame(
      frame, figmaImage, { width: CUR_IMG_W, height: CUR_IMG_H },
      "Image asset - no text / no logo", [0, 0, format.width, format.height],
      cleanFocal, { x: 0.5, y: cleanRatio > 1.45 ? 0.62 : 0.5 }, 1.08
    );
  }
}

// Performance Max: headline only, system adds CTA/logo.
function buildHeadlineOnlyLayout(frame, format, layout, headline, figmaImage) {
  buildCleanImageLayout(frame, format, layout, figmaImage);
  if (!shouldShowHeadline(layout, headline)) return;

  const pad = getReadablePad(format);
  const isPortrait = format.height > format.width * 1.15;
  const boxH = Math.round(format.height * (isPortrait ? 0.24 : 0.34));
  const boxY = isPortrait ? format.height - boxH : Math.round(format.height * 0.12);
  addSolidRect(frame, "Headline scrim", 0, boxY, format.width, boxH, BRAND_COLOR, 0.88);

  const fontSize = Math.round(clamp(format.height * (isPortrait ? 0.045 : 0.085), 20, 62));
  addText(frame, headline, pad, boxY + pad, format.width - pad * 2, boxH - pad * 2, fontSize, { r: 1, g: 1, b: 1 });
}

// Full page branding: keep central website content readable/empty.
function buildBrandingSkinLayout(frame, format, layout, headline, ctaText, figmaImage, figmaLogo) {
  frame.fills = [{ type: "SOLID", color: BRAND_COLOR }];
  addImageRect(frame, figmaImage, "Background image", 0, 0, format.width, format.height, "FILL");
  addSolidRect(frame, "Dim brand background", 0, 0, format.width, format.height, BRAND_COLOR, 0.34);

  const topOffset = (format.safeZones && format.safeZones.topOffset) || 200;
  const centerW = (format.safeZones && format.safeZones.centerWidth) || 1000;
  const sideW = Math.round((format.width - centerW) / 2);
  const pad = 44;

  // Rozmer typu 1200×200 + 2×200×700 je brandingová ZOSTAVA. Samostatný
  // 1200×200 frame je iba horný pás; nesmie dostať vertikálny side-skin
  // layout, ktorý by umiestnil headline a CTA stovky pixelov pod frame.
  if (format.height <= topOffset || sideW <= pad * 2) {
    if (shouldShowLogo(format, layout, figmaLogo)) {
      const stripLogoW = Math.round(clamp(format.width * 0.10, 72, 140));
      const stripLogoH = Math.round(clamp(format.height * 0.32, 36, 64));
      const stripY = Math.round((format.height - stripLogoH) / 2);
      placeLogo(frame, figmaLogo, pad, stripY, stripLogoW, stripLogoH);
      placeLogo(frame, figmaLogo, format.width - pad - stripLogoW, stripY, stripLogoW, stripLogoH);
    }
    return;
  }
  const logoH = 58;
  const logoW = Math.min(Math.round(logoH * 3.5), sideW - pad * 2);

  if (shouldShowLogo(format, layout, figmaLogo)) {
    placeLogo(frame, figmaLogo, pad, 48, logoW, logoH);
    placeLogo(frame, figmaLogo, format.width - sideW + pad, 48, logoW, logoH);
  }

  const headlineY = topOffset + 80;
  if (shouldShowHeadline(layout, headline)) {
    const fontSize = 42;
    addText(frame, headline, pad, headlineY, sideW - pad * 2, 260, fontSize, { r: 1, g: 1, b: 1 });
    addText(frame, headline, format.width - sideW + pad, headlineY, sideW - pad * 2, 260, fontSize, { r: 1, g: 1, b: 1 });
  }

  // CTA v oboch stĺpcoch, zrkadlené rovnako ako logo/headline vyššie —
  // rovnaký #0047F8 button ako master_safe/PSD (P0-9b, na žiadosť
  // nedropovať CTA, ktoré tu predtým bolo cez master_safe).
  if (layout.show_cta !== false && ctaText) {
    const btnH = 54;
    const btnY = headlineY + 260 + 24;
    const btnW = sideW - pad * 2;
    addMasterCta(frame, ctaText, pad, btnY, btnW, btnH);
    addMasterCta(frame, ctaText, format.width - sideW + pad, btnY, btnW, btnH);
  }

  const isJoj = format.id === "joj_branding" || /joj\.sk/i.test(String(format.channel || ""));
  addSolidRect(
    frame,
    isJoj ? "JOJ white website content area" : "Website content area guide",
    sideW,
    topOffset,
    centerW,
    format.height - topOffset,
    { r: 1, g: 1, b: 1 },
    isJoj ? 1 : 0.08
  );
}

function buildSideSafeLayout(frame, format, layout, headline, ctaText, figmaImage, figmaLogo) {
  frame.fills = [{ type: "SOLID", color: BRAND_COLOR }];
  const sideTargetX = format.variantSide === "left" ? 0.72 : (format.variantSide === "right" ? 0.28 : 0.5);
  if (figmaImage && CUR_IMG_W && CUR_IMG_H) {
    addFocalImageFrame(
      frame, figmaImage, { width: CUR_IMG_W, height: CUR_IMG_H },
      "Background image — " + (format.variantSide || "center") + " crop",
      [0, 0, format.width, format.height],
      { x: typeof layout.crop_anchor_x === "number" ? layout.crop_anchor_x : 0.5,
        y: typeof layout.crop_anchor_y === "number" ? layout.crop_anchor_y : 0.5 },
      { x: sideTargetX, y: 0.5 }
    );
  } else {
    addImageRect(frame, figmaImage, "Background image", 0, 0, format.width, format.height, "FILL");
  }
  addSolidRect(frame, "Brand overlay", 0, 0, format.width, format.height, BRAND_COLOR, 0.62);

  // Bug (P0-9): čítalo layout.safe_content, čo sa nikde nenastavuje —
  // vždy padlo na default 160×600 bez ohľadu na skutočnú safe zónu
  // formátu (napr. pravda 200×700 má safeInner 120×600, nie 160×600).
  const safe = (format.safeZones && format.safeZones.safeInner) || {};
  const contentW = Math.min(format.width, safe.width || 160);
  const contentH = Math.min(format.height, safe.height || 600);
  const x = Math.round((format.width - contentW) / 2);
  const y = Math.round((format.height - contentH) / 2);
  const pad = Math.round(clamp(contentW * 0.1, 10, 18));

  if (shouldShowLogo(format, layout, figmaLogo)) {
    const logoH = Math.round(clamp(contentH * 0.08, 28, 52));
    const logoW = Math.min(Math.round(logoH * 3.5), contentW - pad * 2);
    placeLogo(frame, figmaLogo, x + pad, y + pad, logoW, logoH);
  }

  // CTA nad spodným okrajom safe zóny — rovnaký button ako master_safe/PSD
  // ("CTA above the bank lockup" v PSD referencii pre 160×600). Rezervuje
  // sa PRED headlineom, nech text nikdy nekoliduje s tlačidlom.
  const showCta = layout.show_cta !== false && !!ctaText;
  let ctaTop = y + contentH - pad;
  if (showCta) {
    const btnH = Math.round(clamp(contentH * 0.08, 26, 44));
    const btnW = contentW - pad * 2;
    const btnY = y + contentH - pad - btnH;
    addMasterCta(frame, ctaText, x + pad, btnY, btnW, btnH);
    ctaTop = btnY - Math.round(pad * 0.6);
  }

  if (shouldShowHeadline(layout, headline)) {
    const fontSize = Math.round(clamp(contentW * 0.12, 13, 24));
    const textY = y + Math.round(contentH * 0.28);
    addText(frame, headline, x + pad, textY, contentW - pad * 2, Math.max(20, ctaTop - textY), fontSize, { r: 1, g: 1, b: 1 }, "CENTER");
  }
}

function getInterscrollerSafeBox(format) {
  const top = (format.safeZones && format.safeZones.top) || 0;
  const bottom = (format.safeZones && format.safeZones.bottom) || 0;
  const sides = (format.safeZones && format.safeZones.sides) || 0;
  return {
    x: sides,
    y: top,
    w: format.width - sides * 2,
    h: format.height - top - bottom
  };
}

function getInterscrollerComposition(format) {
  const safe = getInterscrollerSafeBox(format);
  const pad = Math.round(clamp(Math.min(safe.w, safe.h) * 0.055, 16, 54));
  const wide = safe.w / safe.h >= 1.35;
  const panelW = wide
    ? Math.round(clamp(safe.w * 0.44, 300, safe.w - pad * 2))
    : Math.max(80, safe.w - pad * 2);
  const panelH = Math.round(clamp(safe.h * (wide ? 0.36 : 0.24), 120, Math.min(330, safe.h - pad * 2)));
  const panelX = safe.x + pad;
  const panelY = safe.y + safe.h - panelH - pad;
  const inner = Math.round(clamp(Math.min(panelW, panelH) * 0.10, 14, 36));
  const btnH = Math.round(clamp(panelH * 0.20, 30, 52));
  const btnW = Math.round(clamp(panelW * 0.42, 110, Math.min(280, panelW - inner * 2)));
  return { safe, pad, wide, panelX, panelY, panelW, panelH, inner, btnW, btnH };
}

function buildInterscrollerSafeLayout(frame, format, layout, headline, ctaText, figmaImage, figmaLogo) {
  frame.fills = [{ type: "SOLID", color: { r: layout.bg_r || 0.05, g: layout.bg_g || 0.07, b: layout.bg_b || 0.16 } }];
  addImageRect(frame, figmaImage, "Image background", 0, 0, format.width, format.height, "FILL");

  const comp = getInterscrollerComposition(format);
  const safe = comp.safe;
  addSolidRect(frame, "Readable message panel", comp.panelX, comp.panelY, comp.panelW, comp.panelH, BRAND_COLOR, 0.88);

  if (shouldShowLogo(format, layout, figmaLogo)) {
    const logoH = Math.round(clamp(safe.h * 0.045, 34, 70));
    const logoW = Math.min(Math.round(logoH * 3.5), safe.w - comp.pad * 2);
    placeLogo(frame, figmaLogo, safe.x + comp.pad, safe.y + comp.pad, logoW, logoH);
  }

  // CTA v spodnej časti panelu — rovnaký button ako master_safe/PSD
  // ("CTA bottom-left" v PSD referencii pre 300×600). Rezervované miesto
  // sa odráta od výšky headlinu, nech nekolidujú.
  const showCta = layout.show_cta !== false && !!ctaText;
  let ctaBudget = 0;
  if (showCta) {
    const btnX = comp.panelX + comp.inner;
    const btnY = comp.panelY + comp.panelH - comp.inner - comp.btnH;
    addMasterCta(frame, ctaText, btnX, btnY, comp.btnW, comp.btnH);
    ctaBudget = comp.btnH + Math.round(comp.inner * 0.55);
  }

  if (shouldShowHeadline(layout, headline)) {
    const fontSize = Math.round(clamp(comp.panelH * 0.16, 18, 46));
    const headlineNode = addText(
      frame, headline, comp.panelX + comp.inner, comp.panelY + comp.inner,
      comp.panelW - comp.inner * 2, comp.panelH - comp.inner * 2 - ctaBudget,
      fontSize, { r: 1, g: 1, b: 1 }
    );
    headlineNode.name = "Headline";
  }
}

function buildNativeCenterLayout(frame, format, layout, headline, figmaImage) {
  frame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  const pad = Math.round(format.width * 0.06);
  const imageH = Math.round(format.height * 0.70);
  addImageRect(frame, figmaImage, "Native image 3:2", pad, pad, format.width - pad * 2, imageH - pad, "FILL");

  if (shouldShowHeadline(layout, headline)) {
    const fontSize = Math.round(clamp(format.width * 0.055, 24, 38));
    addText(frame, headline, pad, imageH + pad, format.width - pad * 2, format.height - imageH - pad * 2, fontSize, BRAND_COLOR);
  }
}

function buildEmailLayout(frame, format, layout, headline, ctaText, figmaImage, figmaLogo) {
  frame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  const heroH = Math.round(format.height * 0.54);
  addImageRect(frame, figmaImage, "Hero image", 0, 0, format.width, heroH, "FILL");
  addSolidRect(frame, "Content area", 0, heroH, format.width, format.height - heroH, { r: 1, g: 1, b: 1 }, 1);

  const pad = Math.round(clamp(format.width * 0.07, 28, 56));
  if (shouldShowLogo(format, layout, figmaLogo)) {
    const logoH = Math.round(clamp(format.width * 0.08, 38, 62));
    placeLogo(frame, figmaLogo, pad, heroH + pad, Math.round(logoH * 3.5), logoH);
  }

  // CTA v spodnej časti content area — rovnaký button ako master_safe/PSD.
  // Rezervované PRED headlineom, nech text nikdy nekoliduje s tlačidlom.
  const showCta = layout.show_cta !== false && !!ctaText;
  let contentBottom = format.height - pad;
  if (showCta) {
    const btnH = Math.round(clamp(format.width * 0.09, 36, 56));
    const btnW = Math.max(120, Math.round(format.width * 0.30));
    const btnY = format.height - pad - btnH;
    addMasterCta(frame, ctaText, pad, btnY, btnW, btnH);
    contentBottom = btnY - Math.round(pad * 0.5);
  }

  if (shouldShowHeadline(layout, headline)) {
    const fontSize = Math.round(clamp(format.width * 0.055, 28, 44));
    // Pôvodná medzera (13 % šírky) rátala s celou content area voľnou pre
    // headline. Keď CTA zabral spodok, rovnaká medzera by headline
    // stlačila na pár px — s CTA použi menšiu, pevnú medzeru.
    const textY = heroH + pad + Math.round(showCta ? pad * 0.4 : format.width * 0.13);
    addText(frame, headline, pad, textY, format.width - pad * 2, Math.max(20, contentBottom - textY), fontSize, BRAND_COLOR);
  }
}

function buildPinterestPinLayout(frame, format, layout, headline, figmaImage, figmaLogo) {
  // Pinterest Pin (2:3) používa rovnaký Surďov full-bleed look ako ostatné
  // portrét formáty: KV na celý frame + jemný gradient scrim + headline vľavo
  // dole + logo vpravo dole. Žiadny tvrdý modrý panel.
  buildFullBleedLayout(frame, format, layout, headline, figmaImage, figmaLogo);
}

// Brand farba pozadia, fotka vpravo (contain 30%), text+logo vľavo
// Pre height < 300 — 728×90, 970×250, 1200×200
function buildStripLayout(frame, format, layout, headline, figmaImage, figmaLogo) {
  frame.fills = [{ type: "SOLID", color: BRAND_COLOR }];

  const pad = Math.round(format.height * 0.12);
  const photoW = Math.round(format.width * 0.35);
  const textZoneW = format.width - photoW - pad * 2;

  // Fotka vpravo — FILL mode (oreže na plochu, bez čiernych okrajov)
  if (figmaImage) {
    const photoRect = figma.createRectangle();
    photoRect.name = "Foto";
    photoRect.resize(photoW, format.height);
    photoRect.x = format.width - photoW;
    photoRect.y = 0;
    photoRect.fills = [{ type: "IMAGE", imageHash: figmaImage.hash, scaleMode: layout.image_fit === "contain" ? "FIT" : "FILL" }];
    frame.appendChild(photoRect);
  }

  // Logo vľavo hore — max 45% výšky, max 64px
  const logoH = Math.min(Math.round(format.height * 0.45), 64);
  const logoW = Math.round(logoH * 3.5);
  if (shouldShowLogo(format, layout, figmaLogo)) {
    placeLogo(frame, figmaLogo, pad, pad, logoW, logoH);
  }

  if (!shouldShowHeadline(layout, headline)) return;

  // Headline pod logom — jasne oddelené
  const fontSize = Math.max(7, Math.min(layout.headline_size_px || 18, Math.floor(format.height * 0.20)));
  const txt = figma.createText();
  txt.fontName = FONT;
  txt.characters = headline || "HEADLINE";
  txt.fontSize = fontSize;
  txt.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  txt.resize(textZoneW, format.height);
  txt.textAutoResize = "HEIGHT";
  txt.x = pad;
  txt.y = pad + logoH + Math.round(format.height * 0.08);
  frame.appendChild(txt);
}

// Presné kompozície z referenčného PSD Adform_dievca.psd.
// Súradnice sú lokálne voči jednotlivým artboardom v PSD.
const ADFORM_PSD_RULES = {
  "adform_300x600": {
    slogan: [20, 22, 75, 20],
    badge: [16, 268, 148, 82],
    headline: [21, 367, 260, 75],
    headlineSize: 26,
    legal: [21, 455, 152, 24],
    legalSize: 7,
    cta: [20, 496, 140, 48],
    bankLogo: [210, 511, 70, 70],
    ai: [23, 562, 100, 19]
  },
  "adform_160x600": {
    slogan: [43, 22, 75, 20],
    badge: [74, 83, 83, 47],
    headline: [11, 175, 138, 143],
    headlineSize: 24,
    cta: [10, 340, 140, 48],
    bankLogo: [37, 420, 86, 85],
    ai: [32, 528, 100, 19],
    legal: [13, 567, 137, 22],
    legalSize: 7,
    panel: [0, 310, 160, 290]
  },
  "adform_300x250": {
    slogan: [20, 18, 74, 20],
    headline: [20, 62, 190, 55],
    headlineSize: 19,
    badge: [201, 108, 83, 47],
    legal: [20, 130, 137, 22],
    legalSize: 7,
    cta: [20, 167, 121, 41],
    bankLogo: [215, 173, 64, 62],
    ai: [21, 217, 100, 19]
  },
  "adform_970x250": {
    badge: [16, 23, 146, 80],
    headline: [460, 55, 363, 105],
    headlineSize: 36,
    slogan: [852, 28, 91, 24],
    cta: [459, 177, 140, 48],
    bankLogo: [853, 139, 88, 86],
    legal: [618, 203, 137, 22],
    legalSize: 7,
    ai: [30, 208, 100, 19]
  }
};

function addTemplateText(frame, name, value, box, fontSize, color, style, align, vAlign) {
  if (!value || !box) return null;
  const txt = figma.createText();
  txt.name = name;
  txt.fontName = style === "Regular" ? FONT_REGULAR : (style === "Light" ? FONT_LIGHT : FONT);
  txt.characters = value;
  txt.fontSize = fontSize;
  txt.fills = [{ type: "SOLID", color: color || { r: 1, g: 1, b: 1 } }];
  txt.textAlignHorizontal = align || "LEFT";
  try {
    txt.lineHeight = { value: style === "Regular" ? 110 : 100, unit: "PERCENT" };
    txt.letterSpacing = { value: style === "Regular" ? -1.5 : -2.5, unit: "PERCENT" };
  } catch (e) {}
  try {
    const slova = String(value).split(/\s+/);
    let najdlhsie = "";
    for (let i = 0; i < slova.length; i++)
      if (slova[i].length > najdlhsie.length) najdlhsie = slova[i];
    if (najdlhsie) {
      const merac = figma.createText();
      merac.fontName = txt.fontName;
      merac.characters = najdlhsie;
      merac.fontSize = fontSize;
      merac.textAutoResize = "WIDTH_AND_HEIGHT";
      frame.appendChild(merac);
      if (merac.width > box[2] && merac.width > 0) {
        txt.fontSize = Math.max(12, Math.floor(fontSize * (box[2] / merac.width)));
      }
      merac.remove();
    }
  } catch (e) {}
  const _pomer = frame.width > 0 ? (frame.height / frame.width) : 1;
  const maxRiadkov = _pomer >= 1.7 ? 4 : (_pomer >= 1.0 ? 3 : 2);

  try {
    const m2 = figma.createText();
    m2.fontName = txt.fontName;
    m2.characters = String(value);
    m2.fontSize = txt.fontSize;
    try { m2.lineHeight = txt.lineHeight; } catch (e) {}
    try { m2.letterSpacing = txt.letterSpacing; } catch (e) {}
    m2.resize(box[2], 10);
    m2.textAutoResize = "HEIGHT";
    frame.appendChild(m2);

    const riadkov = function () { return Math.max(1, Math.round(m2.height / (m2.fontSize * 1.05))); };
    let velkost = m2.fontSize;
    let poistka = 0;
    while ((m2.height > box[3] || riadkov() > maxRiadkov) && velkost > 12 && poistka < 24) {
      velkost = Math.max(12, Math.floor(velkost * 0.92));
      m2.fontSize = velkost;
      poistka++;
    }
    txt.fontSize = velkost;
    m2.remove();
  } catch (e) {}

  if (vAlign === "CENTER") {
    txt.textAutoResize = "NONE";
    txt.resize(box[2], box[3]);
    txt.textAlignVertical = "CENTER";
  } else {
    txt.resize(box[2], box[3]);
    txt.textAutoResize = "HEIGHT";
  }

  txt.x = box[0];
  txt.y = box[1];
  frame.appendChild(txt);
  return txt;
}

// Figma vypočíta skutočnú výšku až po zalomení textu. Kompozícia preto
// najprv text odmeria a až potom skladá bloky; percentuálne placeholder boxy
// vytvárali pri jednom riadku neprimerané prázdne medzery.
function measureTemplateTextHeight(frame, value, width, fontSize, style) {
  if (!value) return 0;
  const probe = addTemplateText(
    frame, "__typography_measure__", value,
    [0, 0, Math.max(40, width), Math.max(frame.height, fontSize * 6)],
    fontSize, { r: 1, g: 1, b: 1 }, style, "LEFT"
  );
  if (!probe) return 0;
  const height = Math.ceil(probe.height);
  probe.remove();
  return height;
}

function addSloganLogo(frame, box) {
  if (!box) return;
  const slashW = Math.max(10, Math.round(box[2] * 0.20));
  addTemplateText(
    frame, "Myslite na seba symbol", "/", [box[0], box[1], slashW, box[3]],
    Math.round(box[3] * 1.05), { r: 1, g: 1, b: 1 }, "Bold", "CENTER"
  );
  addTemplateText(
    frame, "Myslite na seba", "Myslite\nna seba",
    [box[0] + slashW - 1, box[1], box[2] - slashW + 1, box[3]],
    Math.max(5, Math.round(box[3] * 0.37)),
    { r: 1, g: 1, b: 1 }, "Bold", "LEFT"
  );
}

function addAdformBackgroundTreatment(frame, format, rules, templateId) {
  const activeTemplate = templateId || adformTemplateId(format) || format.id;
  if (activeTemplate === "adform_970x250") {
    // PSD: KV na ľavej strane, pevný modrosivý brand panel vpravo.
    addSolidRect(frame, "Brand panel", 425, 0, 545, 250, { r: 0.19, g: 0.27, b: 0.37 }, 1);
    return;
  }
  if (rules.panel) {
    addSolidRect(
      frame, "Dark lower panel",
      rules.panel[0], rules.panel[1], rules.panel[2], rules.panel[3],
      { r: 0.12, g: 0.10, b: 0.10 }, 0.94
    );
    return;
  }

  const gradient = figma.createRectangle();
  gradient.name = activeTemplate === "adform_300x600" ? "Bottom readability gradient" : "Left readability gradient";
  gradient.resize(format.width, format.height);
  gradient.x = 0;
  gradient.y = 0;
  gradient.fills = [{
    type: "GRADIENT_LINEAR",
    gradientTransform: activeTemplate === "adform_300x600"
      ? [[0, 1, 0], [1, 0, 0]]
      : [[1, 0, 0], [0, 1, 0]],
    gradientStops: [
      { position: 0, color: { r: 0.04, g: 0.04, b: 0.05, a: 0.06 } },
      { position: 1, color: { r: 0.04, g: 0.04, b: 0.05, a: 0.78 } }
    ]
  }];
  frame.appendChild(gradient);
}

function addFocalImageFrame(parent, figmaImage, imageSize, name, zone, focal, desired, overscan) {
  const holder = figma.createFrame();
  holder.name = name;
  holder.resize(zone[2], zone[3]);
  holder.x = zone[0];
  holder.y = zone[1];
  holder.clipsContent = true;
  holder.fills = [];
  parent.appendChild(holder);

  if (!figmaImage || !imageSize || !imageSize.width || !imageSize.height) {
    holder.fills = [{ type: "SOLID", color: { r: 0.84, g: 0.86, b: 0.9 } }];
    return holder;
  }

  const scale = Math.max(zone[2] / imageSize.width, zone[3] / imageSize.height) * (overscan || 1);
  const renderedW = imageSize.width * scale;
  const renderedH = imageSize.height * scale;
  const rect = figma.createRectangle();
  rect.name = "Key visual — focal crop";
  rect.resize(renderedW, renderedH);
  rect.fills = [{ type: "IMAGE", imageHash: figmaImage.hash, scaleMode: "FILL" }];

  const focalX = clamp(focal.x, 0, 1);
  const focalY = clamp(focal.y, 0, 1);
  const targetX = zone[2] * desired.x;
  const targetY = zone[3] * desired.y;
  rect.x = clamp(targetX - focalX * renderedW, zone[2] - renderedW, 0);
  rect.y = clamp(targetY - focalY * renderedH, zone[3] - renderedH, 0);
  holder.appendChild(rect);
  return holder;
}

// TP master: 4000×4000 s dôležitým obsahom v stredových 2000×2000.
// Do obrazovej zóny vkladáme celý master. Centrálne jadro je ochrana proti
// orezu vonkajších okrajov, nie pokyn zväčšiť jadro na celý cieľový formát.
function addMasterCoreImage(parent, figmaImage, imageSize, zone, focal, showGuide) {
  const holder = figma.createFrame();
  holder.name = "TP master — centrálne jadro 50 %";
  holder.resize(zone[2], zone[3]);
  holder.x = zone[0];
  holder.y = zone[1];
  holder.clipsContent = true;
  holder.fills = [];
  parent.appendChild(holder);

  if (!figmaImage || !imageSize || !imageSize.width || !imageSize.height) {
    holder.fills = [{ type: "SOLID", color: { r: 0.84, g: 0.86, b: 0.9 } }];
    return holder;
  }

  // Jemný presah odstráni 1–2 % technický/brandový okraj, ktorý býva
  // súčasťou exportovaného KV. Centrálne 50 % jadro ostáva bezpečné.
  const scale = Math.max(
    zone[2] / imageSize.width,
    zone[3] / imageSize.height
  ) * 1.06;
  const renderedW = imageSize.width * scale;
  const renderedH = imageSize.height * scale;
  const rect = figma.createRectangle();
  rect.name = "Master visual — 2000×2000 core";
  rect.resize(renderedW, renderedH);
  rect.fills = [{ type: "IMAGE", imageHash: figmaImage.hash, scaleMode: "FILL" }];
  rect.x = clamp(zone[2] * 0.5 - clamp(focal.x, 0.25, 0.75) * renderedW, zone[2] - renderedW, 0);
  rect.y = clamp(zone[3] * 0.5 - clamp(focal.y, 0.20, 0.75) * renderedH, zone[3] - renderedH, 0);
  holder.appendChild(rect);

  if (showGuide) {
    const guide = figma.createRectangle();
    guide.name = "GUIDE — master core 2000×2000";
    guide.resize(renderedW * 0.5, renderedH * 0.5);
    guide.x = rect.x + renderedW * 0.25;
    guide.y = rect.y + renderedH * 0.25;
    guide.fills = [{ type: "SOLID", color: { r: 0, g: 0.75, b: 0.2 }, opacity: 0.06 }];
    guide.strokes = [{ type: "SOLID", color: { r: 0.2, g: 1, b: 0.4 }, opacity: 0.82 }];
    guide.strokeWeight = 1;
    guide.dashPattern = [6, 4];
    guide.locked = true;
    holder.appendChild(guide);
  }
  return holder;
}

function addMasterCta(frame, value, x, y, w, h) {
  if (!value) return;
  const button = addSolidRect(frame, "CTA button", x, y, w, h, { r: 0, g: 0.278, b: 0.973 }, 1);
  button.cornerRadius = Math.max(2, Math.round(h * 0.08));
  const labelSize = Math.max(12, Math.round(h * 0.36));
  addTemplateText(frame, "CTA text", value + "  ›", [x, y, w, h],
    labelSize, { r: 1, g: 1, b: 1 }, "Bold", "CENTER", "CENTER");
}

// Vypočíta obdĺžnik, do ktorého smie master_safe layout klásť text/logo/AI tag.
// Obrázok (addMasterCoreImage) sa naň neviaže — kreslí sa vždy na celý frame.
function resolveContentBox(format) {
  const W = format.width, H = format.height;
  const normalized = format.safeBox;
  if (normalized) {
    const left = Math.max(0, Number(normalized.left) || 0);
    const right = Math.max(0, Number(normalized.right) || 0);
    const top = Math.max(0, Number(normalized.top) || 0);
    const bottom = Math.max(0, Number(normalized.bottom) || 0);
    // Pri brandingoch s centrálnou dead zónou je najväčší použiteľný
    // obdĺžnik jeden z bočných pásov.
    if (format.deadZones && format.deadZones.length) {
      const dead = format.deadZones[0];
      const leftW = Math.max(0, dead.x);
      const rightX = Math.min(W, dead.x + dead.w);
      const rightW = Math.max(0, W - rightX);
      return rightW > leftW
        ? { x: rightX, y: top, w: rightW, h: Math.max(0, H - top - bottom) }
        : { x: 0, y: top, w: leftW, h: Math.max(0, H - top - bottom) };
    }
    return { x: left, y: top, w: Math.max(0, W - left - right), h: Math.max(0, H - top - bottom) };
  }
  const sz = format.safeZones;
  if (!sz) return { x: 0, y: 0, w: W, h: H };

  // JOJ / Markíza branding: centerWidth + topOffset označuje DEAD zónu
  // (napr. vysielacia grafika), nie safe priestor — obsah patrí do bočného
  // pásu mimo nej.
  if (sz.centerWidth && sz.topOffset !== undefined) {
    const sideW = Math.round((W - sz.centerWidth) / 2);
    const leftW = sideW;
    const rightW = W - sz.centerWidth - sideW;
    return rightW > leftW
      ? { x: W - rightW, y: 0, w: rightW, h: H }
      : { x: 0, y: 0, w: leftW, h: H };
  }

  // Topky / ženské weby SIDE: centrovaná vnútorná safe zóna pevnej veľkosti.
  if (sz.safeInner) {
    const iw = sz.safeInner.width, ih = sz.safeInner.height;
    return {
      x: Math.round((W - iw) / 2),
      y: Math.round((H - ih) / 2),
      w: iw,
      h: ih
    };
  }

  // Všeobecné odsadenie od hrán (top/bottom/sides/left/right).
  const top = sz.top || 0;
  const bottom = sz.bottom || 0;
  const left = (sz.left || 0) + (sz.sides || 0);
  const right = (sz.right || 0) + (sz.sides || 0);
  if (top || bottom || left || right) {
    return { x: left, y: top, w: Math.max(0, W - left - right), h: Math.max(0, H - top - bottom) };
  }

  return { x: 0, y: 0, w: W, h: H };
}

function buildMasterSafeLayout(frame, format, layout, content, figmaImage, imageSize, figmaLogo, contentBox) {
  const cb = contentBox || resolveContentBox(format);
  const _ratio = format.width / format.height;
  const family = layout.master_family ||
    (_ratio > 1.45 ? "wide" : (_ratio < 0.75 ? "portrait" : "square"));
  const focal = {
    x: typeof layout.crop_anchor_x === "number" ? layout.crop_anchor_x : 0.5,
    y: typeof layout.crop_anchor_y === "number" ? layout.crop_anchor_y
       : (format.width / format.height >= 3 ? 0.28
         : (format.width / format.height >= 1.8 ? 0.36 : 0.5))
  };
  const pad = TB.padding(format.width, format.height);
  frame.fills = [{ type: "SOLID", color: brandColor(layout) }];

  if (family === "wide") {
    // Čistý split-layout podľa wide PSD referencie: obraz a samostatný tmavý
    // brand panel. Žiadny polopriesvitný overlay cez postavu ani zvislý tieň.
    const imageW = Math.round(format.width * 0.56);
    addMasterCoreImage(frame, figmaImage, imageSize, [0, 0, imageW, format.height], focal, content.showGuides);
    const panelX = imageW;
    const brand = { r: 0.105, g: 0.19, b: 0.30 };
    const textX = Math.max(cb.x + pad, panelX + pad);
    const textRight = cb.x + cb.w - pad;
    const textW = Math.max(60, textRight - textX);
    const panel = figma.createRectangle();
    panel.name = "Wide content panel";
    panel.resize(format.width - panelX, format.height);
    panel.x = panelX;
    panel.y = 0;
    panel.fills = [{ type: "SOLID", color: brand }];
    frame.appendChild(panel);
    const headlineSize = TB.headline(format.width, format.height);
    const wLogo = TB.logoBox(format.width, format.height);
    const wClear = TB.logoClear(format.width, format.height);
    const showsLogo = shouldShowLogo(format, layout, figmaLogo);
    const logoTop = showsLogo ? (cb.y + cb.h - pad - wLogo.height) : (cb.y + cb.h);
    const reserve = showsLogo ? (wLogo.width + wClear) : 0;
    function wideWidth(y, h) {
      return (y + h > logoTop) ? Math.max(60, textW - reserve) : textW;
    }
    // Rezerva sa má zapnúť podľa SKUTOČNEJ výšky textu, nie výšky boxu —
    // preto najprv skúsime plnú šírku a až keď reálne kolíduje s logom
    // (podľa odmeranej node.height), prekreslíme užšie.
    function placeReserveWide(name, value, y, boxH, fontSize, color, style) {
      let node = addTemplateText(frame, name, value, [textX, y, textW, boxH], fontSize, color, style, "LEFT");
      if (node && reserve && (y + node.height) > logoTop) {
        node.remove();
        node = addTemplateText(frame, name, value,
          [textX, y, Math.max(60, textW - reserve), boxH], fontSize, color, style, "LEFT");
      }
      return node;
    }

    const wBtn = TB.button(format.width, format.height);
    const showCta = layout.show_cta !== false;
    const wGap = Math.max(10, Math.round(headlineSize * 0.28));
    const textGap = Math.max(8, Math.round(headlineSize * 0.18));
    const aiRezerva = (content.aiGenerated && layout.show_ai_disclosure !== false)
      ? Math.round(aiNoteFontSize(format) * 2.2) : 0;

    // Full creative s CTA končí nad AI disclosure; Meta bez CTA je opticky
    // centrovaná v paneli a nespadne úplne k spodnému okraju.
    let wCur = showCta
      ? Math.min(cb.y + cb.h - pad - aiRezerva, cb.y + cb.h * 0.82)
      : (cb.y + cb.h * 0.60);
    let btnY = 0, subY = 0;
    if (showCta) { btnY = wCur - wBtn.height; wCur = btnY - wGap; }
    // Poistka na veľkosť (P0-9): subheadline sa nekreslí, ak po odpočítaní
    // CTA a AI tagu ostane menej ako 1,6× jeho výšky, alebo je formát
    // pod min(W,H) 400 px.
    const showSub = shouldShowSubheadline(format, layout, wCur - (cb.y + pad));
    const subWidth = wideWidth(wCur - TB.subheadline(format.width, format.height) * 1.2,
      TB.subheadline(format.width, format.height) * 1.2);
    const subH = showSub ? measureTemplateTextHeight(
      frame, content.subheadline, subWidth, TB.subheadline(format.width, format.height), "Regular"
    ) : 0;
    if (showSub) { subY = wCur - subH; wCur = subY - textGap; }
    const headlineWidth = wideWidth(wCur - headlineSize * 1.1, headlineSize * 1.1);
    const hlH = measureTemplateTextHeight(frame, content.headline, headlineWidth, headlineSize, "Bold");
    const hlY = wCur - hlH;

    addTemplateText(frame, "Headline", content.headline,
      [textX, hlY, headlineWidth, Math.max(hlH, headlineSize)], headlineSize,
      { r: 1, g: 1, b: 1 }, "Bold", "LEFT");

    if (showSub) {
      addTemplateText(frame, "Subheadline", content.subheadline,
        [textX, subY, subWidth, Math.max(subH, TB.subheadline(format.width, format.height))],
        TB.subheadline(format.width, format.height), { r: 1, g: 1, b: 1 }, "Regular");
    }
    if (showCta) {
      addMasterCta(frame, content.ctaText, textX, btnY,
        Math.max(88, Math.min(wBtn.width, wideWidth(btnY, wBtn.height))), wBtn.height);
    }
    if (showsLogo) {
      placeLogo(frame, figmaLogo,
        cb.x + cb.w - pad - wLogo.width, cb.y + cb.h - pad - wLogo.height,
        wLogo.width, wLogo.height);
    }
  } else {
    addMasterCoreImage(frame, figmaImage, imageSize, [0, 0, format.width, format.height], focal, content.showGuides);

    const headlineSize = TB.headline(format.width, format.height);
    const subheadlineSize = TB.subheadline(format.width, format.height);
    const gap = Math.max(10, Math.round(headlineSize * 0.28));
    const textGap = Math.max(8, Math.round(headlineSize * 0.18));
    const textW = cb.w - pad * 2;
    const btn = TB.button(format.width, format.height);
    const logo = TB.logoBox(format.width, format.height);
    const logoClear = TB.logoClear(format.width, format.height);
    const showsLogo = shouldShowLogo(format, layout, figmaLogo);
    const logoOwnRow = showsLogo && (logo.width + logoClear) > textW * 0.5;
    const logoTop = (showsLogo && !logoOwnRow) ? (cb.y + cb.h - pad - logo.height) : (cb.y + cb.h);
    const logoReserve = (showsLogo && !logoOwnRow) ? (logo.width + logoClear) : 0;
    // Rezerva podľa SKUTOČNEJ výšky textu (node.height), nie výšky boxu —
    // box headline/subheadline je percento formátu, reálny text v ňom
    // môže byť podstatne nižší, a rezerva sa vtedy zapínala zbytočne.
    function placeReserveText(name, value, x, y, boxH, fontSize, color, style, align) {
      let node = addTemplateText(frame, name, value, [x, y, textW, boxH], fontSize, color, style, align);
      if (node && logoReserve && (y + node.height) > logoTop) {
        node.remove();
        node = addTemplateText(frame, name, value,
          [x, y, Math.max(60, textW - logoReserve), boxH], fontSize, color, style, align);
      }
      return node;
    }
    const btnW = Math.max(60, Math.min(btn.width,
      textW - ((logo.width + logoClear > textW * 0.5) ? 0 : logo.width + logoClear)));

    // Skladanie zdola nahor: pad → tlačidlo → medzera → podnadpis → medzera → headline,
    // aby sa pri väčšom podnadpise nikdy neprekryl s tlačidlom.
    let cursorY = cb.y + cb.h - pad;
    if (content.aiGenerated && layout.show_ai_disclosure !== false) {
      cursorY -= Math.round(aiNoteFontSize(format) * 2.2);
    }
    if (logoOwnRow) cursorY -= (logo.height + logoClear);
    // Meta nemá kreslené CTA. Text preto patrí nad logo, nie do rovnakého
    // spodného riadku medzi logom a AI disclosure.
    if (layout.show_cta === false && showsLogo && !logoOwnRow) {
      cursorY = Math.min(cursorY, logoTop - Math.max(12, Math.round(headlineSize * 0.35)));
    }
    let btnY = 0, subheadlineY = 0;
    if (layout.show_cta !== false) {
      cursorY -= btn.height;
      btnY = cursorY;
      cursorY -= gap;
    }
    // Poistka na veľkosť (P0-9): subheadline sa nekreslí, ak po odpočítaní
    // CTA, loga a AI tagu ostane menej ako 1,6× jeho výšky, alebo je
    // formát pod min(W,H) 400 px. Rovnaký boolean sa použije aj nižšie
    // pri samotnom kreslení, nech sa rezerva miesta a kreslenie nerozídu.
    const showSubheadline = shouldShowSubheadline(format, layout, cursorY - (cb.y + pad));
    const subWidth = (logoReserve && cursorY > logoTop) ? Math.max(60, textW - logoReserve) : textW;
    const subheadlineBoxH = showSubheadline
      ? measureTemplateTextHeight(frame, content.subheadline, subWidth, subheadlineSize, "Regular") : 0;
    if (showSubheadline) {
      cursorY -= subheadlineBoxH;
      subheadlineY = cursorY;
      cursorY -= textGap;
    }
    const headlineWidth = (logoReserve && cursorY > logoTop) ? Math.max(60, textW - logoReserve) : textW;
    const headlineBoxH = measureTemplateTextHeight(frame, content.headline, headlineWidth, headlineSize, "Bold");
    cursorY -= headlineBoxH;
    const headlineY = cursorY;

    const scrimH = Math.min(format.height, Math.max(
      Math.round(format.height * (family === "portrait" ? 0.46 : 0.50)),
      format.height - headlineY
    ));
    const scrimAlpha = scrimAlphaFor(layout);
    const scrimScale = scrimAlpha / 0.90;
    const scrim = figma.createRectangle();
    scrim.name = "Bottom readability gradient";
    scrim.resize(format.width, scrimH);
    scrim.x = 0;
    scrim.y = format.height - scrimH;
    scrim.fills = [{
      type: "GRADIENT_LINEAR",
      gradientTransform: [[0, 1, 0], [1, 0, 0]],
      gradientStops: [
        { position: 0.00, color: { r: 0.40, g: 0.40, b: 0.40, a: 0.00 } },
        { position: 0.15, color: { r: 0.34, g: 0.34, b: 0.34, a: Math.round(0.08 * scrimScale * 100) / 100 } },
        { position: 0.35, color: { r: 0.26, g: 0.26, b: 0.26, a: Math.round(0.28 * scrimScale * 100) / 100 } },
        { position: 0.55, color: { r: 0.17, g: 0.17, b: 0.17, a: Math.round(0.50 * scrimScale * 100) / 100 } },
        { position: 0.78, color: { r: 0.08, g: 0.08, b: 0.08, a: Math.round(0.72 * scrimScale * 100) / 100 } },
        { position: 1.00, color: { r: 0.00, g: 0.00, b: 0.00, a: scrimAlpha } }
      ]
    }];
    frame.appendChild(scrim);

    const textAlign = "LEFT";
    addTemplateText(
      frame, "Headline", content.headline,
      [cb.x + pad, headlineY, headlineWidth, Math.max(headlineBoxH, headlineSize)],
      headlineSize, { r: 1, g: 1, b: 1 }, "Bold", textAlign
    );
    if (showSubheadline) {
      addTemplateText(
        frame, "Subheadline", content.subheadline,
        [cb.x + pad, subheadlineY, subWidth, Math.max(subheadlineBoxH, subheadlineSize)],
        subheadlineSize, { r: 1, g: 1, b: 1 }, "Regular", textAlign
      );
    }
    if (layout.show_cta !== false) {
      addMasterCta(frame, content.ctaText, cb.x + pad, btnY, btnW, btn.height);
    }
    if (shouldShowLogo(format, layout, figmaLogo)) {
      const logoX = logoOwnRow
        ? Math.round(cb.x + (cb.w - logo.width) / 2)
        : (cb.x + cb.w - pad - logo.width);
      placeLogo(frame, figmaLogo, logoX, cb.y + cb.h - pad - logo.height, logo.width, logo.height);
    }
  }

  if (layout.show_badge !== false && content.badgeText) {
    const badgeW = Math.round(clamp(Math.min(format.width, cb.w) * 0.34, 110, Math.min(260, cb.w - pad * 2)));
    const badgeH = Math.round(TB.headline(format.width, format.height) * 1.1);
    addSolidRect(frame, "Badge background", cb.x + pad, cb.y + pad, badgeW, badgeH, { r: 1, g: 1, b: 1 }, 0.94);
    addTemplateText(
      frame, "Badge", content.badgeText,
      [cb.x + pad + 8, cb.y + pad + Math.round(badgeH * 0.20), badgeW - 16, Math.round(badgeH * 0.60)],
      Math.max(12, Math.round(badgeH * 0.42)), BRAND_COLOR, "Bold", "CENTER"
    );
  }
  if (layout.show_legal !== false && content.legalText) {
    const legalH = Math.round(TB.legal(format.width, format.height) * 1.6);
    addTemplateText(
      frame, "Legal text", content.legalText,
      [cb.x + pad, cb.y + cb.h - legalH - Math.max(4, Math.round(pad * 0.25)), cb.w - pad * 2, legalH],
      TB.legal(format.width, format.height),
      { r: 1, g: 1, b: 1 }, "Regular", "LEFT"
    );
  }
  if (content.aiGenerated && layout.show_ai_disclosure !== false) addAiNote(frame, format, cb);
}

function buildAdformPsdLayout(frame, format, layout, content, figmaImage, imageSize, figmaLogo, templateId) {
  const activeTemplate = templateId || adformTemplateId(format) || format.id;
  const baseRules = ADFORM_PSD_RULES[activeTemplate];
  if (!baseRules) {
    buildFullBleedLayout(frame, format, layout, content.headline, figmaImage, figmaLogo);
    return;
  }

  // PSD súradnice sú navrhnuté pre dlhý 3–5 riadkový headline, badge a legal.
  // Krátke kampanové copy bez týchto prvkov potrebuje kompaktný variant;
  // inak zostáva polovica frame-u prázdna a text koliduje s napáleným KV.
  const compactCopy = String(content.headline || "").trim().length <= 22 &&
    !content.badgeText && !content.legalText;
  const rules = Object.assign({}, baseRules);
  if (compactCopy) {
    const compact = {
      adform_300x250: {
        headline: [20, 54, 150, 48], headlineSize: 20,
        cta: [20, 164, 110, 38], bankLogo: [224, 174, 55, 54]
      },
      adform_300x600: {
        headline: [20, 392, 230, 58], headlineSize: 25,
        cta: [20, 482, 124, 42], bankLogo: [216, 504, 64, 62]
      },
      adform_160x600: {
        headline: [12, 316, 136, 54], headlineSize: 22,
        cta: [15, 382, 130, 42], bankLogo: [43, 450, 74, 73],
        ai: [30, 548, 100, 19]
      },
      adform_970x250: {
        headline: [460, 52, 330, 72], headlineSize: 36,
        cta: [460, 148, 125, 42]
      }
    }[activeTemplate];
    if (compact) Object.assign(rules, compact);
  }

  frame.fills = [{ type: "SOLID", color: brandColor(layout) }];
  const focal = {
    x: typeof layout.crop_anchor_x === "number" ? layout.crop_anchor_x : 0.5,
    y: typeof layout.crop_anchor_y === "number" ? layout.crop_anchor_y : 0.5
  };
  if (activeTemplate === "adform_970x250") {
    addFocalImageFrame(frame, figmaImage, imageSize, "Key visual crop — left zone", [0, 0, 425, 250], focal, { x: 0.66, y: 0.52 });
  } else if (activeTemplate === "adform_160x600") {
    addFocalImageFrame(frame, figmaImage, imageSize, "Key visual crop — top zone", [0, 0, 160, 330], focal, { x: compactCopy ? 0.68 : 0.62, y: 0.48 });
  } else if (activeTemplate === "adform_300x250") {
    addFocalImageFrame(frame, figmaImage, imageSize, "Key visual crop — full frame", [0, 0, 300, 250], focal, { x: compactCopy ? 0.86 : 0.76, y: 0.52 });
  } else {
    addFocalImageFrame(frame, figmaImage, imageSize, "Key visual crop — full frame", [0, 0, format.width, format.height], focal, { x: compactCopy ? 0.72 : 0.68, y: 0.40 });
  }

  addAdformBackgroundTreatment(frame, format, rules, activeTemplate);
  addSloganLogo(frame, rules.slogan);

  // Nahraný lockup patrí do veľkého štvorcového brand prvku, nie do horného sloganu.
  if (shouldShowLogo(format, layout, figmaLogo) && rules.bankLogo) {
    placeLogo(
      frame, figmaLogo,
      rules.bankLogo[0], rules.bankLogo[1], rules.bankLogo[2], rules.bankLogo[3]
    );
  }

  if (content.badgeText && rules.badge) {
    const b = rules.badge;
    const badgeBack = addSolidRect(
      frame, "Badge outline", b[0] - 4, b[1] - 4, b[2] + 8, b[3] + 8,
      { r: 0.78, g: 0.75, b: 0.75 }, 0.42
    );
    badgeBack.cornerRadius = Math.round(Math.min(b[2], b[3]) * 0.20);
    const badge = addSolidRect(frame, "Badge / prelepka", b[0], b[1], b[2], b[3], { r: 0.86, g: 0.36, b: 0.29 }, 1);
    badge.cornerRadius = Math.round(Math.min(b[2], b[3]) * 0.18);
    const badgePad = Math.max(5, Math.round(Math.min(b[2], b[3]) * 0.12));
    addTemplateText(
      frame,
      "Badge text",
      content.badgeText,
      [b[0] + badgePad, b[1] + badgePad, b[2] - badgePad * 2, b[3] - badgePad * 2],
      Math.round(clamp(Math.min(b[2], b[3]) * 0.18, 8, 18)),
      { r: 1, g: 1, b: 1 },
      "Bold",
      "CENTER"
    );
  }

  if (shouldShowHeadline(layout, content.headline) && rules.headline) {
    const h = rules.headline;
    const headlineSize = rules.headlineSize || Math.round(clamp(h[3] * 0.30, 12, 36));
    const headlineNode = addTemplateText(
      frame, "Headline", content.headline, h, headlineSize,
      { r: 1, g: 1, b: 1 }, "Bold", "LEFT"
    );
    if (headlineNode && content.subheadline) {
      const subY = Math.min(h[1] + h[3] - 14, headlineNode.y + headlineNode.height + 4);
      addTemplateText(
        frame,
        "Subheadline",
        content.subheadline,
        [h[0], subY, h[2], Math.max(12, h[1] + h[3] - subY)],
        Math.round(clamp(headlineSize * 0.52, 8, 16)),
        { r: 1, g: 1, b: 1 },
        "Regular",
        "LEFT"
      );
    }
  }

  if (content.legalText && rules.legal) {
    addTemplateText(
      frame, "Legal text", content.legalText, rules.legal,
      rules.legalSize || Math.round(clamp(rules.legal[3] * 0.34, 6, 10)),
      { r: 1, g: 1, b: 1 }, "Regular", "LEFT"
    );
  }

  if (content.ctaText && rules.cta) {
    const c = rules.cta;
    const button = addSolidRect(frame, "CTA button", c[0], c[1], c[2], c[3], { r: 0, g: 0.278, b: 0.973 }, 1);
    button.cornerRadius = Math.round(c[3] * 0.08);
    const ctaText = content.ctaText || STYLE.ctaText;
    addTemplateText(
      frame, "CTA text", ctaText + "  ›", [c[0] + 8, c[1], c[2] - 16, c[3]],
      Math.round(clamp(c[3] * 0.28, 9, 15)),
      { r: 1, g: 1, b: 1 }, "Bold", "CENTER", "CENTER"
    );
  }

  if (content.aiGenerated && rules.ai) {
    addTemplateText(
      frame, "AI generované", "✧  " + STYLE.aiTagText, rules.ai,
      Math.round(clamp(rules.ai[3] * 0.47, 7, 10)),
      { r: 1, g: 1, b: 1 }, "Regular", "LEFT"
    );
  }
}

// Full bleed podľa Surďovej predlohy: KV na celý frame + jemný tmavý gradient
// dole + headline biely vľavo dole (Tatra banka Sans) + logo VPRAVO DOLE.
function buildFullBleedLayout(frame, format, layout, headline, figmaImage, figmaLogo) {
  // FILL = plný záber (Surďov look pre surovú fotku). CONTAIN len keď to výslovne
  // rozhodne engine. Pozn.: pri HOTOVEJ kompozícii (napálené číslo) žiadny režim
  // nevyzerá dobre — správny vstup je SUROVÁ fotka.
  // Viditeľná plocha vizuálu. Pri CONTAIN nakreslíme obrázok PRESNE na jeho
  // fitovaný obdĺžnik (nie celo-rámovo s FIT), takže brand pás ostane čistý a
  // všetok text/logo/AI sadne NA obrázok — nie do pásu (žiadna „čierna čiara").
  let cTop = 0, cBottom = format.height, cLeft = 0, cRight = format.width;
  if (figmaImage && layout.image_fit === "contain") {
    const iw = CUR_IMG_W || format.width, ih = CUR_IMG_H || format.height;
    const s = Math.min(format.width / iw, format.height / ih);
    const dw = Math.round(iw * s), dh = Math.round(ih * s);
    const dx = Math.round((format.width - dw) / 2), dy = Math.round((format.height - dh) / 2);
    frame.fills = [{ type: "SOLID", color: brandColor(layout) }];
    addImageRect(frame, figmaImage, "KV (contain)", dx, dy, dw, dh, "FILL");
    cTop = dy; cBottom = dy + dh; cLeft = dx; cRight = dx + dw;
  } else {
    frame.fills = figmaImage
      ? [{ type: "IMAGE", imageHash: figmaImage.hash, scaleMode: "FILL" }]
      : [{ type: "SOLID", color: brandColor(layout) }];
  }

  const pad = Math.round(clamp(Math.min(format.width, format.height) * STYLE.paddingPct, 10, 60));
  const cW = cRight - cLeft, cH = cBottom - cTop;

  // Jemný tmavý gradient dole — ukotvený na spodok VIZUÁLU (pri contain končí na
  // spodku obrázka, nie frame-u), aby čitateľnosť textu bola presne tam.
  const gradH = Math.round(cH * STYLE.scrimHeightPct);
  const gradRect = figma.createRectangle();
  gradRect.name = "Gradient scrim";
  gradRect.resize(cW, gradH);
  gradRect.x = cLeft;
  gradRect.y = cBottom - gradH;
  gradRect.fills = [{
    type: "GRADIENT_LINEAR",
    gradientTransform: [[0, 1, 0], [1, 0, 0]],
    gradientStops: [
      { position: 0, color: { r: 0, g: 0, b: 0, a: 0 } },
      { position: 1, color: { r: 0, g: 0, b: 0, a: STYLE.scrimOpacity } }
    ]
  }];
  frame.appendChild(gradRect);

  // Logo VPRAVO DOLE (Surď) — na spodku vizuálu (nie frame-u)
  let logoRight = 0;
  if (shouldShowLogo(format, layout, figmaLogo)) {
    const logoW = Math.max(STYLE.minLogoPx, Math.round(format.width * STYLE.logoWidthPct));
    const logoH = Math.round(logoW * 0.95); // TB square lockup ~1:0.95
    const lx = cRight - logoW - pad;
    const ly = cBottom - logoH - pad;
    placeLogo(frame, figmaLogo, lx, ly, logoW, logoH);
    logoRight = logoW + pad; // koľko miesta vpravo zabrať headlinu
  }

  if (!shouldShowHeadline(layout, headline)) return;

  const textW = Math.max(40, cW - pad * 2 - (logoRight ? logoRight * 0.8 : 0));
  let bottomY = cBottom - pad; // spodná kotva textového bloku = spodok vizuálu
  // vyhraď miesto pre „AI generované" (vľavo dole), nech ho text neprekryje —
  // zladené s aiNoteFontSize() a jeho odsadením (pad), aby nič nekolidovalo.
  if (AI_ON) bottomY -= aiNoteFontSize(format) + pad + Math.round(pad * 0.4);

  // Podnadpis (ak je) — menší, úplne dole; headline pôjde nad neho.
  // Zobrazí sa LEN na formátoch, kde je naň priestor (per-formát rozhodnutie).
  if (SUBHEAD && shouldShowSubheadline(format, layout)) {
    const subSize = Math.max(STYLE.minTextPx, Math.round(format.height * STYLE.headlinePct * 0.5));
    const sub = figma.createText();
    sub.fontName = FONT;
    sub.characters = SUBHEAD;
    sub.fontSize = subSize;
    sub.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
    sub.resize(textW, Math.round(format.height * 0.25));
    sub.textAutoResize = "HEIGHT";
    frame.appendChild(sub);
    sub.x = cLeft + pad;
    sub.y = bottomY - sub.height;
    bottomY = sub.y - Math.round(pad * 0.3);
  }

  // Headline biely vľavo dole — nechá miesto logu vpravo.
  // AUTO-FIT (Surď: „pri dlhom headline zmenším font"): začne na 6,6 % výšky
  // a zmenšuje font po 1 px, kým sa zalomený text nezmestí do vyhradenej výšky
  // (max ~32 % frame, čo ostane nad logom/AI tagom). Nikdy nepôjde pod 12 px.
  let fontSize = Math.max(STYLE.minTextPx, Math.round(format.height * STYLE.headlinePct));
  const maxHeadlineH = Math.max(fontSize, Math.round((bottomY - (cTop + cH * 0.5))));
  const txt = figma.createText();
  txt.fontName = FONT;
  txt.characters = headline || "HEADLINE";
  txt.fontSize = fontSize;
  txt.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  try { txt.letterSpacing = { value: -2, unit: "PERCENT" }; } catch (e) {}
  txt.resize(textW, Math.round(format.height * 0.4));
  txt.textAutoResize = "HEIGHT";
  frame.appendChild(txt);
  // zmenšuj, kým zalomený headline presahuje vyhradenú výšku
  let guard = 200;
  while (txt.height > maxHeadlineH && fontSize > STYLE.minTextPx && guard-- > 0) {
    fontSize = Math.max(STYLE.minTextPx, fontSize - 1);
    txt.fontSize = fontSize;
  }
  txt.x = cLeft + pad;
  txt.y = bottomY - txt.height;
  frame.appendChild(txt);
}

// Fotka 40% vľavo, brand farba 60% vpravo, headline na pravej strane
function buildSplitLayout(frame, format, layout, headline, figmaImage, figmaLogo) {
  frame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];

  const photoW = Math.round(format.width * 0.40);

  const photoRect = figma.createRectangle();
  photoRect.name = "Foto";
  photoRect.resize(photoW, format.height);
  photoRect.x = 0;
  photoRect.y = 0;
  photoRect.fills = figmaImage
    ? [{ type: "IMAGE", imageHash: figmaImage.hash, scaleMode: layout.image_fit === "contain" ? "FIT" : "FILL" }]
    : [{ type: "SOLID", color: { r: 0.85, g: 0.85, b: 0.85 } }];
  frame.appendChild(photoRect);

  const brandRect = figma.createRectangle();
  brandRect.name = "Brand";
  brandRect.resize(format.width - photoW, format.height);
  brandRect.x = photoW;
  brandRect.y = 0;
  brandRect.fills = [{ type: "SOLID", color: BRAND_COLOR }];
  frame.appendChild(brandRect);

  const brandW = format.width - photoW;
  const brandPad = Math.round(brandW * 0.08);

  // Logo hore v brand sekcii
  const logoH = Math.min(Math.round(format.height * 0.10), 52);
  const logoW = Math.min(Math.round(logoH * 3.5), brandW - brandPad * 2);
  const logoTopY = Math.round(format.height * 0.07);
  if (shouldShowLogo(format, layout, figmaLogo)) {
    placeLogo(frame, figmaLogo, photoW + brandPad, logoTopY, logoW, logoH);
  }

  if (!shouldShowHeadline(layout, headline)) return;

  // Headline pod logom — s garantovaným oddelením
  const afterLogo = logoTopY + logoH + Math.round(format.height * 0.05);
  const availTextH = format.height - afterLogo - Math.round(format.height * 0.05);
  const fontSize = Math.max(8, Math.min(layout.headline_size_px || 24, Math.floor(availTextH * 0.45)));
  const txt = figma.createText();
  txt.fontName = FONT;
  txt.characters = headline || "HEADLINE";
  txt.fontSize = fontSize;
  txt.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  txt.resize(brandW - brandPad * 2, availTextH);
  txt.textAutoResize = "HEIGHT";
  txt.x = photoW + brandPad;
  txt.y = afterLogo;
  frame.appendChild(txt);
}

// Logo zóna hore, foto v strede, text zóna dole
function buildStackedLayout(frame, format, layout, headline, figmaImage, figmaLogo) {
  frame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];

  const logoH = Math.round(format.height * 0.18);
  const textH = Math.round(format.height * 0.22);
  const photoH = format.height - logoH - textH;

  const logoZone = figma.createRectangle();
  logoZone.name = "Logo z\u00f3na";
  logoZone.resize(format.width, logoH);
  logoZone.x = 0;
  logoZone.y = 0;
  logoZone.fills = [{ type: "SOLID", color: BRAND_COLOR }];
  frame.appendChild(logoZone);

  // Logo vycentrované v logo zóne (len ak formát logo povoluje)
  if (shouldShowLogo(format, layout, figmaLogo)) {
    const lW = Math.round(Math.min(format.width * 0.55, logoH * 4));
    const lH = Math.round(logoH * 0.6);
    placeLogo(frame, figmaLogo, Math.round((format.width - lW) / 2), Math.round((logoH - lH) / 2), lW, lH);
  }

  const photoRect = figma.createRectangle();
  photoRect.name = "Foto";
  photoRect.resize(format.width, photoH);
  photoRect.x = 0;
  photoRect.y = logoH;
  photoRect.fills = figmaImage
    ? [{ type: "IMAGE", imageHash: figmaImage.hash, scaleMode: layout.image_fit === "contain" ? "FIT" : "FILL" }]
    : [{ type: "SOLID", color: { r: 0.85, g: 0.85, b: 0.85 } }];
  frame.appendChild(photoRect);

  const textRect = figma.createRectangle();
  textRect.name = "Text z\u00f3na";
  textRect.resize(format.width, textH);
  textRect.x = 0;
  textRect.y = logoH + photoH;
  textRect.fills = [{ type: "SOLID", color: BRAND_COLOR }];
  frame.appendChild(textRect);

  if (!shouldShowHeadline(layout, headline)) return;

  const fontSize = Math.max(8, Math.min(layout.headline_size_px || 14, Math.floor(format.width * 0.08)));
  const pad = Math.round(format.width * 0.06);
  const txt = figma.createText();
  txt.fontName = FONT;
  txt.characters = headline || "HEADLINE";
  txt.fontSize = fontSize;
  txt.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  txt.resize(format.width - pad * 2, textH);
  txt.textAutoResize = "HEIGHT";
  txt.x = pad;
  txt.y = logoH + photoH + Math.round((textH - fontSize * 1.4) / 2);
  frame.appendChild(txt);
}

// Žiadna fotka — logo + text. Google logo formáty majú transparentné pozadie.
// Mikro bannery (h ≤ 120, napr. 728×90, 320×50) — na logo_only sú príliš
// malé na to, aby v nich chýbal KV úplne. KV na celý frame + ľavý tmavý
// scrim na čitateľnosť, logo vľavo, jednoriadkový headline vpravo od loga.
// Bez CTA, subheadlinu aj prelepky — na to tu nie je miesto.
function buildMicroLayout(frame, format, layout, headline, figmaImage, figmaLogo) {
  frame.fills = [{ type: "SOLID", color: BRAND_COLOR }];

  const imgW = CUR_IMG_W || format.width, imgH = CUR_IMG_H || format.height;
  addFocalImageFrame(
    frame, figmaImage, { width: imgW, height: imgH }, "Key visual",
    [0, 0, format.width, format.height], { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.35 }
  );

  const scrim = figma.createRectangle();
  scrim.name = "Left readability scrim";
  scrim.resize(Math.round(format.width * 0.55), format.height);
  scrim.x = 0;
  scrim.y = 0;
  scrim.fills = [{
    type: "GRADIENT_LINEAR",
    gradientTransform: [[1, 0, 0], [0, 1, 0]],
    gradientStops: [
      { position: 0, color: { r: 0, g: 0, b: 0, a: 0.75 } },
      { position: 1, color: { r: 0, g: 0, b: 0, a: 0 } }
    ]
  }];
  frame.appendChild(scrim);

  const pad = Math.max(6, Math.round(format.height * 0.12));
  const hasLogo = shouldShowLogo(format, layout, figmaLogo);
  let contentX = pad;
  if (hasLogo) {
    const logoH = Math.min(format.height - pad * 2, Math.round(format.height * 0.6));
    const logoW = Math.max(50, Math.round(logoH * (255 / 243)));
    placeLogo(frame, figmaLogo, pad, Math.round((format.height - logoH) / 2), logoW, logoH);
    contentX = pad + logoW + Math.round(pad * 0.8);
  }

  if (shouldShowHeadline(layout, headline)) {
    const availW = Math.max(40, format.width - contentX - pad);
    let fontSize = Math.max(11, Math.min(Math.round(format.height * 0.32), 22));
    try {
      const meas = figma.createText();
      meas.fontName = FONT;
      meas.characters = headline;
      meas.fontSize = fontSize;
      meas.textAutoResize = "WIDTH_AND_HEIGHT";
      frame.appendChild(meas);
      if (meas.width > availW && meas.width > 0) {
        fontSize = Math.max(9, Math.floor(fontSize * (availW / meas.width)));
      }
      meas.remove();
    } catch (e) {}

    const txt = figma.createText();
    txt.name = "Headline";
    txt.fontName = FONT;
    txt.characters = headline;
    txt.fontSize = fontSize;
    txt.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
    txt.textAutoResize = "NONE";
    txt.x = contentX;
    txt.y = 0;
    txt.resize(availW, format.height);
    txt.textAlignHorizontal = "LEFT";
    txt.textAlignVertical = "CENTER";
    try { txt.maxLines = 1; txt.textTruncation = "ENDING"; } catch (e) {}
    frame.appendChild(txt);
  }
}

function buildLogoOnlyLayout(frame, format, layout, headline, figmaLogo) {
  // Logo-only je exportný PNG asset. Excel vytvára unikátne xls_* ID, preto
  // kontrola dvoch presných katalógových ID nechávala nesprávne modré pozadie.
  const isGoogleLogo = format.role === "logo_only" ||
    (format.rules && format.rules.logoOnly) ||
    /google_logo|logo-only|logo_only/.test(String(format.id || ""));
  frame.fills = [];
  const hasLogo = !!figmaLogo;

  // Logo vycentrované
  const lH = Math.min(Math.round(format.height * 0.25), Math.round(format.width * 0.18), 80);
  const lW = Math.round(lH * 3.5);
  const lPad = Math.round(format.height * 0.15);
  placeLogo(frame, figmaLogo, Math.round((format.width - lW) / 2), lPad, lW, lH);
  const fallbackHeadline = !hasLogo && !!headline;

  if (shouldShowHeadline(layout, headline) || fallbackHeadline) {
    const fontSize = Math.max(12, Math.min(Math.floor(format.height * 0.22), Math.floor(format.width * 0.06)));
    const txt = figma.createText();
    txt.fontName = FONT;
    txt.characters = headline;
    txt.fontSize = fontSize;
    // Pre Google logo formáty (transparentné pozadie) — tmavý text; inak biely
    txt.fills = [{ type: "SOLID", color: isGoogleLogo ? BRAND_COLOR : { r: 1, g: 1, b: 1 } }];
    txt.textAutoResize = "NONE";
    txt.x = 12;
    if (hasLogo) {
      // pôvodné umiestnenie pod logom
      txt.y = lPad + lH + Math.round(format.height * 0.06);
      txt.resize(format.width - 24, format.height - txt.y);
    } else {
      txt.y = 0;
      txt.resize(format.width - 24, format.height);
    }
    txt.textAlignHorizontal = "CENTER";
    txt.textAlignVertical = "CENTER";
    frame.appendChild(txt);
  }

  if (!hasLogo && !headline) {
    const warn = figma.createText();
    warn.fontName = FONT;
    warn.characters = "CHÝBA LOGO — tento formát je bez neho prázdny";
    warn.fontSize = Math.max(10, Math.min(Math.floor(format.height * 0.08), Math.floor(format.width * 0.035)));
    warn.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
    warn.textAutoResize = "NONE";
    warn.resize(format.width - 24, format.height);
    warn.x = 12;
    warn.y = 0;
    warn.textAlignHorizontal = "CENTER";
    warn.textAlignVertical = "CENTER";
    frame.appendChild(warn);
  }
}

// Blurované pozadie (FILL) + ostrý centrovaný objekt (FIT) + text zóna dole
// Pre portrait formáty (9:16, 2:3, 1:2) kde vizuál je pripravený s objektom v strede
function buildBlurredBgLayout(frame, format, layout, headline, figmaImage, figmaLogo) {
  frame.fills = [{ type: "SOLID", color: { r: 0.05, g: 0.05, b: 0.1 } }];

  const overlayH = layout.text_area_height_px || Math.round(format.height * 0.22);

  if (figmaImage) {
    // Layer 1: Blurovaná fotka roztiahnutá na celý frame (FILL)
    const bgRect = figma.createRectangle();
    bgRect.name = "Blur pozadie";
    bgRect.resize(format.width, format.height);
    bgRect.x = 0;
    bgRect.y = 0;
    bgRect.fills = [{ type: "IMAGE", imageHash: figmaImage.hash, scaleMode: "FILL" }];
    bgRect.effects = [{ type: "LAYER_BLUR", radius: 40, visible: true }];
    frame.appendChild(bgRect);

    // Layer 2: Tmavý overlay pre kontrast
    const dimOverlay = figma.createRectangle();
    dimOverlay.name = "Dim overlay";
    dimOverlay.resize(format.width, format.height);
    dimOverlay.x = 0;
    dimOverlay.y = 0;
    dimOverlay.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity: 0.20 }];
    frame.appendChild(dimOverlay);

    // Layer 3: Ostrá fotka (FIT) — objekt viditeľný celý, centrovaný v hornej časti
    // FIT = celá fotka sa zmestí, priesvitné okraje ukážu blurované pozadie
    const topPad = Math.round(format.height * 0.05);
    const availH = format.height - overlayH - topPad;
    const fgRect = figma.createRectangle();
    fgRect.name = "Foto (ostr\u00e1, FIT)";
    fgRect.resize(format.width, availH);
    fgRect.x = 0;
    fgRect.y = topPad;
    fgRect.fills = [{ type: "IMAGE", imageHash: figmaImage.hash, scaleMode: "FIT" }];
    frame.appendChild(fgRect);
  }

  // Text zóna dole — brand farba
  const textBg = figma.createRectangle();
  textBg.name = "Text z\u00f3na";
  textBg.resize(format.width, overlayH);
  textBg.x = 0;
  textBg.y = format.height - overlayH;
  textBg.fills = [{ type: "SOLID", color: BRAND_COLOR, opacity: 0.88 }];
  frame.appendChild(textBg);

  // Logo: Pinterest = hore nad fotkou, ostatné = vľavo v text zóne (max 56px výška)
  const logoH = Math.min(Math.round(overlayH * 0.38), 56);
  const logoW = Math.min(Math.round(logoH * 3.5), Math.round(format.width * 0.48));
  const logoPad = 20;

  if (shouldShowLogo(format, layout, figmaLogo) && format.logoPosition === "top") {
    placeLogo(frame, figmaLogo, logoPad, logoPad, logoW, logoH);
  } else if (shouldShowLogo(format, layout, figmaLogo)) {
    placeLogo(frame, figmaLogo, logoPad, format.height - overlayH + Math.round((overlayH - logoH) / 2), logoW, logoH);
  }

  if (!shouldShowHeadline(layout, headline)) return;

  // Text: ak je logo v text zóne, text začína za ním
  const hasLogoInZone = shouldShowLogo(format, layout, figmaLogo) && format.logoPosition !== "top";
  const textX = hasLogoInZone ? logoPad + logoW + 14 : logoPad;
  const textW = format.width - textX - logoPad;
  const fontSize = Math.max(14, Math.min(layout.headline_size_px || 32, Math.floor(overlayH * 0.35)));
  const txt = figma.createText();
  txt.fontName = FONT;
  txt.characters = headline || "HEADLINE";
  txt.fontSize = fontSize;
  txt.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  txt.resize(textW, overlayH);
  txt.textAutoResize = "HEIGHT";
  txt.x = textX;
  txt.y = format.height - overlayH + Math.round((overlayH - fontSize * 1.2) / 2);
  frame.appendChild(txt);
}

function addSafeZones(frame, format) {
  const sz = format.safeZones;
  if (!sz) return;

  // Top / bottom no-go zóny (červené)
  if (sz.top > 0) {
    addNoGoRect(frame, "Safe zone TOP", 0, 0, format.width, sz.top);
  }
  if (sz.bottom > 0) {
    addNoGoRect(frame, "Safe zone BOTTOM", 0, format.height - sz.bottom, format.width, sz.bottom);
  }

  // Bočné no-go zóny — ženské weby interscroller (sides: 50)
  if (sz.sides > 0) {
    addNoGoRect(frame, "Safe zone LEFT", 0, 0, sz.sides, format.height);
    addNoGoRect(frame, "Safe zone RIGHT", format.width - sz.sides, 0, sz.sides, format.height);
  }

  // JOJ / Markíza branding — centerWidth + topOffset
  // Červené: top pruh + ľavý a pravý okraj. Zelené: safe stred
  if (sz.centerWidth && sz.topOffset !== undefined) {
    const sideW = Math.round((format.width - sz.centerWidth) / 2);
    addNoGoRect(frame, "No-go TOP", 0, 0, format.width, sz.topOffset);
    addNoGoRect(frame, "No-go LEFT", 0, sz.topOffset, sideW, format.height - sz.topOffset);
    addNoGoRect(frame, "No-go RIGHT", format.width - sideW, sz.topOffset, sideW, format.height - sz.topOffset);
    addSafeRect(frame, "Safe z\u00f3na (obsah)", sideW, sz.topOffset, sz.centerWidth, format.height - sz.topOffset);
  }

  // Topky branding — safeInner: centrovaná vnútorná safe zóna (zelená)
  if (sz.safeInner) {
    const iw = sz.safeInner.width;
    const ih = sz.safeInner.height;
    const ix = Math.round((format.width - iw) / 2);
    const iy = Math.round((format.height - ih) / 2);
    addSafeRect(frame, "Safe z\u00f3na (inner " + iw + "\u00d7" + ih + ")", ix, iy, iw, ih);
  }
}

// Červená polopriesvitná no-go zóna
function addNoGoRect(frame, name, x, y, w, h) {
  const r = figma.createRectangle();
  r.name = name;
  r.resize(w, h);
  r.x = x;
  r.y = y;
  r.fills = [{ type: "SOLID", color: { r: 1, g: 0, b: 0 }, opacity: 0.08 }];
  r.locked = true;
  frame.appendChild(r);
}

// Zelená polopriesvitná safe zóna
function addSafeRect(frame, name, x, y, w, h) {
  const r = figma.createRectangle();
  r.name = name;
  r.resize(w, h);
  r.x = x;
  r.y = y;
  r.fills = [{ type: "SOLID", color: { r: 0, g: 0.75, b: 0.2 }, opacity: 0.10 }];
  r.locked = true;
  frame.appendChild(r);
}

/* =====================================================================
   EXPORT — zabalenie vygenerovaných frameov pre mediálku
   Doplnené k existujúcemu kódu, nič neprepisuje.

   Plugin vytvára jednu stránku na kanál a frames pomenúva
   "Názov — TYP [tagging]". Export preto prechádza všetky stránky a
   frames rozoznáva podľa pluginData (tbTagging), s fallbackom na
   hranatú zátvorku v názve.
   ===================================================================== */

(function () {
  "use strict";

  var HELPER_PATTERNS = [
    /^⚠/, /safe\s*zón/i, /safe\s*zone/i, /^recipe:/i,
    /\bchecks?\b/i, /content area guide/i, /^guide\b/i, /^#guide/i
  ];

  function isHelperLayer(node) {
    for (var i = 0; i < HELPER_PATTERNS.length; i++) {
      if (HELPER_PATTERNS[i].test(node.name)) return true;
    }
    return false;
  }

  function isGeneratedFrame(n) {
    if (!n || n.type !== "FRAME") return false;
    try { if (n.getPluginData("tbTagging")) return true; } catch (e) {}
    return /\[[^\]]+\]\s*$/.test(n.name);
  }

  function frameMeta(n, pageName) {
    var d = { limit: "", formatId: "", tagging: "", channel: "" };
    function read(key) {
      try {
        var v = n.getSharedPluginData("tbgen", key);
        if (v) return v;
      } catch (e) {}
      try { return n.getPluginData(key) || ""; } catch (e) { return ""; }
    }
    d.limit = read("tbLimit");
    d.formatId = read("tbFormatId");
    d.tagging = read("tbTagging");
    d.channel = read("tbChannel");
    if (!d.tagging) {
      var m = String(n.name).match(/\[([^\]]+)\]\s*$/);
      d.tagging = m ? m[1] : "";
    }
    if (!d.channel) d.channel = pageName || "";
    return d;
  }

  function hideHelpers(frame) {
    var found = [];
    try { found = frame.findAll(function (n) { return n.visible && isHelperLayer(n); }); }
    catch (e) { found = []; }
    for (var i = 0; i < found.length; i++) found[i].visible = false;
    return found;
  }

  function restore(nodes) {
    for (var i = 0; i < nodes.length; i++) {
      try { nodes[i].visible = true; } catch (e) {}
    }
  }

  async function pagesToScan(allPages) {
    if (!allPages) return [figma.currentPage];
    try { if (figma.loadAllPagesAsync) await figma.loadAllPagesAsync(); } catch (e) {}
    return Array.prototype.slice.call(figma.root.children);
  }

  async function collectTargets(allPages) {
    // 1) výber používateľa má prednosť; sekcie a skupiny rozbalíme
    var sel = figma.currentPage.selection;
    if (sel && sel.length) {
      var picked = [];
      for (var i = 0; i < sel.length; i++) {
        var n = sel[i];
        if (n.type === "FRAME") picked.push({ node: n, page: figma.currentPage.name });
        else if (typeof n.findAll === "function") {
          var inner = n.findAll(isGeneratedFrame);
          for (var j = 0; j < inner.length; j++) picked.push({ node: inner[j], page: figma.currentPage.name });
        }
      }
      if (picked.length) return picked;
    }

    // 2) inak prejdi stránky a nájdi vygenerované frames
    var pages = await pagesToScan(allPages);
    var out = [];
    for (var p = 0; p < pages.length; p++) {
      var page = pages[p];
      var found;
      try { found = page.findAll(isGeneratedFrame); } catch (e) { found = []; }
      for (var k = 0; k < found.length; k++) out.push({ node: found[k], page: page.name });
    }
    return out;
  }

  async function exportFrames(msg) {
    msg = msg || {};
    var targets = await collectTargets(msg.allPages !== false);

    if (!targets.length) {
      figma.ui.postMessage({
        type: "export-error",
        error: "Nenašiel som žiadne vygenerované frames. Najprv vygeneruj formáty, alebo označ frames, ktoré chceš exportovať."
      });
      return;
    }

    figma.ui.postMessage({ type: "export-start", total: targets.length });

    for (var i = 0; i < targets.length; i++) {
      var f = targets[i].node;
      var meta = frameMeta(f, targets[i].page);
      var hidden = msg.hideHelpers === false ? [] : hideHelpers(f);
      var bytes = null, err = null;

      try {
        bytes = await f.exportAsync({ format: "PNG", constraint: { type: "SCALE", value: 1 } });
      } catch (e) {
        err = String(e && e.message ? e.message : e);
      }

      restore(hidden);

      figma.ui.postMessage({
        type: "export-frame",
        index: i,
        total: targets.length,
        name: f.name,
        page: targets[i].page,
        width: Math.round(f.width),
        height: Math.round(f.height),
        limit: meta.limit,
        formatId: meta.formatId,
        tagging: meta.tagging,
        channel: meta.channel,
        bytes: bytes,
        error: err
      });

      await new Promise(function (r) { setTimeout(r, 0); });
    }

    figma.ui.postMessage({ type: "export-end", total: targets.length });
  }

  var previous = figma.ui.onmessage;
  figma.ui.onmessage = function (msg, props) {
    if (msg && msg.type === "export-request") return exportFrames(msg);
    if (typeof previous === "function") return previous(msg, props);
  };
})();
