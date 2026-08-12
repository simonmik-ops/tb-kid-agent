// code.js

// Menný priestor pre metadáta na frameoch. Musí zostať stabilný — čítajú
// ho externé nástroje cez getSharedPluginData.
var TB_NS = "tbgen";
var TB_GENERATOR_VERSION = "1.6.0";
var TB_QA_SCOPE = "runtime-geometry+material-rules; pixel-reference-required";

var TB = {
  headline: function (W, H) {
    // Optická škála podľa rodiny formátu. Jedna mocninová krivka zväčšovala
    // portraity (1080×1920 = 82 px) a pritom nedržala rovnakú hierarchiu vo
    // wide formátoch. Limity vychádzajú z InvestQ Figmy a Adform PSD.
    var r = W / H;
    // Wide kreatívy škálujú podľa výšky aj nad 1200×628. Starý strop 52 px
    // nechal 1920×1080 s rovnakým headlineom ako 1200×628, takže publisher
    // a YouTube formáty pôsobili opticky zmenšené. 1200×628 ostáva 51 px,
    // 1920×1080 je 89 px — rovnaký 8,2 % pomer k výške.
    if (r > 1.45) return Math.round(clamp(H * 0.082, 18, 96));
    if (r < 0.75) return Math.round(clamp(W * 0.060, 22, 68));
    return Math.round(clamp(Math.min(W, H) * 0.056, 22, 68));
  },
  subheadline: function (W, H) { return Math.max(12, Math.round(TB.headline(W, H) * 0.52)); },
  legal: function (W, H) { return Math.max(12, Math.min(24, Math.round(TB.headline(W, H) * 0.30))); },
  padding: function (W, H) { return Math.max(12, Math.round(0.055 * Math.sqrt(W * H))); },
  logoBox: function (W, H) {
    var r = W / H;
    var h = r > 1.45
      ? Math.min(H * 0.21, W * 0.14)
      : (r < 0.75 ? Math.min(W * 0.14, H * 0.10) : Math.min(W * 0.14, H * 0.14));
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
    var h = Math.max(36, Math.min(64, Math.round(0.055 * Math.sqrt(W * H))));
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

// ── Kontrastný modul (WCAG 2.1) ─────────────────────────────────────────────
// Prenesené z master (Krok 2e, commit 97b5d3f) — origin tieto funkcie
// nemal vôbec. POZOR na použitie: ensureReadableSurface sa v tomto kroku
// NIKDE nezapája na automatické stmavovanie brand plochy kvôli kontrastu —
// to explicitne zakazuje Krok 3 pravidlo 2 (biela na brandovej ploche je
// pravidlo, nie výsledok optimalizácie; stmavenie dávalo bahnistú hnedú).
// Tu sú len ako dostupné čisté funkcie — validation_warnings cez
// noteContrastIfLow je jediné aktívne prepojenie (origin ich už níta,
// pozri createValidationReport/addValidationBadge).
// Samostatný súbor (plugin/contrast.js) by bol čistejší, ale tento plugin
// nemá build krok — manifest.json ukazuje na jediný "main": "code.js" a
// Figma ho spúšťa ako plochý skript bez require/import. Preto blok tu,
// pred prvým použitím (brandColor nižšie).

// sRGB kanál 0..1 → lineárna hodnota.
function srgbToLinear(c) {
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

// {r,g,b} v rozsahu 0..1 (Figma formát) → relatívny jas.
function relativeLuminance(color) {
  return 0.2126 * srgbToLinear(color.r)
       + 0.7152 * srgbToLinear(color.g)
       + 0.0722 * srgbToLinear(color.b);
}

function contrastRatio(a, b) {
  const la = relativeLuminance(a), lb = relativeLuminance(b);
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

// Upraví farbu plochy tak, aby voči textColor dosiahla minRatio — postupne
// stmavuje (biely text) alebo zosvetľuje (tmavý text) v krokoch po 4 %,
// max. 40 iterácií. Násobí všetky tri kanály rovnakým faktorom (zachová hue).
// Ak sa pomer nedosiahne ani pri takmer čiernej/bielej, vráti najlepšiu
// dosiahnutú hodnotu namiesto pádu na natvrdo modrú.
function ensureReadableSurface(surface, textColor, minRatio) {
  const textIsLight = relativeLuminance(textColor) > 0.5;
  let color = { r: surface.r, g: surface.g, b: surface.b };
  let best = color, bestRatio = contrastRatio(color, textColor);
  for (let i = 0; i < 40 && bestRatio < minRatio; i++) {
    if (textIsLight) {
      color = { r: color.r * 0.96, g: color.g * 0.96, b: color.b * 0.96 };
    } else {
      color = {
        r: color.r + (1 - color.r) * 0.04,
        g: color.g + (1 - color.g) * 0.04,
        b: color.b + (1 - color.b) * 0.04
      };
    }
    const ratio = contrastRatio(color, textColor);
    if (ratio > bestRatio) { bestRatio = ratio; best = color; }
  }
  return best;
}

// Vráti bielu alebo tmavú textovú farbu podľa toho, ktorá dá voči ploche
// vyšší kontrast — pre miesta, kde plochu meniť nemôžeme (napr. reálna
// fotka bez krycej masky). NEPOUŽÍVAŤ na brandColor(layout) plochu — tam
// platí Krok 3 pravidlo 2 (biela vždy).
function pickTextColor(surface) {
  const white = { r: 1, g: 1, b: 1 }, black = { r: 0, g: 0, b: 0 };
  return contrastRatio(surface, white) >= contrastRatio(surface, black) ? white : black;
}

// QA hlásenie, keď pomer ostane pod minRatio. Zapisuje do
// layout.validation_warnings — origin tento kanál už číta
// (createValidationReport/addValidationBadge).
function noteContrastIfLow(layout, surface, textColor, minRatio, where) {
  const ratio = contrastRatio(surface, textColor);
  if (ratio >= minRatio) return true;
  if (!layout.validation_warnings) layout.validation_warnings = [];
  layout.validation_warnings.push(
    "low_contrast_" + where + "_" + ratio.toFixed(1).replace(".", "_") + "_to_1"
  );
  return false;
}

// Farba brand plochy = z analýzy vizuálu (nie natvrdo modrá); fallback brand blue
function brandColor(layout) {
  if (layout && typeof layout.bg_r === "number") {
    return { r: layout.bg_r, g: layout.bg_g, b: layout.bg_b };
  }
  return BRAND_COLOR;
}

function brandEdgeColor(layout, edge) {
  const prefix = edge === "top" ? "bg_top_" : "bg_bottom_";
  if (layout && typeof layout[prefix + "r"] === "number") {
    return { r: layout[prefix + "r"], g: layout[prefix + "g"], b: layout[prefix + "b"] };
  }
  return brandColor(layout);
}

function shadedColor(color, factor) {
  return {
    r: clamp(color.r * factor, 0, 1),
    g: clamp(color.g * factor, 0, 1),
    b: clamp(color.b * factor, 0, 1)
  };
}

function sampledBrandGradient(layout, shade) {
  const factor = typeof shade === "number" ? shade : 1;
  const vertical = layout && Array.isArray(layout.bg_vertical_stops)
    ? layout.bg_vertical_stops.filter(function (stop) {
        return stop && typeof stop.position === "number" && stop.color &&
          typeof stop.color.r === "number" && typeof stop.color.g === "number" &&
          typeof stop.color.b === "number";
      })
    : [];
  if (vertical.length >= 3) {
    return {
      type: "GRADIENT_LINEAR",
      gradientTransform: [[0, 1, 0], [1, 0, 0]],
      gradientStops: vertical.map(function (stop) {
        const c = shadedColor(stop.color, factor);
        return { position: clamp(stop.position, 0, 1), color: { r: c.r, g: c.g, b: c.b, a: 1 } };
      })
    };
  }
  const top = shadedColor(brandEdgeColor(layout, "top"), factor);
  const bottom = shadedColor(brandEdgeColor(layout, "bottom"), factor);
  return {
    type: "GRADIENT_LINEAR",
    gradientTransform: [[0, 1, 0], [1, 0, 0]],
    gradientStops: [
      { position: 0, color: { r: top.r, g: top.g, b: top.b, a: 1 } },
      { position: 1, color: { r: bottom.r, g: bottom.g, b: bottom.b, a: 1 } }
    ]
  };
}

function sampledLowerPanelGradient(layout, bottomShade) {
  const edge = brandEdgeColor(layout, "bottom");
  const dark = shadedColor(edge, typeof bottomShade === "number" ? bottomShade : 0.46);
  return {
    type: "GRADIENT_LINEAR",
    gradientTransform: [[0, 1, 0], [1, 0, 0]],
    gradientStops: [
      { position: 0, color: { r: edge.r, g: edge.g, b: edge.b, a: 1 } },
      { position: 1, color: { r: dark.r, g: dark.g, b: dark.b, a: 1 } }
    ]
  };
}

function sampledPortraitOverlayGradient(layout, imageBoundaryStop, bottomShade) {
  const edge = brandEdgeColor(layout, "bottom");
  const dark = shadedColor(edge, typeof bottomShade === "number" ? bottomShade : 0.46);
  const boundary = clamp(imageBoundaryStop, 0.16, 0.72);
  const firstDark = Math.max(0.06, boundary * 0.48);
  return {
    type: "GRADIENT_LINEAR",
    gradientTransform: [[0, 1, 0], [1, 0, 0]],
    gradientStops: [
      { position: 0, color: { r: edge.r, g: edge.g, b: edge.b, a: 0 } },
      { position: firstDark, color: { r: dark.r, g: dark.g, b: dark.b, a: 0.58 } },
      { position: boundary, color: { r: dark.r, g: dark.g, b: dark.b, a: 1 } },
      { position: 1, color: { r: dark.r, g: dark.g, b: dark.b, a: 1 } }
    ]
  };
}

// Veľkosť „AI generované" textu — jednotná pre vykreslenie aj rezervu miesta.
function aiNoteFontSize(format) {
  return Math.round(clamp(Math.min(format.width, format.height) * 0.024, 12, 18));
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
  logoBytes, visualRecipe, tagging, showGuides, aiGenerated, kvBg, kvBgTop, kvBgBottom,
  kvLumaBottom, kvInputCleanup, kvBgVertical
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

  function assetKindForFormat(format) {
    const r = format.width / format.height;
    if (r >= 1.25) return "landscape";
    if (r <= 0.8) return "portrait";
    return "square";
  }

  function pickExactKV(format) {
    const kind = assetKindForFormat(format);
    return kind === "landscape" ? imgLandscape : (kind === "portrait" ? imgPortrait : imgSquare);
  }

  // Surd single-master rule: an absent orientation must not become a full-frame
  // cover crop. We still use the available master, but the renderer receives
  // an explicit fallback flag and switches to a protected composition with a
  // sampled-colour extension.
  function pickAdaptiveKV(format) {
    return pickExactKV(format) || imgSquare || imgPortrait || imgLandscape;
  }

  function sourceKindForImage(image) {
    if (!image) return "missing";
    if (image === imgSquare) return "square";
    if (image === imgPortrait) return "portrait";
    if (image === imgLandscape) return "landscape";
    return "unknown";
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
  let qaPassedCount = 0;
  let qaFailedCount = 0;
  let qaIssueCount = 0;
  const qaRows = [];

  for (const channel of channels) {
    const items = byChannel[channel];

    let page = Array.from(figma.root.children).find(p => p.name === channel);
    if (!page) {
      page = figma.createPage();
      page.name = channel;
    }

    let xOffset = 0;
    // Never stack a new run exactly over an older one. Apart from making the
    // canvas unreadable, overlapping runs made it look as if a code change had
    // no effect because an older frame could remain selected/visible.
    const runYOffset = page.children.length
      ? Math.max.apply(null, page.children.map(function (n) {
          return (typeof n.y === "number" && typeof n.height === "number") ? n.y + n.height : 0;
        })) + 160
      : 0;

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
        // Keep the family boundary identical to assetKindForFormat(). A 4:5
        // output (ratio 0.8) previously requested a portrait KV but rendered
        // with the square cover-crop layout, which enlarged faces and ignored
        // the colour-extension panel.
        layout.master_family = ratio >= 1.25 ? "wide" : (ratio <= 0.8 ? "portrait" : "square");
        layout.master_safe_zone = true;
      }

      if (kvBg && typeof layout.bg_r !== "number") {
        layout.bg_r = kvBg.r; layout.bg_g = kvBg.g; layout.bg_b = kvBg.b;
      }
      if (kvBgTop && typeof layout.bg_top_r !== "number") {
        layout.bg_top_r = kvBgTop.r; layout.bg_top_g = kvBgTop.g; layout.bg_top_b = kvBgTop.b;
      }
      if (kvBgBottom && typeof layout.bg_bottom_r !== "number") {
        layout.bg_bottom_r = kvBgBottom.r; layout.bg_bottom_g = kvBgBottom.g; layout.bg_bottom_b = kvBgBottom.b;
      }
      if (Array.isArray(kvBgVertical) && kvBgVertical.length >= 3 && !layout.bg_vertical_stops) {
        layout.bg_vertical_stops = kvBgVertical;
      }
      if (typeof kvLumaBottom === "number" && typeof layout.kv_luma_bottom !== "number") {
        layout.kv_luma_bottom = kvLumaBottom;
      }

      // --- KV podľa orientácie formátu (vetva clean-frames) ---------------
      const requiredAssetKind = assetKindForFormat(format);
      const exactImage = pickExactKV(format);
      const figmaImage = pickAdaptiveKV(format);
      const adaptedFromSingleMaster = !exactImage && !!figmaImage;
      layout.asset_fallback_kind = adaptedFromSingleMaster ? requiredAssetKind : null;
      layout.kv_source_kind = sourceKindForImage(figmaImage);
      layout.kv_strategy = adaptedFromSingleMaster ? "protected-single-master" : "exact-orientation";

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
          tbHeight: String(format.height || ""),
          tbGeneratedBy: "tb-kid-agent@" + TB_GENERATOR_VERSION,
          tbQaScope: TB_QA_SCOPE,
          tbVisualReview: "REQUIRED_FOR_NEW_CAMPAIGN",
          tbKvRequired: requiredAssetKind,
          tbKvSource: layout.kv_source_kind,
          tbKvStrategy: layout.kv_strategy,
          tbInputCleanup: JSON.stringify(kvInputCleanup || {})
        };
        for (var mk in meta) {
          frame.setPluginData(mk, meta[mk]);
          frame.setSharedPluginData(TB_NS, mk, meta[mk]);
        }
      } catch (e) {}
      frame.resize(format.width, format.height);
      frame.x = xOffset;
      frame.y = runYOffset;
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

      // Builders may refine the strategy (for example Adform protected
      // single-master). Persist the final value, not only the initial picker.
      try {
        frame.setPluginData("tbKvStrategy", String(layout.kv_strategy || ""));
        frame.setSharedPluginData(TB_NS, "tbKvStrategy", String(layout.kv_strategy || ""));
      } catch (e) {}

      // Povinná post-render kontrola skutočných Figma uzlov. Na rozdiel od
      // statických unit testov kontroluje každý práve vytvorený frame: font,
      // rozmery, overflow, kolízie a pri Adform šablónach aj PSD súradnice.
      const frameQa = validateGeneratedFrame(frame, format, layout, layoutType, {
        headline: headline,
        subheadline: subheadline,
        ctaText: ctaText,
        legalText: legalText,
        badgeText: badgeText,
        aiGenerated: aiNote,
        hasLogo: !!figmaLogo
      }, localAdformTemplate);
      if (frameQa.issues.length) {
        qaFailedCount++;
        qaIssueCount += frameQa.issues.length;
        qaRows.push({
          name: format.name || (format.width + "×" + format.height),
          channel: format.channel || channel,
          warnings: frameQa.issues
        });
      } else {
        qaPassedCount++;
      }
      try {
        frame.setPluginData("tbQaStatus", frameQa.issues.length ? "FAIL" : "PASS");
        frame.setPluginData("tbQaIssues", JSON.stringify(frameQa.issues));
        frame.setSharedPluginData(TB_NS, "tbQaStatus", frameQa.issues.length ? "FAIL" : "PASS");
        frame.setSharedPluginData(TB_NS, "tbQaIssues", JSON.stringify(frameQa.issues));
      } catch (e) {}

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
  if (guides || qaFailedCount > 0) createValidationReport(formats, headline, adType, qaRows);
  if (allFrames.length > 0) figma.viewport.scrollAndZoomIntoView(allFrames.slice(0, 3));

  figma.ui.postMessage({
    type: "done", formatCount: formats.length, pageCount: channels.length,
    riskFlaggedCount, qaPassedCount, qaFailedCount, qaIssueCount
  });
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

function createValidationReport(formats, headline, adType, renderedQaRows) {
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
  const qaRows = renderedQaRows || [];
  for (const qaRow of qaRows) rows.push(qaRow);

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
    addText(frame, "PASS — geometria, typografia, logo, CTA a referenčné súradnice prešli automatickou kontrolou.", 48, 170, 900, 80, 20, { r: 0.15, g: 0.44, b: 0.24 });
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
    master_core_50pct_check: "Master: dôležitá grafika musí zostať v stredovej polovici (2000×2000 z 4000×4000).",
    qa_font_fallback_inter: "Použil sa Inter namiesto Tatra banka Sans.",
    qa_missing_headline: "Chýba headline, hoci ho pravidlo vyžaduje.",
    qa_missing_subheadline: "Chýba subheadline, hoci ho pravidlo vyžaduje.",
    qa_missing_cta: "Chýba CTA, hoci ho pravidlo vyžaduje.",
    qa_missing_logo: "Chýba logo, hoci ho pravidlo vyžaduje.",
    qa_content_overflow: "Obsah presahuje mimo frame.",
    qa_content_overlap: "Headline, subheadline, CTA alebo logo sa prekrývajú.",
    qa_typography_scale: "Veľkosť typografie je mimo schválenej tolerancie.",
    qa_logo_scale: "Veľkosť alebo pomer loga nesedí s pravidlom formátu.",
    qa_cta_style: "CTA nemá schválenú výšku alebo modrú farbu.",
    qa_text_spacing: "Headline a subheadline sú od seba opticky príliš ďaleko.",
    qa_wide_color_extension: "Landscape farebná plocha sa nenapája plynulo na vizuál.",
    qa_unsafe_single_master_crop: "Štvorcový master sa pri inom pomere strán orezáva namiesto bezpečného contain/extension layoutu.",
    qa_psd_geometry: "Adform prvok nesedí na PSD súradnice.",
    qa_unexpected_effect: "Frame obsahuje neželaný tieň alebo efekt.",
    qa_unclipped_frame: "Frame nemá zapnuté orezanie obsahu."
  };
  return warnings.map(w => labels[w] || w).join(" ");
}

// -------------------------------------------------------------------------
// Post-render visual QA
// -------------------------------------------------------------------------

function qaFind(frame, name) {
  try { return frame.findOne(function (n) { return n.name === name; }); }
  catch (e) { return null; }
}

function qaFindText(frame, value) {
  if (!value) return null;
  try {
    return frame.findOne(function (n) {
      return n.type === "TEXT" && String(n.characters || "").trim() === String(value).trim();
    });
  } catch (e) { return null; }
}

function qaBox(node, frame) {
  if (!node || !node.absoluteBoundingBox || !frame.absoluteBoundingBox) return null;
  return {
    x: node.absoluteBoundingBox.x - frame.absoluteBoundingBox.x,
    y: node.absoluteBoundingBox.y - frame.absoluteBoundingBox.y,
    w: node.absoluteBoundingBox.width,
    h: node.absoluteBoundingBox.height
  };
}

function qaOutside(box, frame, tolerance) {
  if (!box) return false;
  const t = tolerance || 0;
  return box.x < -t || box.y < -t ||
    box.x + box.w > frame.width + t || box.y + box.h > frame.height + t;
}

function qaOverlap(a, b, tolerance) {
  if (!a || !b) return false;
  const t = tolerance || 0;
  return a.x < b.x + b.w - t && a.x + a.w > b.x + t &&
    a.y < b.y + b.h - t && a.y + a.h > b.y + t;
}

function qaNear(actual, expected, tolerance) {
  return Math.abs(actual - expected) <= tolerance;
}

function validateGeneratedFrame(frame, format, layout, layoutType, content, templateId) {
  const issues = [];
  function add(code) { if (issues.indexOf(code) === -1) issues.push(code); }
  const headline = qaFind(frame, "Headline") || qaFindText(frame, content.headline);
  const subheadline = qaFind(frame, "Subheadline") || qaFindText(frame, content.subheadline);
  const cta = qaFind(frame, "CTA button");
  const logo = qaFind(frame, "Logo");
  const noCopyLayouts = ["clean_image", "native_center", "logo_only", "video_placeholder"];
  const supportsCopy = noCopyLayouts.indexOf(layoutType) === -1;
  const supportsSubheadline = ["master_safe", "adform_psd", "full_bleed"].indexOf(layoutType) !== -1;
  const supportsCta = ["master_safe", "adform_psd", "branding_skin", "side_safe",
    "interscroller_safe", "email_layout"].indexOf(layoutType) !== -1;

  if (!frame.clipsContent) add("qa_unclipped_frame");
  if (FONT.family !== STYLE.fontFamily && (headline || subheadline || cta)) add("qa_font_fallback_inter");

  if (supportsCopy && layout.show_headline !== false && content.headline && !headline) add("qa_missing_headline");
  if (supportsSubheadline && layout.show_subheadline !== false && content.subheadline && !subheadline) add("qa_missing_subheadline");
  if (supportsCta && layout.show_cta !== false && content.ctaText && !cta) add("qa_missing_cta");
  if (layoutType !== "clean_image" && layoutType !== "native_center" &&
      layout.show_logo !== false && content.hasLogo && !format.noLogo && !logo) add("qa_missing_logo");

  const contentNodes = [headline, subheadline, cta, logo].filter(Boolean);
  for (const node of contentNodes) {
    if (qaOutside(qaBox(node, frame), frame, 2)) add("qa_content_overflow");
  }
  const collisionPairs = [[headline, subheadline], [headline, cta], [headline, logo],
    [subheadline, cta], [subheadline, logo], [cta, logo]];
  for (const pair of collisionPairs) {
    if (qaOverlap(qaBox(pair[0], frame), qaBox(pair[1], frame), 2)) add("qa_content_overlap");
  }

  const resolvedAdformRules = layoutType === "adform_psd"
    ? resolveAdformPsdRules(templateId, content, layout) : null;

  if (headline && headline.type === "TEXT") {
    const expected = resolvedAdformRules
      ? resolvedAdformRules.headlineSize
      : TB.headline(format.width, format.height);
    const size = typeof headline.fontSize === "number" ? headline.fontSize : expected;
    if (size < expected * 0.82 || size > expected * 1.08) add("qa_typography_scale");
  }

  if (layoutType === "master_safe") {
    if (subheadline && subheadline.type === "TEXT") {
      const expectedSub = TB.subheadline(format.width, format.height);
      const subSize = typeof subheadline.fontSize === "number" ? subheadline.fontSize : expectedSub;
      if (subSize < expectedSub * 0.90 || subSize > expectedSub * 1.08) add("qa_typography_scale");
    }
    if (logo) {
      const expectedLogo = TB.logoBox(format.width, format.height);
      const logoBox = qaBox(logo, frame);
      if (!logoBox || !qaNear(logoBox.w, expectedLogo.width, 2) ||
          !qaNear(logoBox.h, expectedLogo.height, 2)) add("qa_logo_scale");
    }
    if (cta) {
      const expectedButton = TB.button(format.width, format.height);
      const ctaBox = qaBox(cta, frame);
      let blueOk = false;
      try {
        const fill = cta.fills && cta.fills[0];
        blueOk = !!fill && fill.type === "SOLID" &&
          qaNear(fill.color.r, 0, 0.01) && qaNear(fill.color.g, 0.278, 0.01) &&
          qaNear(fill.color.b, 0.973, 0.01);
      } catch (e) {}
      if (!ctaBox || !qaNear(ctaBox.h, expectedButton.height, 2) || !blueOk) add("qa_cta_style");
    }
    if (headline && subheadline) {
      const hb = qaBox(headline, frame), sb = qaBox(subheadline, frame);
      const maxGap = Math.max(16, TB.headline(format.width, format.height) * 0.55);
      if (hb && sb && sb.y - (hb.y + hb.h) > maxGap) add("qa_text_spacing");
    }
    if (format.width / format.height > 1.45) {
      const panel = qaFind(frame, "Wide content panel");
      let seamless = false;
      try {
        const fill = panel && panel.fills && panel.fills[0];
        const stops = fill && fill.type === "GRADIENT_LINEAR" ? fill.gradientStops : [];
        seamless = stops.length >= 4 && stops[stops.length - 1].color.a >= 0.98 &&
          stops[stops.length - 2].color.a >= 0.98;
      } catch (e) {}
      if (!seamless) add("qa_wide_color_extension");
    }
  }

  if (layout.asset_fallback_kind && (layoutType === "master_safe" || layoutType === "adform_psd")) {
    const protectedMaster = qaFind(frame, "Key visual — protected full master");
    if (!protectedMaster) add("qa_unsafe_single_master_crop");
    if (protectedMaster && protectedMaster.parent) {
      if (protectedMaster.width > protectedMaster.parent.width + 1 ||
          protectedMaster.height > protectedMaster.parent.height + 1) {
        add("qa_unsafe_single_master_crop");
      }
    }
  }

  if (layoutType === "adform_psd" && resolvedAdformRules) {
    const rules = resolvedAdformRules;
    const checks = [
      [headline, rules.headline, false],
      [cta, rules.cta, true],
      [logo, rules.bankLogo, true]
    ];
    for (const check of checks) {
      if (!check[0] || !check[1]) continue;
      const box = qaBox(check[0], frame);
      const ref = check[1];
      if (!box || !qaNear(box.x, ref[0], 2) || !qaNear(box.y, ref[1], 2) ||
          !qaNear(box.w, ref[2], 2) || (check[2] && !qaNear(box.h, ref[3], 2))) {
        add("qa_psd_geometry");
      }
    }
    if (templateId === "adform_970x250") {
      const brandPanel = qaFind(frame, "Brand panel");
      let sampledGradient = false;
      try {
        const fill = brandPanel && brandPanel.fills && brandPanel.fills[0];
        sampledGradient = !!fill && fill.type === "GRADIENT_LINEAR" && fill.gradientStops.length >= 2;
      } catch (e) {}
      if (!sampledGradient) add("qa_wide_color_extension");
    }
  }

  try {
    const effected = frame.findAll(function (n) {
      return n.visible !== false && n.effects && n.effects.length > 0;
    });
    if (effected.length) add("qa_unexpected_effect");
  } catch (e) {}

  return { status: issues.length ? "FAIL" : "PASS", issues: issues };
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
  frame.fills = layout.asset_fallback_kind
    ? [sampledBrandGradient(layout, 1)]
    : [{ type: "SOLID", color: { r: 0.96, g: 0.97, b: 0.98 } }];
  if (layout.asset_fallback_kind && figmaImage && CUR_IMG_W && CUR_IMG_H) {
    // Protected single-master rule applies to clean assets too. Preserve the
    // whole composition and extend it with the KV colour instead of producing
    // a face-only portrait or a vertically sliced landscape crop.
    const family = format.width / format.height >= 1.25 ? "wide" :
      (format.width / format.height <= 0.8 ? "portrait" : "square");
    // Krok 4c: predimenzovanie len pre square/portrait (zone == celý frame,
    // rovnaká báza ako v addMasterCoreImage) — wide necháva pôvodné CONTAIN
    // zarovnanie, samostatné meranie/kolo ako inde.
    addProtectedImageFrame(
      frame, figmaImage, { width: CUR_IMG_W, height: CUR_IMG_H },
      "Adapted clean master — full composition",
      [0, 0, format.width, format.height],
      family === "wide" ? { x: 0, y: 0.5 } :
        (family === "portrait" ? { x: 0.5, y: 0 } : { x: 0.5, y: 0.5 }),
      family === "wide" ? undefined : (format.height / format.width)
    );
    if (family === "portrait") {
      // Musí zodpovedať PRESNE tomu, čo addProtectedImageFrame vyššie
      // skutočne vykreslilo (Krok 4c oversize), inak "Clean portrait colour
      // extension" panel vychádza z geometrie starého (menšieho) obrázka a
      // sedí na nesprávnom mieste — buď sa prekrýva s (teraz väčším)
      // obrázkom, alebo necháva medzeru.
      const cleanRatioHW = format.height / format.width;
      const cleanScale = (format.width / CUR_IMG_W) * kvOversizeMultiplier(cleanRatioHW);
      const cleanRenderedH = CUR_IMG_H * cleanScale;
      const cleanRectY = Math.round(kvVerticalCenterFrac(cleanRatioHW) * format.height - cleanRenderedH / 2);
      const cleanImageH = Math.min(format.height, cleanRectY + cleanRenderedH);
      if (cleanImageH < format.height - 1) {
        const extensionY = Math.round(cleanImageH * 0.78);
        const extension = figma.createRectangle();
        extension.name = "Clean portrait colour extension";
        extension.resize(format.width, format.height - extensionY);
        extension.x = 0;
        extension.y = extensionY;
        const cleanBoundaryStop = (cleanImageH - extensionY) /
          Math.max(1, format.height - extensionY);
        extension.fills = [sampledPortraitOverlayGradient(layout, cleanBoundaryStop, 0.78)];
        frame.appendChild(extension);
      }
    }
    layout.kv_strategy = "clean-protected-single-master";
    return;
  }
  if (layout.image_fit === "contain" || !CUR_IMG_W || !CUR_IMG_H) {
    addImageRect(frame, figmaImage, "Image asset - no text / no logo", 0, 0, format.width, format.height, layout.image_fit === "contain" ? "FIT" : "FILL");
  } else {
    // Clean assets majú vyplniť plátno bez bielych technických pásov z KV.
    const cleanRatio = format.width / format.height;
    const cleanFocal = {
      x: typeof layout.crop_anchor_x === "number" ? layout.crop_anchor_x : 0.5,
      y: typeof layout.crop_anchor_y === "number" ? layout.crop_anchor_y : 0.5
    };
    // Krok 4c: predimenzovanie pre square/portrait (rovnaká báza ako
    // ostatné dve volania); wide necháva pôvodné cover+overscan zarovnanie.
    addFocalImageFrame(
      frame, figmaImage, { width: CUR_IMG_W, height: CUR_IMG_H },
      "Image asset - no text / no logo", [0, 0, format.width, format.height],
      cleanFocal, { x: 0.5, y: cleanRatio > 1.45 ? 0.62 : 0.5 }, 1.08,
      cleanRatio > 1.45 ? undefined : (1 / cleanRatio)
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

function resolveAdformPsdRules(templateId, content, layout) {
  const baseRules = ADFORM_PSD_RULES[templateId];
  if (!baseRules) return null;
  const rules = Object.assign({}, baseRules);
  const compactCopy = String((content && content.headline) || "").trim().length <= 22 &&
    !(content && content.badgeText) && !(content && content.legalText);
  rules.compactCopy = compactCopy;
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
    }[templateId];
    if (compact) Object.assign(rules, compact);
  }

  const adaptedPortrait = layout && layout.asset_fallback_kind === "portrait";
  if (adaptedPortrait && templateId === "adform_300x600") {
    Object.assign(rules, {
      panel: [0, 300, 300, 300],
      headline: [20, 365, 230, 58], headlineSize: 25,
      cta: [20, 455, 124, 42], bankLogo: [216, 480, 64, 62],
      ai: [23, 562, 100, 19]
    });
  }
  if (adaptedPortrait && templateId === "adform_160x600") {
    Object.assign(rules, {
      panel: [0, 160, 160, 440],
      headline: [12, 250, 136, 54], headlineSize: 22,
      cta: [15, 320, 130, 42], bankLogo: [43, 390, 74, 73],
      ai: [30, 548, 100, 19]
    });
  }
  return rules;
}

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

function addAdformBackgroundTreatment(frame, format, rules, templateId, layout) {
  const activeTemplate = templateId || adformTemplateId(format) || format.id;
  if (activeTemplate === "adform_970x250") {
    // The PSD example happens to use a blue-grey campaign panel. Surd's
    // system rule is broader: the extension follows the current KV colour.
    // A hard-coded blue panel is therefore wrong for the orange Investovanie
    // master and creates an unrelated second colour world.
    const panel = figma.createRectangle();
    panel.name = "Brand panel";
    panel.resize(545, 250);
    panel.x = 425;
    panel.y = 0;
    panel.fills = [sampledBrandGradient(layout, 0.64)];
    frame.appendChild(panel);
    return;
  }
  if (rules.panel) {
    if (layout && layout.asset_fallback_kind) {
      const panel = figma.createRectangle();
      panel.name = "Dark lower panel";
      panel.resize(rules.panel[2], rules.panel[3]);
      panel.x = rules.panel[0];
      panel.y = rules.panel[1];
      panel.fills = [sampledLowerPanelGradient(layout, 0.46)];
      frame.appendChild(panel);
    } else {
      addSolidRect(
        frame, "Dark lower panel",
        rules.panel[0], rules.panel[1], rules.panel[2], rules.panel[3],
        { r: 0.12, g: 0.10, b: 0.10 }, 0.94
      );
    }
    return;
  }

  // 300×250 is the smallest composite artboard and is especially sensitive
  // to a flat square KV: the baked campaign graphic and subject can sit under
  // the copy even when every PSD coordinate is technically correct. Recreate
  // the PSD's dark left-side image treatment from the current KV hue. The
  // opaque part covers the full text column and feathers out before the bank
  // lockup/subject, so readability is deterministic rather than crop-dependent.
  if (activeTemplate === "adform_300x250") {
    const sampled = shadedColor(brandEdgeColor(layout, "bottom"), 0.38);
    const leftScrim = figma.createRectangle();
    leftScrim.name = "PSD left readability treatment";
    leftScrim.resize(format.width, format.height);
    leftScrim.x = 0;
    leftScrim.y = 0;
    leftScrim.fills = [{
      type: "GRADIENT_LINEAR",
      gradientTransform: [[1, 0, 0], [0, 1, 0]],
      gradientStops: [
        { position: 0.00, color: { r: sampled.r, g: sampled.g, b: sampled.b, a: 0.96 } },
        { position: 0.52, color: { r: sampled.r, g: sampled.g, b: sampled.b, a: rules.compactCopy ? 0.92 : 0.88 } },
        { position: 0.72, color: { r: sampled.r, g: sampled.g, b: sampled.b, a: 0.50 } },
        { position: 1.00, color: { r: sampled.r, g: sampled.g, b: sampled.b, a: 0.00 } }
      ]
    }];
    frame.appendChild(leftScrim);
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

// oversizeFrameRatio (voliteľné, len clean_image square/portrait, zone ==
// celý frame): Krok 4c, rovnaký mechanizmus ako addMasterCoreImage/
// addProtectedImageFrame. Ostatní volajúci (side_safe, Adform PSD, micro)
// tento parameter neposielajú — mimo Surďovho referenčného modelu, zámerne
// nedotknutí.
function addFocalImageFrame(parent, figmaImage, imageSize, name, zone, focal, desired, overscan, oversizeFrameRatio) {
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

  const scale = typeof oversizeFrameRatio === "number"
    ? (zone[2] / imageSize.width) * kvOversizeMultiplier(oversizeFrameRatio)
    : Math.max(zone[2] / imageSize.width, zone[3] / imageSize.height) * (overscan || 1);
  const renderedW = imageSize.width * scale;
  const renderedH = imageSize.height * scale;
  const rect = figma.createRectangle();
  rect.name = "Key visual — focal crop";
  rect.resize(renderedW, renderedH);
  rect.fills = [{ type: "IMAGE", imageHash: figmaImage.hash, scaleMode: "FILL" }];

  if (typeof oversizeFrameRatio === "number") {
    rect.x = Math.round((zone[2] - renderedW) / 2);
    rect.y = Math.round(kvVerticalCenterFrac(oversizeFrameRatio) * zone[3] - renderedH / 2);
  } else {
    const focalX = clamp(focal.x, 0, 1);
    const focalY = clamp(focal.y, 0, 1);
    const targetX = zone[2] * desired.x;
    const targetY = zone[3] * desired.y;
    rect.x = clamp(targetX - focalX * renderedW, zone[2] - renderedW, 0);
    rect.y = clamp(targetY - focalY * renderedH, zone[3] - renderedH, 0);
  }
  holder.appendChild(rect);
  return holder;
}

// Krok 4c, wide: namerané priamo z referenčného VIZUAL-KV (d51uxTh8YqPdHujzi1Plt6,
// node 0:21, get_metadata) — 1107×1107 KV v zóne 900 px (75 % z 1200 px
// frameu) = ×1,23 šírky ZÓNY (nie celého frameu — na rozdiel od square/
// portrait, kde je zóna == frame, wide zóna je len 75 % šírky). Jediný
// nameraný wide bod (na rozdiel od square/portrait, kde sú tri) — fixná
// konštanta, nie interpolácia. Pozícia: takmer presne zarovnaná k PRAVEJ
// hrane zóny (KV pravý okraj 898 px vs. zóna 900 px — subjekt je pri hrane
// textového panelu, rozplýva sa smerom k nemu), zvislo takmer presne na
// strede (312,5/628 = 49,8 %).
const WIDE_KV_ZONE_MULTIPLIER = 1.23;

// Preserve the complete master when it is reused for another orientation.
// The remaining area is intentionally transparent so the sampled frame colour
// continues the visual, exactly as the Surd master-safe rule specifies.
// oversizeFrameRatio (voliteľné, len keď zone == celý frame, family
// square/portrait): Krok 4c mechanizmus ako addMasterCoreImage, len
// napojený na CONTAIN-bázovanú funkciu. wideZone (voliteľné, len family
// wide, zone == 75 % šírky sub-zóna): WIDE_KV_ZONE_MULTIPLIER, pravé
// zarovnanie, zvislý stred.
function addProtectedImageFrame(parent, figmaImage, imageSize, name, zone, alignment, oversizeFrameRatio, wideZone) {
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

  const scale = typeof oversizeFrameRatio === "number"
    ? (zone[2] / imageSize.width) * kvOversizeMultiplier(oversizeFrameRatio)
    : wideZone
      ? (zone[2] / imageSize.width) * WIDE_KV_ZONE_MULTIPLIER
      : Math.min(zone[2] / imageSize.width, zone[3] / imageSize.height);
  const renderedW = imageSize.width * scale;
  const renderedH = imageSize.height * scale;
  const rect = figma.createRectangle();
  rect.name = "Key visual — protected full master";
  rect.resize(renderedW, renderedH);
  rect.fills = [{ type: "IMAGE", imageHash: figmaImage.hash, scaleMode: "FILL" }];
  if (typeof oversizeFrameRatio === "number") {
    rect.x = Math.round((zone[2] - renderedW) / 2);
    rect.y = Math.round(kvVerticalCenterFrac(oversizeFrameRatio) * zone[3] - renderedH / 2);
  } else if (wideZone) {
    // Pravé zarovnanie k hrane zóny (subjekt pri textovom paneli, rozplýva
    // sa smerom k nemu), zvisle na strede — namerané na 0:21.
    rect.x = Math.round(zone[2] - renderedW);
    rect.y = Math.round((zone[3] - renderedH) / 2);
  } else {
    const ax = alignment && typeof alignment.x === "number" ? alignment.x : 0.5;
    const ay = alignment && typeof alignment.y === "number" ? alignment.y : 0.5;
    rect.x = Math.round((zone[2] - renderedW) * clamp(ax, 0, 1));
    rect.y = Math.round((zone[3] - renderedH) * clamp(ay, 0, 1));
  }
  holder.appendChild(rect);
  return holder;
}

// Krok 4c: namerané priamo z referenčného VIZUAL-KV (d51uxTh8YqPdHujzi1Plt6,
// node 0:40/0:13/0:4 — get_metadata) — Surďov štvorcový KV je vždy VÄČŠÍ
// než šírka frameu, násobok rastie s tým, aký je formát vysoký:
//   1200×1200 (pomer 1,00) → KV 1628×1628 = ×1,357 šírky frameu
//   1200×1628 (pomer 1,357) → KV 1842×1842 = ×1,535 šírky frameu
//   1080×1920 (pomer 1,778) → KV 1686×1686 = ×1,561 šírky frameu
function interpolateMeasured(points, key, x) {
  if (x <= points[0].r) return points[0][key];
  const last = points[points.length - 1];
  if (x >= last.r) return last[key];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    if (x >= a.r && x <= b.r) {
      const t = (x - a.r) / (b.r - a.r);
      return a[key] + (b[key] - a[key]) * t;
    }
  }
  return last[key];
}
const KV_OVERSIZE_POINTS = [
  { r: 1.00, m: 1.357 },
  { r: 1.357, m: 1.535 },
  { r: 1.778, m: 1.561 }
];
function kvOversizeMultiplier(ratioHW) {
  return interpolateMeasured(KV_OVERSIZE_POINTS, "m", ratioHW);
}
// Zvislý stred predimenzovaného KV ako podiel výšky zóny — namerané z tých
// istých troch node-ov (stred VIZUAL-KV, nie jeho horná hrana). Subjekt tak
// ostáva v hornej/strednej tretine namiesto na geometrickom strede.
const KV_VCENTER_POINTS = [
  { r: 1.00, f: 0.417 },
  { r: 1.357, f: 0.423 },
  { r: 1.778, f: 0.298 }
];
function kvVerticalCenterFrac(ratioHW) {
  return interpolateMeasured(KV_VCENTER_POINTS, "f", ratioHW);
}

// TP master: 4000×4000 s dôležitým obsahom v stredových 2000×2000.
// Do obrazovej zóny vkladáme celý master. Centrálne jadro je ochrana proti
// orezu vonkajších okrajov, nie pokyn zväčšiť jadro na celý cieľový formát.
// oversizeFrameRatio (voliteľné): keď je zadané (format.height/format.width
// CELÉHO frameu, nie zóny), použije sa Krok 4c predimenzovanie namiesto
// pôvodného 1,06× cover-presahu. Zámerne len tam, kde zone == celý frame
// (square/portrait volanie) — wide volanie (zone = 75 % šírky sub-zóna)
// tento parameter zatiaľ neposiela, jeho predimenzovanie je samostatné
// kolo (iný pomer KV k zóne, iné referenčné meranie).
function addMasterCoreImage(parent, figmaImage, imageSize, zone, focal, showGuide, oversizeFrameRatio, wideZone) {
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

  let scale, rectX, rectY;
  if (typeof oversizeFrameRatio === "number") {
    scale = (zone[2] / imageSize.width) * kvOversizeMultiplier(oversizeFrameRatio);
  } else if (wideZone) {
    scale = (zone[2] / imageSize.width) * WIDE_KV_ZONE_MULTIPLIER;
  } else {
    // Jemný presah odstráni 1–2 % technický/brandový okraj, ktorý býva
    // súčasťou exportovaného KV. Centrálne 50 % jadro ostáva bezpečné.
    scale = Math.max(
      zone[2] / imageSize.width,
      zone[3] / imageSize.height
    ) * 1.06;
  }
  const renderedW = imageSize.width * scale;
  const renderedH = imageSize.height * scale;
  const rect = figma.createRectangle();
  rect.name = "Master visual — 2000×2000 core";
  rect.resize(renderedW, renderedH);
  rect.fills = [{ type: "IMAGE", imageHash: figmaImage.hash, scaleMode: "FILL" }];
  if (typeof oversizeFrameRatio === "number") {
    // Vodorovne na stred (overené na troch referenčných node-och — KV
    // presahuje frame symetricky na oboch stranách, motív preto pretína
    // obe hrany). Zvisle podľa nameraného zvislého stredu.
    rectX = Math.round((zone[2] - renderedW) / 2);
    rectY = Math.round(kvVerticalCenterFrac(oversizeFrameRatio) * zone[3] - renderedH / 2);
  } else if (wideZone) {
    rectX = Math.round(zone[2] - renderedW);
    rectY = Math.round((zone[3] - renderedH) / 2);
  } else {
    rectX = clamp(zone[2] * 0.5 - clamp(focal.x, 0.25, 0.75) * renderedW, zone[2] - renderedW, 0);
    rectY = clamp(zone[3] * 0.5 - clamp(focal.y, 0.20, 0.75) * renderedH, zone[3] - renderedH, 0);
  }
  rect.x = rectX;
  rect.y = rectY;
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
    (_ratio >= 1.25 ? "wide" : (_ratio <= 0.8 ? "portrait" : "square"));
  const focal = {
    x: typeof layout.crop_anchor_x === "number" ? layout.crop_anchor_x : 0.5,
    y: typeof layout.crop_anchor_y === "number" ? layout.crop_anchor_y
       : (format.width / format.height >= 3 ? 0.28
         : (format.width / format.height >= 1.8 ? 0.36 : 0.5))
  };
  const pad = TB.padding(format.width, format.height);
  frame.fills = [sampledBrandGradient(layout, 1)];

  if (family === "wide") {
    const imageW = Math.round(format.width * 0.75);
    const adaptedWide = !!layout.asset_fallback_kind;
    if (adaptedWide) {
      addProtectedImageFrame(
        frame, figmaImage, imageSize, "Protected single master — wide image zone",
        [0, 0, imageW, format.height], { x: 0, y: 0.5 }, undefined, true
      );
      layout.kv_strategy = "master-protected-single-master";
    } else {
      addMasterCoreImage(frame, figmaImage, imageSize, [0, 0, imageW, format.height], focal, content.showGuides, undefined, true);
    }
    const wideShift = Math.round(format.width * 0.30);
    const panelX = imageW - wideShift;
    // Krok 3 pravidlo 2: panel sa NESMIE stmavovať kvôli kontrastu — bolo
    // tu shadedColor(...,0.64), teda 64 % pôvodného jasu, čo z koralovej
    // robí bahnistú hnedú (viditeľné na 1200×628). Biela CTA/text majú na
    // čistej brandColor dosť kontrastu pre veľký Bold text (WCAG 3 : 1).
    const brand = brandColor(layout);
    noteContrastIfLow(layout, brand, { r: 1, g: 1, b: 1 }, 4.5, "wide_panel_small_text");
    const panelAlpha = scrimAlphaFor(layout);
    const textX = Math.max(cb.x + pad, Math.round(format.width * 0.54));
    const textRight = cb.x + cb.w - pad;
    const textW = Math.max(60, textRight - textX);
    const panel = figma.createRectangle();
    panel.name = "Wide content panel";
    panel.resize(format.width - panelX, format.height);
    panel.x = panelX;
    panel.y = 0;
    const imageBoundaryStop = Math.min(0.99, Math.max(0.01,
      (imageW - panelX) / (format.width - panelX)));
    const textStartStop = Math.min(imageBoundaryStop - 0.01, Math.max(0.01,
      (textX - panelX) / (format.width - panelX)));
    panel.fills = [{
      type: "GRADIENT_LINEAR",
      gradientTransform: [[1, 0, 0], [0, 1, 0]],
      gradientStops: [
        { position: 0, color: { r: brand.r, g: brand.g, b: brand.b, a: 0 } },
        // Plne krycí presne tam, kde začína text (textX), nie o kus ďalej —
        // inak časť headline boxu leží nad ešte priesvitným panelom (P0-8).
        { position: textStartStop,
          color: { r: brand.r, g: brand.g, b: brand.b, a: panelAlpha } },
        // Na konci obrazovej zóny už musí byť plocha úplne krycia. Inak sa
        // presne na imageW objaví viditeľný vertikálny šev medzi obrázkom a
        // doplnenou farbou. Farba ostáva vzorkovaná z konkrétneho KV.
        { position: imageBoundaryStop, color: { r: brand.r, g: brand.g, b: brand.b, a: 1 } },
        { position: 1, color: { r: brand.r, g: brand.g, b: brand.b, a: 1 } }
      ]
    }];
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
    const wGap = Math.round(headlineSize * 0.30);
    const aiRezerva = (content.aiGenerated && layout.show_ai_disclosure !== false)
      ? Math.round(aiNoteFontSize(format) * 2.2) : 0;

    let wCur = cb.y + cb.h - pad - aiRezerva;
    let btnY = 0, subY = 0;
    if (showCta) { btnY = wCur - wBtn.height; wCur = btnY - wGap; }
    // Poistka na veľkosť (P0-9): subheadline sa nekreslí, ak po odpočítaní
    // CTA a AI tagu ostane menej ako 1,6× jeho výšky, alebo je formát
    // pod min(W,H) 400 px.
    const showSub = shouldShowSubheadline(format, layout, wCur - (cb.y + pad));
    const subH = Math.round(TB.subheadline(format.width, format.height) * 1.6);
    if (showSub) { subY = wCur - subH; wCur = subY - Math.round(wGap * 0.6); }
    const hlDost = Math.max(20, wCur - pad);
    const hlH = Math.min(Math.round(headlineSize * 1.15 * 2), hlDost);
    const hlY = wCur - hlH;

    let wideHeadline = placeReserveWide("Headline", content.headline, hlY, hlH,
      headlineSize, { r: 1, g: 1, b: 1 }, "Bold");
    // Jednoriadkový headline nesmie dediť prázdny priestor rezervovaný pre
    // dva riadky. Jeho spodnú hranu ukotvíme k subheadline; pri dlhom texte,
    // ktorý využije celý box, ostáva pôvodná PSD/master-safe geometria.
    if (wideHeadline && showSub) {
      const headlineBottom = subY - Math.round(wGap * 0.6);
      wideHeadline.y = Math.max(cb.y + pad, headlineBottom - wideHeadline.height);
      if (reserve && headlineBottom > logoTop &&
          wideHeadline.width > Math.max(60, textW - reserve) + 1) {
        wideHeadline.remove();
        wideHeadline = addTemplateText(
          frame, "Headline", content.headline,
          [textX, hlY, Math.max(60, textW - reserve), hlH],
          headlineSize, { r: 1, g: 1, b: 1 }, "Bold", "LEFT"
        );
        if (wideHeadline) wideHeadline.y = Math.max(cb.y + pad,
          headlineBottom - wideHeadline.height);
      }
    }

    if (showSub) {
      placeReserveWide("Subheadline", content.subheadline, subY, subH,
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
    const adaptedPortrait = family === "portrait" && !!layout.asset_fallback_kind;
    if (adaptedPortrait) {
      const fittedMasterH = imageSize && imageSize.width
        ? Math.round(format.width * imageSize.height / imageSize.width)
        : Math.round(format.height * 0.62);
      // Keep the square master at full target width. The older 62%-high
      // contain box shrank 4:5 masters and created side bars; cover-cropping
      // the same input made the face unacceptably large. A colour overlay
      // begins inside the lower extension zone and becomes opaque exactly by
      // the image boundary, leaving room for copy without a hard horizontal
      // band.
      const portraitImageH = Math.min(format.height, fittedMasterH);
      addProtectedImageFrame(
        frame, figmaImage, imageSize, "Protected single master — portrait image zone",
        [0, 0, format.width, portraitImageH], { x: 0.5, y: 0 }
      );
      const panelY = Math.min(
        Math.round(format.height * 0.58),
        Math.round(portraitImageH * 0.78)
      );
      const adaptivePanel = figma.createRectangle();
      adaptivePanel.name = "Adaptive portrait content panel";
      adaptivePanel.resize(format.width, format.height - panelY);
      adaptivePanel.x = 0;
      adaptivePanel.y = panelY;
      const boundaryStop = (portraitImageH - panelY) / Math.max(1, format.height - panelY);
      // Krok 3 pravidlo 2: bottomShade=0.46 stmavovalo brand farbu na 46 %
      // jasu kvôli kontrastu (bahnistá hnedá, viditeľná na 960×1200). 1 =
      // shadedColor je no-op, panel dobieha na čistú brandColor. Druhé
      // volanie tejto funkcie (buildCleanImageLayout, riadok ~1365) je mimo
      // Kroku 3 — iný profil (clean_image, bez textu), zámerne nezmenené.
      noteContrastIfLow(layout, brandEdgeColor(layout, "bottom"), { r: 1, g: 1, b: 1 }, 4.5, "portrait_panel_small_text");
      adaptivePanel.fills = [sampledPortraitOverlayGradient(layout, boundaryStop, 1)];
      frame.appendChild(adaptivePanel);
      layout.kv_strategy = "master-protected-single-master";
    } else {
      addMasterCoreImage(frame, figmaImage, imageSize, [0, 0, format.width, format.height], focal, content.showGuides, format.height / format.width);
    }

    const headlineSize = TB.headline(format.width, format.height);
    const subheadlineSize = TB.subheadline(format.width, format.height);
    const gap = Math.round(headlineSize * 0.35);
    const textW = cb.w - pad * 2;
    // Textové boxy sledujú typografiu, nie percento výšky plátna. Percentá
    // vytvárali pri jednom riadku 100+ px prázdne medzery medzi textami.
    const headlineBoxH = Math.round(headlineSize * (family === "portrait" ? 2.25 : 1.25));
    const subheadlineBoxH = Math.round(subheadlineSize * 1.25);
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
    if (showSubheadline) {
      cursorY -= subheadlineBoxH;
      subheadlineY = cursorY;
      cursorY -= gap;
    }
    cursorY -= headlineBoxH;
    const headlineY = cursorY;

    const scrimH = Math.min(format.height, Math.max(
      Math.round(format.height * (family === "portrait" ? 0.52 : 0.62)),
      format.height - headlineY
    ));
    const scrimAlpha = scrimAlphaFor(layout);
    const scrimScale = scrimAlpha / 0.90;
    // Krok 3 pravidlo 1: prechod je brandová farba, nikdy čierna — bola tu
    // natvrdo šedá/čierna (Bottom readability gradient dobiehala na
    // rgba(0,0,0,...)), čo dáva bahnistú hnedú cez koralovú. Pravidlo 2:
    // farba plochy sa NESMIE stmavovať kvôli kontrastu (žiadny shadedColor
    // s faktorom < 1) — biela na koralovej dá ~3,4 : 1, čo stačí pre veľký
    // Bold text (WCAG 3 : 1). Pre malý text (AI tag), kde to nestačí, sa
    // len zapíše validation_warning nižšie — plocha sa kvôli tomu nemení.
    const scrimBrand = brandColor(layout);
    noteContrastIfLow(layout, scrimBrand, { r: 1, g: 1, b: 1 }, 4.5, "scrim_small_text");
    const scrim = figma.createRectangle();
    scrim.name = "Bottom readability gradient";
    scrim.resize(format.width, scrimH);
    scrim.x = 0;
    scrim.y = format.height - scrimH;
    scrim.fills = [{
      type: "GRADIENT_LINEAR",
      gradientTransform: [[0, 1, 0], [1, 0, 0]],
      gradientStops: [
        { position: 0.00, color: { r: scrimBrand.r, g: scrimBrand.g, b: scrimBrand.b, a: 0.00 } },
        { position: 0.15, color: { r: scrimBrand.r, g: scrimBrand.g, b: scrimBrand.b, a: Math.round(0.08 * scrimScale * 100) / 100 } },
        { position: 0.35, color: { r: scrimBrand.r, g: scrimBrand.g, b: scrimBrand.b, a: Math.round(0.28 * scrimScale * 100) / 100 } },
        { position: 0.55, color: { r: scrimBrand.r, g: scrimBrand.g, b: scrimBrand.b, a: Math.round(0.50 * scrimScale * 100) / 100 } },
        { position: 0.78, color: { r: scrimBrand.r, g: scrimBrand.g, b: scrimBrand.b, a: Math.round(0.72 * scrimScale * 100) / 100 } },
        { position: 1.00, color: { r: scrimBrand.r, g: scrimBrand.g, b: scrimBrand.b, a: scrimAlpha } }
      ]
    }];
    frame.appendChild(scrim);
    if (adaptedPortrait) scrim.visible = false;

    const textAlign = (format.height / format.width >= 1.7 && format.width >= 600) ? "CENTER" : "LEFT";
    let headlineNode = placeReserveText(
      "Headline", content.headline, cb.x + pad, headlineY, headlineBoxH,
      headlineSize, { r: 1, g: 1, b: 1 }, "Bold", textAlign
    );
    if (headlineNode && showSubheadline) {
      const headlineBottom = subheadlineY - gap;
      headlineNode.y = Math.max(cb.y + pad, headlineBottom - headlineNode.height);
      // Po posunutí bližšie k subheadline môže text vojsť do vertikálnej
      // zóny loga. Vtedy ho prekreslíme do užšieho stĺpca a znovu ukotvíme
      // jeho spodnú hranu — bez kolízie a bez falošnej prázdnej medzery.
      if (logoReserve && headlineBottom > logoTop &&
          headlineNode.width > Math.max(60, textW - logoReserve) + 1) {
        headlineNode.remove();
        headlineNode = addTemplateText(
          frame, "Headline", content.headline,
          [cb.x + pad, headlineY, Math.max(60, textW - logoReserve), headlineBoxH],
          headlineSize, { r: 1, g: 1, b: 1 }, "Bold", textAlign
        );
        if (headlineNode) headlineNode.y = Math.max(cb.y + pad, headlineBottom - headlineNode.height);
      }
    }
    if (headlineNode && family === "portrait") {
      headlineNode.textAlignVertical = "CENTER";
    }
    if (showSubheadline) {
      placeReserveText(
        "Subheadline", content.subheadline, cb.x + pad, subheadlineY, subheadlineBoxH,
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
  const rules = resolveAdformPsdRules(activeTemplate, content, layout);
  if (!rules) {
    buildFullBleedLayout(frame, format, layout, content.headline, figmaImage, figmaLogo);
    return;
  }
  const adaptedPortrait = layout.asset_fallback_kind === "portrait";
  const compactCopy = String(content.headline || "").trim().length <= 22 &&
    !content.badgeText && !content.legalText;

  frame.fills = [sampledBrandGradient(layout, 1)];
  const focal = {
    x: typeof layout.crop_anchor_x === "number" ? layout.crop_anchor_x : 0.5,
    y: typeof layout.crop_anchor_y === "number" ? layout.crop_anchor_y : 0.5
  };
  const adapted = !!layout.asset_fallback_kind;
  if (adapted && activeTemplate === "adform_970x250") {
    addProtectedImageFrame(
      frame, figmaImage, imageSize, "Protected square master — left zone",
      [0, 0, 425, 250], { x: 1, y: 0.5 }
    );
    layout.kv_strategy = "adform-protected-single-master";
  } else if (adaptedPortrait && activeTemplate === "adform_160x600") {
    addProtectedImageFrame(
      frame, figmaImage, imageSize, "Protected square master — top zone",
      [0, 0, 160, 160], { x: 0.5, y: 0 }
    );
    layout.kv_strategy = "adform-protected-single-master";
  } else if (adaptedPortrait && activeTemplate === "adform_300x600") {
    addProtectedImageFrame(
      frame, figmaImage, imageSize, "Protected square master — upper zone",
      [0, 0, 300, 300], { x: 0.5, y: 0 }
    );
    layout.kv_strategy = "adform-protected-single-master";
  } else if (activeTemplate === "adform_970x250") {
    addFocalImageFrame(frame, figmaImage, imageSize, "Key visual crop — left zone", [0, 0, 425, 250], focal, { x: 0.66, y: 0.52 }, 1.02);
  } else if (activeTemplate === "adform_160x600") {
    addFocalImageFrame(frame, figmaImage, imageSize, "Key visual crop — top zone", [0, 0, 160, 330], focal, { x: compactCopy ? 0.68 : 0.62, y: 0.48 }, 1.02);
  } else if (activeTemplate === "adform_300x250") {
    addFocalImageFrame(frame, figmaImage, imageSize, "Key visual crop — full frame", [0, 0, 300, 250], focal, { x: compactCopy ? 0.86 : 0.76, y: 0.52 }, compactCopy ? 1.16 : 1.02);
  } else {
    addFocalImageFrame(frame, figmaImage, imageSize, "Key visual crop — full frame", [0, 0, format.width, format.height], focal, { x: compactCopy ? 0.72 : 0.68, y: 0.40 }, 1.02);
  }

  addAdformBackgroundTreatment(frame, format, rules, activeTemplate, layout);
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
    // P2-6/P2-3 (prenesené z master, commity čo predchádzali dddd21d a
    // dddd21d samotný): PSD-presná farba #DB7B67 (bola tu iná, približná
    // {0.86,0.36,0.29}) + natočenie ≈ −8° s mäkkým tieňom, ktoré tu úplne
    // chýbalo. "Badge outline" sivý rám pod prelepkou NEODSTRAŇUJEM — to je
    // samostatná, tu nezadaná zmena z lokálnej vetvy, mimo rozsahu Kroku 2d.
    const badge = addSolidRect(frame, "Badge / prelepka", b[0], b[1], b[2], b[3], { r: 0.8588, g: 0.4824, b: 0.4039 }, 1);
    badge.cornerRadius = Math.round(Math.min(b[2], b[3]) * 0.18);
    try { badge.rotation = -8; } catch (e) {}
    badge.effects = [{
      type: "DROP_SHADOW",
      color: { r: 0, g: 0, b: 0, a: 0.25 },
      offset: { x: 0, y: 2 },
      radius: 4,
      spread: 0,
      visible: true,
      blendMode: "NORMAL"
    }];
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
