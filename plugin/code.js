// code.js

// Menný priestor pre metadáta na frameoch. Musí zostať stabilný — čítajú
// ho externé nástroje cez getSharedPluginData.
var TB_NS = "tbgen";

var TB = {
  headline: function (W, H) {
    return Math.max(12, Math.round(0.1399 * Math.pow(W, 0.518) * Math.pow(H, 0.364)));
  },
  subheadline: function (W, H) { return Math.max(12, Math.round(TB.headline(W, H) * 0.60)); },
  legal: function (W, H) { return Math.max(12, Math.min(24, Math.round(TB.headline(W, H) * 0.30))); },
  padding: function (W, H) { return Math.max(12, Math.round(0.055 * Math.sqrt(W * H))); },
  logoBox: function (W, H) {
    var ref = [[0.5,0.110],[0.737,0.101],[1.0,0.143],[1.911,0.210],[3.88,0.304]];
    var r = W / H, pct;
    if (r <= ref[0][0]) pct = ref[0][1];
    else if (r >= ref[4][0]) pct = ref[4][1];
    else for (var i = 0; i < 4; i++) {
      if (r >= ref[i][0] && r <= ref[i+1][0]) {
        var t = (Math.log(r)-Math.log(ref[i][0]))/(Math.log(ref[i+1][0])-Math.log(ref[i][0]));
        pct = ref[i][1] + t * (ref[i+1][1] - ref[i][1]); break;
      }
    }
    var h = Math.max(50, Math.min(Math.round(pct * H), Math.round(0.35 * H)));
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
    var h = Math.max(40, Math.round(0.10 * Math.sqrt(W * H)));
    return { height: h, width: Math.round(h * 2.9), fontSize: Math.max(12, Math.round(h * 0.38)),
             radius: Math.max(4, Math.round(h * 0.08)) };
  },
  // Brand farby odčítané z Adform_dievca.psd — jediný zdroj pravdy, nech sa
  // nerozchádzajú hodnoty na viacerých miestach v kóde (P2, BRIEF_OPRAVY_5_8.md).
  color: {
    cta: { r: 0, g: 0.278, b: 0.973 },            // #0047F8 — PSD CTA modrá, sedí
    badge: { r: 0.86, g: 0.48, b: 0.40 },         // #DB7B67 — PSD prelepka (bolo #DB5C4A)
    panel970x250: { r: 0.19, g: 0.26, b: 0.36 },  // #30435C — PSD panel 970×250 (bolo #30455E)
    panel160x600: { r: 0.18, g: 0.16, b: 0.16 }   // #2E2828 — PSD spodný panel 160×600, solid (bolo 94% alfa)
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

// Vinted (potvrdené): 970×250 a 300×600 sú presne tie isté pixelové rozmery
// ako overený Adform_dievca.psd banking layout. Nič v TP/materiáloch
// nehovorí, že Vinted má vlastnú predlohu — toto je vedomá výnimka
// (potvrdená v konverzácii), nie tichý predpoklad podľa zhody rozmerov.
const ADFORM_PSD_ALIASES = {
  vinted_970x250: "adform_970x250",
  vinted_300x600: "adform_300x600"
};

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
    // subheadline:true — nie je viazané na žiadny konkrétny kanál (Markíza/
    // JOJ/Ringier/Ženské weby/Topky/e-mail/Vinted a pod. nemajú v Surďovej
    // referenčnej Figme vlastnú sekciu vôbec), ale dotazník definuje "perex"
    // (podnadpis) ako štandardný typografický prvok s vlastným rezom
    // (Regular/Light) bez kanálovej výnimky — pozri Surdo_odpovede_do_pluginu.md.
    // Skutočné rozhodnutie, či sa zmestí, rieši shouldShowSubheadline()
    // (priestor per formát), nie tento hardcoded flag.
    publisher_branding: { layoutType: null, headline: true, subheadline: true, cta: true, logo: true, ai: true },
    // P0-9b: JOJ/Markíza skin, bočné skyscrapery, interscroller a e-mail —
    // CTA aj AI disclosure zostávajú zapnuté (rovnako ako predtým cez
    // master_safe / publisher_branding fallback — nedropovať, čo tam bolo).
    //
    // NEVYRIEŠENÝ KONFLIKT (subheadline:false u všetkých štyroch nižšie):
    // Surďova referenčná Figma (d51uxTh8YqPdHujzi1Plt6) neobsahuje ŽIADNU
    // sekciu pre tieto kanály — má len META, Google RSA, Google PMax,
    // Google DemandGen a Adform. claude/Plugin_podla_Surdu.md to potvrdzuje:
    // "bežia, ale ešte nemajú Surďov dizajn (jeho Figma ich neobsahovala) →
    // do demo ich zatiaľ nedávať." Takže na rozdiel od publisher_branding
    // (kde dotazník aspoň všeobecne definuje podnadpis ako štandardný
    // prvok) tu nemám ani nepriamy zdroj — nemením, kým nepríde predloha.
    branding_full: { layoutType: "branding_skin", headline: true, subheadline: false, cta: true, logo: true, ai: true },
    branding_side: { layoutType: "side_safe", headline: true, subheadline: false, cta: true, logo: true, ai: true },
    interscroller: { layoutType: "interscroller_safe", headline: true, subheadline: false, cta: true, logo: true, ai: true },
    email: { layoutType: "email_layout", headline: true, subheadline: false, cta: true, logo: true, ai: true }
  };

  let profile = null;

  // 1. format.rules (P1-9 cieľový tvar).
  if (format.rules) {
    if (format.rules.logoOnly) profile = "logo_only";
    else if (format.rules.noText) profile = "clean_image";
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
    // Konflikt medzi Surďovou referenčnou Figmou (headline prítomný) a TP
    // (klientom schválené technické parametre): "obrázky bez textu". TP
    // vyhráva — skutočná dodacia požiadavka pre reálnu kampaň má prednosť
    // pred dizajnovým mockupom. Katalógové formáty majú role priamo vo
    // formats.js — tento fallback sa uplatní len na budúci google_rsa*
    // formát bez explicitného role.
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

// Jas nahraného loga (0 = čierne, 1 = biele). Podľa Surďa sa má verzia
// loga voliť podľa pozadia; keď je nahraná len jedna, aspoň vieme
// rozhodnúť, či pod ňu treba podklad a akej farby.
let LOGO_LUMA = null;

// Jas dolnej časti KV — na rozhodnutie o podklade pod logom.
let KV_LUMA_BOTTOM = null;

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
// max. 40 iterácií. Násobí všetky tri kanály rovnakým faktorom (zachová hue —
// Surďova požiadavka, panel má sledovať farbu vizuálu). Ak sa pomer nedosiahne
// ani pri takmer čiernej/bielej, vráti najlepšiu dosiahnutú hodnotu namiesto
// pádu na natvrdo modrú.
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
// vyšší kontrast — pre miesta, kde plochu meniť nemôžeme (napr. reálna fotka).
function pickTextColor(surface) {
  const white = { r: 1, g: 1, b: 1 }, black = { r: 0, g: 0, b: 0 };
  return contrastRatio(surface, white) >= contrastRatio(surface, black) ? white : black;
}

// P0-16e: QA hlásenie, keď aj po ensureReadableSurface/scrimAlphaFor ostane
// pomer pod minRatio (extrémne sýta farba, ktorá sa nedá stmaviť dosť).
// Plugin nevidí skutočné pixely — kontroluje farby, ktoré sám práve
// vypočítal a nakreslil, nie vyrenderovaný obrázok (TB_QA_SCOPE-štýl medza,
// zapísaná priamo tu, keďže žiadny taký konštant v repe zatiaľ nie je).
// Zapisuje do layout.validation_warnings — rovnaký kanál, aký číta
// addValidationBadge()/createValidationReport() (predtým ho plnil len
// server cez agent.js, takže na Excel ceste bol vždy prázdny).
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

// Veľkosť „AI generované" textu — jednotná pre vykreslenie aj rezervu miesta.
function aiNoteFontSize(format) {
  return Math.round(clamp(Math.min(format.width, format.height) * 0.024, 12, 18));
}

// AI disclosure — jemný, integrovaný text vľavo dole (potvrdené z Figmy).
// Ladený tak, aby pôsobil ako súčasť kompozície: nižšia sýtosť, jemný
// letter-spacing, zarovnaný na rovnaký ľavý okraj ako headline.
function addAiNote(frame, format, contentBox, anchorY, anchorX, farba) {
  const cb = contentBox || { x: 0, y: 0, w: format.width, h: format.height };
  const t = figma.createText();
  t.name = "AI generované";
  t.fontName = FONT;
  t.characters = "✧  " + STYLE.aiTagText;
  t.fontSize = aiNoteFontSize(format);
  // Surď (sekcia 2): farba textu podľa pozadia — platí aj pre AI tag.
  const aiFarba = farba || { r: 1, g: 1, b: 1 };
  const aiJeBiely = (aiFarba.r + aiFarba.g + aiFarba.b) > 2.4;
  t.fills = [{ type: "SOLID", color: aiFarba }];
  t.opacity = 0.80;                       // PSD: vrstva "AI GENEROVANE" má krytie 204/255 = 80 %
  try { t.letterSpacing = { value: -3, unit: "PERCENT" }; } catch (e) {}
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
  // Keď layout pozíciu vypočítal (planBottomStack), je záväzná — heuristika
  // hľadania voľného miesta nižšie sa preskočí, inak by tag odskočil hore
  // a prekryl CTA (namerané na 13 formátoch).
  if (typeof anchorY === "number") {
    t.y = anchorY;
    if (typeof anchorX === "number") t.x = anchorX;
    t.locked = true;
    try {
      if (!aiJeBiely) return;   // tmavý text na svetlom podklade podložku nepotrebuje
      const bp0 = 4;
      const backing0 = figma.createRectangle();
      backing0.name = "AI generované — podložka";
      backing0.resize(t.width + bp0 * 2, t.height + bp0 * 2);
      backing0.x = t.x - bp0;
      backing0.y = t.y - bp0;
      backing0.cornerRadius = 3;
      backing0.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity: 0.45 }];
      backing0.locked = true;
      frame.insertChild(frame.children.indexOf(t), backing0);
    } catch (e) {}
    return;
  }
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

  // Tmavá podložka za textom, nech kontrast obstojí aj na svetlom KV
  // (bez nej sme namerali priemerne 2,90 : 1 naprieč formátmi).
  try {
    if (!aiJeBiely) return;
    const bp = 4;
    const backing = figma.createRectangle();
    backing.name = "AI generované — podložka";
    backing.resize(t.width + bp * 2, t.height + bp * 2);
    backing.x = t.x - bp;
    backing.y = t.y - bp;
    backing.cornerRadius = 3;
    backing.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity: 0.45 }];
    backing.locked = true;
    frame.insertChild(frame.children.indexOf(t), backing);
  } catch (e) {}
}

async function createAllFrames({
  formats, headline, subheadline, ctaText, legalText, badgeText, adType,
  imageBytes, kvSquareBytes, kvPortraitBytes, kvLandscapeBytes,
  logoBytes, visualRecipe, tagging, showGuides, aiGenerated, kvBg, kvLumaBottom, kvEdges, logoLuma
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

  // Surď (dotazník, sekcia 1): „Video formáty (TikTok, Reels, Meta video)
  // → úplne vynechať z generovania." Statický placeholder namiesto videa
  // nikto nepoužije a v sade pôsobí ako chyba.
  {
    const predTym = formats.length;
    formats = formats.filter(item => {
      const f = item.format || {};
      const id = String(f.id || "");
      const lt = (item.layout && item.layout.layout_type) || "";
      return !(/tiktok|reels|_video/.test(id) || lt === "video_placeholder");
    });
    const vynechane = predTym - formats.length;
    if (vynechane > 0) {
      try { figma.ui.postMessage({ type: "info", message: "Vynechané video formáty: " + vynechane }); } catch (e) {}
    }
  }

  const campaignTag = tagging || "kid-062026";
  const guides = showGuides !== false;
  const aiNote = aiGenerated === true; // AI disclosure len keď je vizuál AI-generovaný
  AI_ON = aiNote;
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
  LOGO_LUMA = (typeof logoLuma === "number") ? logoLuma : null;
  KV_LUMA_BOTTOM = (typeof kvLumaBottom === "number") ? kvLumaBottom : null;

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
      const hasLocalAdformTemplate = LOCAL_ADFORM_PSD_IDS.indexOf(format.id) !== -1 ||
        ADFORM_PSD_ALIASES.hasOwnProperty(format.id);
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
      if (kvEdges && !layout.kv_edges) layout.kv_edges = kvEdges;

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
      frame.name = format.name + variantName + sideName + " \u2014 " + adType.toUpperCase() + " [" + campaignTag + "]";
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
        // Surď (dotazník, sekcia 1): „Blurred background NIKDY."
        // Necháme padnúť na full_bleed; buildBlurredBgLayout zostáva v kóde
        // len ako mŕtvy kód pre prípad, že by sa pravidlo zmenilo.
        buildFullBleedLayout(frame, format, layout, hl, figmaImage, figmaLogo);
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
        }, figmaImage, curImgSize, figmaLogo);
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

      if (addRiskFlagBadge(frame, format, layout.risk_flags)) riskFlaggedCount++;

      if (guides) {
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

// Frame samotný zostáva čistý (bez orámovania/bannera) — je to produkčný
// výstup, nie interný QA nástroj. Odhad neistoty ide už len do
// "Validation report" stránky (createValidationReport), spolu s
// validation_warnings. Vracia true, ak bol frame označený, aby vedela
// zratať count na summary hlásenie.
function addRiskFlagBadge(frame, format, flags) {
  return !!(flags && flags.length);
}

function createValidationReport(formats, headline, adType) {
  const rows = [];
  for (const item of formats) {
    const warnings = [
      ...((item.layout && item.layout.validation_warnings) || []),
      ...((item.layout && item.layout.risk_flags) || [])
    ];
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
  return warnings.map(w => {
    // low_contrast_<miesto>_<pomer>_to_1 — dynamický kód z noteContrastIfLow().
    const m = /^low_contrast_(.+)_(\d)_(\d)_to_1$/.exec(w);
    if (m) return "Kontrast pod 4,5 : 1 (" + m[1].replace(/_/g, " ") + ", namerané " + m[2] + "." + m[3] + " : 1).";
    return labels[w] || RISK_FLAG_LABELS[w] || w;
  }).join(" ");
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
// naRusivom = logo leží na fotke (default). false = leží na plnej brand
// ploche, kde podklad netreba.
function placeLogo(frame, figmaLogo, x, y, w, h, naRusivom) {
  if (!figmaLogo) return;
  // min. veľkosť loga 50 px (dotazník) — proporčne dorovnaj
  // Minimum 50 px platí pre MENŠÍ rozmer, nie len pre šírku. Bočné pásy
  // a interscrollery posielajú boxy typu 119×34 — tam bola kontrola na
  // šírku splnená, ale reálne viditeľné logo malo 34 px (pri scaleMode
  // FIT určuje veľkosť značky práve menší rozmer).
  const _mensi = Math.min(w, h);
  if (_mensi < STYLE.minLogoPx) {
    const k = STYLE.minLogoPx / _mensi;
    w = Math.round(w * k); h = Math.round(h * k);
    // Nesmie pretiecť frame — keď sa nezmestí, dorovnaj späť.
    if (frame && frame.width && frame.height) {
      const kMax = Math.min(1, (frame.width - x) / w, (frame.height - y) / h);
      if (kMax < 1) { w = Math.round(w * kMax); h = Math.round(h * kMax); }
    }
  }

  // Podklad pod logom sa NEKRESLÍ.
  //
  // Surď má v dotazníku „pod logom na rušivom pozadí jemný gradient
  // podklad", ale radiálny gradient vyzeral ako reflektor/žiara okolo
  // značky — v sade to pôsobilo ako chyba. Dodávaný lockup má navyše
  // vlastný biely rám, takže podklad nepotrebuje.
  //
  // Čitateľnosť loga sa rieši správnou VERZIOU loga (biela na tmavom,
  // tmavá na svetlom) — to je Surďovo primárne pravidlo. Keď je nahraná
  // verzia, ktorá sa na podklad nehodí, upozorníme na to v UI namiesto
  // kreslenia žiary.
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

// Porovnanie textov bez ohľadu na diakritiku okolo medzier a veľkosť písmen.
function jeRovnakyText(a, b) {
  if (!a || !b) return false;
  const n = function (x) { return String(x).replace(/\s+/g, " ").trim().toLowerCase(); };
  return n(a) === n(b);
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
function shouldShowSubheadline(format, layout, availableHeight, headline, subheadline) {
  if (layout && layout.show_subheadline === false) return false;
  // Keď je podnadpis rovnaký ako headline, nekreslí sa — dva rovnaké
  // riadky nad sebou vyzerajú ako chyba sadzby.
  if (jeRovnakyText(headline, subheadline)) return false;
  // Predtým tu bol pevný prah: min(šírka, výška) < 400 px → žiadny
  // podnadpis. Ten vypínal podnadpis na VÄČŠINE bannerových formátov
  // (300×250, 300×600, 160×600, 320×600…), takže používateľ ho zadal a
  // vo výstupe nebol. Rozhoduje teraz len to, či naň reálne ostane
  // miesto — a či sa zmestí aspoň na minimálnej veľkosti písma.
  if (typeof availableHeight === "number") {
    const potrebne = Math.max(STYLE.minTextPx, TB.subheadline(format.width, format.height)) * 1.5;
    if (availableHeight < potrebne) return false;
  }
  return true;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// Krytie scrimu/panelu odvodené z priemernej luminancie dolných 40 % KV
// (layout.kv_luma_bottom, poslané z ui.html cez <canvas>+getImageData).
//
// POZOR na SMER (oprava regresie z P0-7): text je BIELY, takže SVETLÝ KV
// potrebuje VIAC krytia, nie menej. P0-7 mal vzťah obrátený
// (0,35 + (1−luma)·0,55) a na svetlom KV klesol na 35 % — headline potom
// vychádzal na kontraste 1,8–2,9 : 1, teda prakticky nečitateľný.
//
// Biely text na podklade s luminanciou L pod čiernym scrimom s krytím a:
//   kontrast = 1,05 / (L·(1−a) + 0,05)
// Pre AA (4,5 : 1) musí platiť L·(1−a) ≤ 0,183 — na svetlom KV (L≈0,75)
// to znamená a ≥ 0,76.
//
// Pôvodný dôvod P0-7 (svetlý koralový KV sa v dolnej tretine prepaľoval
// do hneda) sa nerieši znížením krytia, ale KRATŠÍM scrimom — pozri
// scrimTop/scrimH v buildMasterSafeLayout: gradient kryje len pás okolo
// textu, nie plošne dolných 62 % vizuálu.
// Surď (dotazník, sekcia 2): „Farba textu PODĽA POZADIA (nie vždy biela)."
// Keď text leží na plnej brand ploche (contain doplnil farbu a scrim sa
// nekreslí), biely text na svetlom koralovom podklade nie je čitateľný.
// Vráti bielu na tmavom podklade a tmavú brand modrú na svetlom.
function textNaPodklade(farba) {
  const kanal = function (c) {
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * kanal(farba.r) + 0.7152 * kanal(farba.g) + 0.0722 * kanal(farba.b);
  // kontrast bielej voči podkladu vs. kontrast tmavej brand modrej
  const kBiela = 1.05 / (L + 0.05);
  const tmava = { r: 0.04, g: 0.10, b: 0.24 };
  const Lt = 0.2126 * kanal(tmava.r) + 0.7152 * kanal(tmava.g) + 0.0722 * kanal(tmava.b);
  const kTmava = (L + 0.05) / (Lt + 0.05);
  return kTmava > kBiela ? tmava : { r: 1, g: 1, b: 1 };
}

function scrimAlphaFor(layout) {
  const luma = (layout && typeof layout.kv_luma_bottom === "number") ? layout.kv_luma_bottom : 1;
  return clamp(0.50 + luma * 0.40, 0.50, 0.90);
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
  addImageRect(frame, figmaImage, "Image asset - no text / no logo", 0, 0, format.width, format.height, layout.image_fit === "contain" ? "FIT" : "FILL");
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
  const logoH = 58;
  const logoW = Math.min(Math.round(logoH * 3.5), sideW - pad * 2);

  if (shouldShowLogo(format, layout, figmaLogo)) {
    placeLogo(frame, figmaLogo, pad, 48, logoW, logoH);
    placeLogo(frame, figmaLogo, format.width - sideW + pad, 48, logoW, logoH);
  }

  const headlineY = topOffset + 80;
  if (shouldShowHeadline(layout, headline)) {
    const fontSize = 42;
    const blokH = 260 + (layout.show_cta !== false && ctaText ? 54 + 24 : 0);
    // Čitateľnostná podložka za textovým blokom v oboch bočných stĺpcoch.
    // Celoplošné "Dim brand background" na 0,34 nestačí — biely headline
    // na svetlom KV vychádzal na 2,9 : 1.
    [pad, format.width - sideW + pad].forEach(function (stlpecX) {
      addSolidRect(
        frame, "Readability panel", stlpecX - Math.round(pad * 0.5), headlineY - Math.round(pad * 0.7),
        sideW - pad, blokH + pad, BRAND_COLOR, 0.82
      );
    });
    addTemplateText(frame, "Headline", headline,
      [pad, headlineY, sideW - pad * 2, 260], fontSize, { r: 1, g: 1, b: 1 }, "Bold", "LEFT");
    addTemplateText(frame, "Headline", headline,
      [format.width - sideW + pad, headlineY, sideW - pad * 2, 260], fontSize, { r: 1, g: 1, b: 1 }, "Bold", "LEFT");
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

  const isJoj = format.id === "joj_branding";
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
  addImageRect(frame, figmaImage, "Background image", 0, 0, format.width, format.height, "FILL");
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

function buildInterscrollerSafeLayout(frame, format, layout, headline, ctaText, figmaImage, figmaLogo) {
  frame.fills = [{ type: "SOLID", color: { r: layout.bg_r || 0.05, g: layout.bg_g || 0.07, b: layout.bg_b || 0.16 } }];
  addImageRect(frame, figmaImage, "Image background", 0, 0, format.width, format.height, "FILL");

  const safe = getInterscrollerSafeBox(format);
  const pad = Math.round(clamp(Math.min(safe.w, safe.h) * 0.06, 20, 54));
  const panelH = Math.round(clamp(safe.h * 0.24, 140, 330));
  const panelY = safe.y + safe.h - panelH - pad;
  addSolidRect(frame, "Readable message panel", safe.x + pad, panelY, safe.w - pad * 2, panelH, BRAND_COLOR, 0.90);

  if (shouldShowLogo(format, layout, figmaLogo)) {
    const logoH = Math.round(clamp(safe.h * 0.045, 34, 70));
    const logoW = Math.min(Math.round(logoH * 3.5), safe.w - pad * 2);
    placeLogo(frame, figmaLogo, safe.x + pad, safe.y + pad, logoW, logoH);
  }

  // CTA v spodnej časti panelu — rovnaký button ako master_safe/PSD
  // ("CTA bottom-left" v PSD referencii pre 300×600). Rezervované miesto
  // sa odráta od výšky headlinu, nech nekolidujú.
  const showCta = layout.show_cta !== false && !!ctaText;
  let ctaBudget = 0;
  if (showCta) {
    const btnH = Math.round(clamp(panelH * 0.22, 32, 56));
    const btnW = Math.max(88, Math.round((safe.w - pad * 3.1) * 0.55));
    const btnX = safe.x + pad * 1.55;
    const btnY = panelY + panelH - pad - btnH;
    addMasterCta(frame, ctaText, btnX, btnY, btnW, btnH);
    ctaBudget = btnH + Math.round(pad * 0.6);
  }

  if (shouldShowHeadline(layout, headline)) {
    const fontSize = Math.round(clamp(panelH * 0.20, 24, 58));
    // addTemplateText (nie addText) — vie font automaticky zmenšiť, aby sa
    // headline zmestil do panelu. S addText dlhý headline pretiekol panel
    // a prekryl CTA (namerané na interscrolleroch pravda/nmh/hnonline).
    addTemplateText(
      frame, "Headline", headline,
      [safe.x + pad * 1.55, panelY + pad, safe.w - pad * 3.1, panelH - pad * 2 - ctaBudget],
      fontSize, { r: 1, g: 1, b: 1 }, "Bold", "LEFT"
    );
  }
}

function buildNativeCenterLayout(frame, format, layout, headline, figmaImage) {
  frame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  const pad = Math.round(format.width * 0.06);
  const imageH = Math.round(format.height * 0.70);
  addImageRect(frame, figmaImage, "Native image 4:3", pad, pad, format.width - pad * 2, imageH - pad, "FILL");

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
  const showCta = layout.show_cta !== false && !!ctaText;
  const showsLogo = shouldShowLogo(format, layout, figmaLogo);

  const logoH = Math.round(clamp(format.width * 0.08, 38, 62));
  const logoW = Math.round(logoH * 3.5);
  const btnH = showCta ? Math.round(clamp(format.width * 0.09, 36, 56)) : 0;
  const btnW = showCta ? Math.max(120, Math.round(format.width * 0.30)) : 0;

  // Content area sa skladá ZDOLA: CTA na spodku, headline nad ním,
  // logo nad headlineom — ale len ak naň ostane miesto. Predtým sa logo
  // kreslilo vždy hore a headline sa pri nedostatku miesta prepadol
  // pod tlačidlo (namerané na azet_dm 640×500).
  const hornaHrana = heroH + pad;
  const btnY = format.height - pad - btnH;
  const podHeadlinom = showCta ? (btnY - Math.round(pad * 0.5)) : (format.height - pad);
  const fontSize = Math.round(clamp(format.width * 0.055, 28, 44));
  const minHeadline = Math.round(fontSize * 1.25);

  // Zmestí sa logo nad headline?
  const logoVlastnyRiadok = showsLogo &&
    (podHeadlinom - hornaHrana - logoH - Math.round(pad * 0.6)) >= minHeadline;

  let textY = hornaHrana;
  if (logoVlastnyRiadok) {
    placeLogo(frame, figmaLogo, pad, hornaHrana, logoW, logoH, false);
    textY = hornaHrana + logoH + Math.round(pad * 0.6);
  }

  if (shouldShowHeadline(layout, headline)) {
    const vyska = Math.max(minHeadline, podHeadlinom - textY);
    // Keď je logo vedľa CTA, headline si nechá miesto vpravo pre logo.
    const sirka = format.width - pad * 2;
    addTemplateText(frame, "Headline", headline,
      [pad, textY, sirka, vyska], fontSize, BRAND_COLOR, "Bold", "LEFT");
  }

  if (showCta) addMasterCta(frame, ctaText, pad, btnY, btnW, btnH);

  // Logo, ktoré sa nezmestilo nad headline, ide vpravo dole vedľa CTA —
  // to je aj Surďova default pozícia („logo vpravo dole").
  if (showsLogo && !logoVlastnyRiadok) {
    const lw = Math.min(logoW, format.width - pad * 2 - btnW - Math.round(pad * 0.6));
    const lh = Math.round(lw / 3.5);
    if (lw >= 50) {
      placeLogo(frame, figmaLogo, format.width - pad - lw,
        (showCta ? btnY + Math.round((btnH - lh) / 2) : format.height - pad - lh), lw, lh, false);
    }
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
// Súradnice aj veľkosti písma sú odčítané priamo z Adform_dievca.psd.
// PSD je pre tieto štyri formáty ZDROJ PRAVDY a má prednosť pred
// všeobecným minimom 12 px zo štýlového dotazníka (STYLE.minTextPx).
// Legal 7 px, badge 8 px a AI tag 9 px nie sú chyba — tak sú v PSD
// a do 300×250 sa 12 px legal ani zmestiť nemôže.
// Minimum 12 px platí pre GENEROVANÉ layouty (master_safe a spol.),
// kde rozmery určuje plugin, nie predloha.
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
    if (style !== "Regular" && style !== "Light") {
      txt.lineHeight = { value: 100, unit: "PERCENT" };
      txt.letterSpacing = { value: -2, unit: "PERCENT" };
    }
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

// Skutočná výška textu po zalomení do danej šírky. Potrebné preto, aby si
// layout vedel dopredu vyhradiť miesto na legal a AI disclosure — inak
// sa kreslili do 1-riadkového boxu naslepo a pri zalomení pretiekli
// mimo frame (legal chýbal na 16 formátoch).
function measureWrappedHeight(frame, value, boxW, fontSize, style) {
  if (!value || !boxW || boxW <= 0) return 0;
  try {
    const m = figma.createText();
    m.fontName = style === "Regular" ? FONT_REGULAR : (style === "Light" ? FONT_LIGHT : FONT);
    m.characters = String(value);
    m.fontSize = fontSize;
    m.resize(boxW, 10);
    m.textAutoResize = "HEIGHT";
    frame.appendChild(m);
    const h = Math.ceil(m.height);
    m.remove();
    return h || Math.round(fontSize * 1.6);
  } catch (e) {
    return Math.round(fontSize * 1.6);
  }
}

// Spodný pás master_safe layoutu: legal (úplne dole) + AI disclosure nad
// ním. Obe sú povinné prvky, takže sa merajú DOPREDU a ich celková výška
// sa odpočíta z priestoru pre headline/subheadline/CTA.
// stlpec = { x, w } textového stĺpca. Pri wide layoute je text v pravom
// paneli, takže legal aj AI musia ísť tam — nie na ľavý okraj cez fotku.
function planBottomStack(frame, format, layout, content, cb, pad, stlpec) {
  const out = { legalH: 0, legalSize: 0, legalY: 0, aiH: 0, aiY: 0, total: 0, medzera: 0 };
  const spodnyOkraj = Math.max(4, Math.round(pad * 0.25));
  const chceLegal = layout.show_legal !== false && !!content.legalText;
  const chceAi = content.aiGenerated === true && layout.show_ai_disclosure !== false;

  out.x = stlpec ? stlpec.x : (cb.x + pad);
  out.w = stlpec ? stlpec.w : (cb.w - pad * 2);
  if (chceLegal) {
    out.legalSize = TB.legal(format.width, format.height);
    out.legalH = measureWrappedHeight(frame, content.legalText, out.w, out.legalSize, "Regular");
  }
  if (chceAi) out.aiH = Math.round(aiNoteFontSize(format) * 1.35);
  out.medzera = (out.legalH && out.aiH) ? Math.round(aiNoteFontSize(format) * 0.55) : 0;

  out.legalY = cb.y + cb.h - spodnyOkraj - out.legalH;
  out.aiY = out.legalY - out.medzera - out.aiH;
  out.total = (out.legalH ? out.legalH + spodnyOkraj : 0) +
              (out.aiH ? out.aiH + out.medzera : 0);
  return out;
}

// naPaneli = slogan leží na plnej farebnej ploche (brand panel), nie na
// fotke — vtedy podložku NEkresli, bola by z nej len čierna škvrna.
function addSloganLogo(frame, box, naPaneli, farba) {
  if (!box) return;
  // Bez podložky. V PSD (Adform_dievca.psd) leží slogan „Myslite na seba"
  // priamo na vizuáli, žiadny obdĺžnik za ním nie je — pridala som ho
  // kvôli kontrastu a v sade vyzeral ako nalepený tmavý box.
  // Farba podľa podkladu (Surď, sekcia 2), nie natvrdo biela — slogan
  // leží na fotke a na svetlom KV vychádzal na 1,4 : 1.
  const fs = farba || { r: 1, g: 1, b: 1 };
  const slashW = Math.max(10, Math.round(box[2] * 0.20));
  addTemplateText(
    frame, "Myslite na seba symbol", "/", [box[0], box[1], slashW, box[3]],
    Math.round(box[3] * 1.05), fs, "Bold", "CENTER"
  );
  addTemplateText(
    frame, "Myslite na seba", "Myslite\nna seba",
    [box[0] + slashW - 1, box[1], box[2] - slashW + 1, box[3]],
    Math.max(5, Math.round(box[3] * 0.37)),
    fs, "Bold", "LEFT"
  );
}

// P0-12: box pre "Myslite na seba" slogan mimo Adform PSD vetvy, alebo null,
// keď sa zmysluplne nezmestí / nemá byť.
//
// ROZSAH (overené 2026-08-10 proti Surďovej referenčnej Figme
// d51uxTh8YqPdHujzi1Plt6): Meta/RSA/PMax/DemandGen frames v tej Figme
// slogan NEMAJÚ — kontrolované priamo (Meta 1:1, RSA 1200×628, RSA
// 1200×1200), žiadna z nich neobsahuje "Myslite na seba" ani lomku.
// Preto sa táto funkcia z buildMasterSafeLayout volá LEN pre profily bez
// PSD/Figma pokrytia (typicky publisher_branding — Pinterest, Markíza,
// JOJ, Ringier, Ženské weby, Topky, e-mail, Vinted a pod., ktoré v
// referenčnej Figme nemajú vlastnú sekciu vôbec) — volajúci (creativeRule
// gate) rozhoduje PODĽA ROLE, táto funkcia len podľa PRIESTORU.
function sloganBox(format, contentBox, hasLogo) {
  // Mikroformáty (h <= 120, napr. 728×90, 320×50) — slogan sem nedáva
  // zmysel, na takej výške by bol nečitateľný alebo by vytlačil headline.
  if (format.height <= 120) return null;
  const cb = contentBox || { x: 0, y: 0, w: format.width, h: format.height };
  const pad = TB.padding(format.width, format.height);
  // Výška boxu priamo určuje veľkosť textu (addSloganLogo: lomka box[3]*1.05,
  // text box[3]*0.37) — P2-4 dolná hranica 12 px teda vyžaduje box[3] >= 33.
  const h = Math.round(clamp(Math.min(format.width, format.height) * 0.08, 33, 70));
  const w = Math.round(h * 3.75); // pomer z ADFORM_PSD_RULES (75×20 na 300×600)
  // Nezmestí sa čitateľne — nekresli namiesto orezaného/prekrývajúceho sa textu.
  if (w > cb.w - pad * 2 || h > cb.h * 0.25) return null;
  return [cb.x + pad, cb.y + pad, w, h];
}

function addAdformBackgroundTreatment(frame, format, rules, psdId) {
  const id = psdId || format.id;
  if (id === "adform_970x250") {
    // PSD: KV na ľavej strane, pevný modrosivý brand panel vpravo.
    addSolidRect(frame, "Brand panel", 425, 0, 545, 250, TB.color.panel970x250, 1);
    return;
  }
  if (rules.panel) {
    addSolidRect(
      frame, "Dark lower panel",
      rules.panel[0], rules.panel[1], rules.panel[2], rules.panel[3],
      TB.color.panel160x600, 1
    );
    return;
  }

  const gradient = figma.createRectangle();
  gradient.name = id === "adform_300x600" ? "Bottom readability gradient" : "Left readability gradient";
  gradient.resize(format.width, format.height);
  gradient.x = 0;
  gradient.y = 0;
  // POZOR na smer. 300×600 = tmavne smerom DOLE (text je dole).
  // Ostatné = "dark left-side readability treatment" podľa PSD, čiže
  // tmavne smerom DOĽAVA — text (headline, legal, CTA) je vľavo.
  // Predtým tu bola identita [[1,0,0],[0,1,0]], ktorá tmavne doprava,
  // takže celá kopija ležala na svetlej strane vizuálu.
  const jeZhora = id === "adform_300x600";
  gradient.fills = [{
    type: "GRADIENT_LINEAR",
    gradientTransform: jeZhora ? [[0, 1, 0], [1, 0, 0]] : [[1, 0, 0], [0, 1, 0]],
    gradientStops: jeZhora
      ? [
          { position: 0, color: { r: 0.04, g: 0.04, b: 0.05, a: 0.06 } },
          { position: 1, color: { r: 0.04, g: 0.04, b: 0.05, a: 0.84 } }
        ]
      : [
          { position: 0, color: { r: 0.04, g: 0.04, b: 0.05, a: 0.84 } },
          { position: 0.62, color: { r: 0.04, g: 0.04, b: 0.05, a: 0.30 } },
          { position: 1, color: { r: 0.04, g: 0.04, b: 0.05, a: 0.06 } }
        ]
  }];
  frame.appendChild(gradient);
}

function addFocalImageFrame(parent, figmaImage, imageSize, name, zone, focal, desired) {
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

  const scale = Math.max(zone[2] / imageSize.width, zone[3] / imageSize.height);
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
function addMasterCoreImage(parent, figmaImage, imageSize, zone, focal, showGuide, brand) {
  const holder = figma.createFrame();
  holder.name = "TP master — centrálne jadro 50 %";
  holder.resize(zone[2], zone[3]);
  holder.x = zone[0];
  holder.y = zone[1];
  holder.clipsContent = true;
  holder.fills = [];
  parent.appendChild(holder);

  if (!figmaImage || !imageSize || !imageSize.width || !imageSize.height) {
    holder.fills = [{ type: "SOLID", color: brand || BRAND_COLOR }];
    return { holder: holder, obrazokDole: zone[1] + zone[3] };
  }

  // Surďovo pravidlo (commit 9f619e9, 21. 7.): „keď sa subjekt nezmestí →
  // Contain — celý vizuál viditeľný, okraje = brand farba".
  // TP to hovorí rovnako: „The complete master is scaled into the image
  // area (…) never enlarged to fill the complete output."
  //
  // KV od dizajnéra je HOTOVÁ kompozícia (subjekt + kľúčová grafika +
  // brand pozadie). Cover cez ňu reže — na 1080×1920 sa zo štvorcového
  // masteru orezávalo ~43 % šírky a preseklo to grafiku „5 €".
  //
  // Prah 1,35 je Surďovo pôvodné pravidlo z commitu 9f619e9
  // („keď sa subjekt nezmestí → Contain"). Pri prepise na master_safe sa
  // stratilo — ostala len nepoužívaná premenná KV_RATIO. Toto ho obnovuje.
  const zoneRatio = zone[2] / zone[3];
  const kvRatio = imageSize.width / imageSize.height;
  const mismatch = Math.max(kvRatio / zoneRatio, zoneRatio / kvRatio);
  const takmerRovnake = mismatch <= 1.35;
  const coverScale = Math.max(zone[2] / imageSize.width, zone[3] / imageSize.height);
  const containScale = Math.min(zone[2] / imageSize.width, zone[3] / imageSize.height);
  const scale = takmerRovnake ? coverScale : containScale;
  const renderedW = imageSize.width * scale;
  const renderedH = imageSize.height * scale;
  const rect = figma.createRectangle();
  rect.name = "Master visual — 2000×2000 core";
  rect.resize(renderedW, renderedH);
  rect.fills = [{ type: "IMAGE", imageHash: figmaImage.hash, scaleMode: "FILL" }];
  if (takmerRovnake) {
    rect.x = clamp(zone[2] * 0.5 - clamp(focal.x, 0.25, 0.75) * renderedW, zone[2] - renderedW, 0);
    rect.y = clamp(zone[3] * 0.5 - clamp(focal.y, 0.20, 0.75) * renderedH, zone[3] - renderedH, 0);
  } else {
    // Contain: vodorovne na stred, zvisle k hornej hrane — text, CTA,
    // logo a legal sa skladajú zdola, takže spodný brand pás je ich miesto.
    rect.x = Math.round((zone[2] - renderedW) / 2);
    rect.y = renderedH < zone[3] ? 0 : Math.round((zone[3] - renderedH) / 2);
  }
  holder.appendChild(rect);

  // ── Doplnená plocha ─────────────────────────────────────────────────
  // TP: „(the extension zone) ... or A SMOOTH TRANSITION TO ONE COLOUR."
  // Surď: „keď sa subjekt nezmestí → Contain, okraje = BRAND FARBA."
  //
  // Jedna farba, a to tá istá, ktorou sa plní brand panel vo wide
  // formátoch — brandColor(layout), odvodená z KV (kvBg z ui.html).
  // Je overená a používa sa v plugine dávno pred týmito úpravami.
  //
  // Pozn.: skúšali sme dve „chytrejšie" varianty a obe boli horšie:
  //  · vzorkovanie farieb pozdĺž hrany KV (kvEdgeColors) — v ostrej
  //    Figme vracalo čierne plochy, takže doplnená plocha bola čierna
  //  · natiahnutý pás pixelov cez scaleMode "CROP" + imageTransform —
  //    Figma tú maticu interpretuje inak, výsledkom bol zlý výrez
  // Preto tu zámerne zostáva najjednoduchšie riešenie, ktoré funguje.
  if (!takmerRovnake && brand) {
    holder.fills = [{ type: "SOLID", color: brand }];

    // Krátky prechod pri hrane fotky, nech medzi ňou a plochou nie je
    // ostrá linka. Ide z brand farby (priehľadnej pri fotke) do plnej.
    const prechod = function (name, ex, ey, ew, eh, smerVon) {
      if (ew <= 1 || eh <= 1) return;
      const r = figma.createRectangle();
      r.name = name;
      r.resize(ew, eh);
      r.x = ex; r.y = ey;
      r.fills = [{
        type: "GRADIENT_LINEAR",
        gradientTransform: smerVon,
        gradientStops: [
          { position: 0.00, color: { r: brand.r, g: brand.g, b: brand.b, a: 0.00 } },
          { position: 1.00, color: { r: brand.r, g: brand.g, b: brand.b, a: 1.00 } }
        ]
      }];
      holder.insertChild(holder.children.indexOf(rect), r);
    };

    const dolePod = zone[3] - (rect.y + renderedH);
    const horeNad = rect.y;
    const vlavo = rect.x;
    const vpravo = zone[2] - (rect.x + renderedW);
    const pasH = Math.round(Math.min(zone[3] * 0.10, 90));
    const pasW = Math.round(Math.min(zone[2] * 0.10, 90));

    if (dolePod > 1) prechod("Prechod pri hrane — dole",
      0, rect.y + renderedH - 1, zone[2], Math.min(dolePod + 1, pasH), [[0, 1, 0], [1, 0, 0]]);
    if (horeNad > 1) prechod("Prechod pri hrane — hore",
      0, Math.max(0, rect.y - pasH), zone[2], Math.min(horeNad + 1, pasH), [[0, -1, 1], [1, 0, 0]]);
    if (vlavo > 1) prechod("Prechod pri hrane — vľavo",
      Math.max(0, rect.x - pasW), 0, Math.min(vlavo + 1, pasW), zone[3], [[-1, 0, 1], [0, 1, 0]]);
    if (vpravo > 1) prechod("Prechod pri hrane — vpravo",
      rect.x + renderedW - 1, 0, Math.min(vpravo + 1, pasW), zone[3], [[1, 0, 0], [0, 1, 0]]);
  }

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
  // Pozn.: Figma nody nie sú rozšíriteľné, takže vlastnú hodnotu nemožno
  // priradiť na node — vraciame ju v obale. Žiadny volajúci nepotrebuje
  // samotný holder, takže je to bezpečné.
  return { holder: holder, obrazokDole: zone[1] + rect.y + renderedH };
}

function addMasterCta(frame, value, x, y, w, h) {
  if (!value) return;
  const button = addSolidRect(frame, "CTA button", x, y, w, h, TB.color.cta, 1);
  button.cornerRadius = Math.max(2, Math.round(h * 0.08));
  const labelSize = Math.max(12, Math.round(h * 0.36));
  addTemplateText(frame, "CTA text", value + "  ›", [x, y, w, h],
    labelSize, { r: 1, g: 1, b: 1 }, "Bold", "CENTER", "CENTER");
}

// Vypočíta obdĺžnik, do ktorého smie master_safe layout klásť text/logo/AI tag.
// Obrázok (addMasterCoreImage) sa naň neviaže — kreslí sa vždy na celý frame.
function resolveContentBox(format) {
  const W = format.width, H = format.height;
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

  // P0-12: slogan len pre profily BEZ overenej Figma/PSD evidencie proti
  // nemu — meta_full/full_creative/headline_only/native_clean/clean_image/
  // logo_only majú overené referenčné frames (Surďova Figma), kde slogan
  // nie je. Zvyšok (typicky publisher_branding — Pinterest, Markíza, JOJ,
  // Ringier, Ženské weby, Topky, e-mail, Vinted…) nemá v referenčnej Figme
  // vlastnú sekciu vôbec, takže tu je zadanie jediný dostupný zdroj.
  const _sloganExcluded = {
    meta_full: 1, full_creative: 1, headline_only: 1,
    native_clean: 1, clean_image: 1, logo_only: 1
  };
  if (!_sloganExcluded[layout.creative_profile]) {
    const _sBox = sloganBox(format, cb, shouldShowLogo(format, layout, figmaLogo));
    if (_sBox) addSloganLogo(frame, _sBox, false, { r: 1, g: 1, b: 1 });
  }

  // Legal + AI disclosure sa merajú dopredu, nech si pre ne obe vetvy
  // vyhradia miesto a text sa nedostane pod dolnú hranu frameu.
  // Textový stĺpec musí byť známy skôr, než sa naplánuje spodný pás —
  // pri wide layoute sedí text v pravom paneli, takže legal aj AI tag
  // patria tam, nie na ľavý okraj cez fotku.
  const _wideTextX = Math.max(cb.x + pad, Math.round(format.width * 0.54));
  const _wideTextW = Math.max(60, (cb.x + cb.w - pad) - _wideTextX);
  const spodok = planBottomStack(frame, format, layout, content, cb, pad,
    family === "wide" ? { x: _wideTextX, w: _wideTextW } : null);

  // Farba textu sa musí riadiť tým, čo je POD textom naozaj:
  //  · keď sa kreslí scrim, text leží na tmavom → biela
  //  · keď scrim nie je (text sedí na plnej brand ploche po contain),
  //    rozhodne jas tej plochy (Surď: „farba textu podľa pozadia")
  // Nastaví sa nižšie v príslušnej vetve; wide vetva má text na paneli.
  let FARBA_TEXTU = { r: 1, g: 1, b: 1 };

  if (family === "wide") {
    const imageW = Math.round(format.width * 0.75);
    addMasterCoreImage(frame, figmaImage, imageSize, [0, 0, imageW, format.height], focal, content.showGuides, brandColor(layout));
    const wideShift = Math.round(format.width * 0.30);
    const panelX = imageW - wideShift;
    // P0-16b: panel dobieha na brandColor(layout) — pri svetlom pastelovom
    // KV to bola béžová/pastelová plocha pod bielym headlinom (namerané
    // 1,6 : 1). Panel nesie text vždy bielou (FARBA_TEXTU sa vo wide vetve
    // nemení), takže farba, na ktorú dobieha, musí byť voči bielej čitateľná
    // — ensureReadableSurface ju stmaví so zachovaním hue, nezmení ju na inú.
    const brand = ensureReadableSurface(brandColor(layout), { r: 1, g: 1, b: 1 }, 4.5);
    noteContrastIfLow(layout, brand, { r: 1, g: 1, b: 1 }, 4.5, "wide_panel");
    const panelAlpha = scrimAlphaFor(layout);
    const textX = _wideTextX;
    const textRight = cb.x + cb.w - pad;
    const textW = _wideTextW;
    const panel = figma.createRectangle();
    panel.name = "Wide content panel";
    panel.resize(format.width - panelX, format.height);
    panel.x = panelX;
    panel.y = 0;
    panel.fills = [{
      type: "GRADIENT_LINEAR",
      gradientTransform: [[1, 0, 0], [0, 1, 0]],
      gradientStops: [
        { position: 0, color: { r: brand.r, g: brand.g, b: brand.b, a: 0 } },
        // Plne krycí presne tam, kde začína text (textX), nie o kus ďalej —
        // inak časť headline boxu leží nad ešte priesvitným panelom (P0-8).
        { position: Math.min(0.98, (textX - panelX) / (format.width - panelX)),
          color: { r: brand.r, g: brand.g, b: brand.b, a: panelAlpha } },
        { position: 1, color: { r: brand.r, g: brand.g, b: brand.b, a: panelAlpha } }
      ]
    }];
    frame.appendChild(panel);
    const headlineSize = TB.headline(format.width, format.height);
    const wLogo = TB.logoBox(format.width, format.height);
    const wClear = TB.logoClear(format.width, format.height);
    const showsLogo = shouldShowLogo(format, layout, figmaLogo);
    // Dolná hrana pre logo/CTA je NAD spodným pásom (legal + AI), nie na
    // hrane content boxu — inak logo sadne na legal text.
    const wDolnaHrana = cb.y + cb.h - pad - spodok.total;
    const logoTop = showsLogo ? (wDolnaHrana - wLogo.height) : (cb.y + cb.h);
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
    // Rezerva na celý spodný pás (legal + AI), nie len na AI tag.
    const aiRezerva = spodok.total;

    let wCur = cb.y + cb.h - pad - aiRezerva;
    let btnY = 0, subY = 0;
    if (showCta) { btnY = wCur - wBtn.height; wCur = btnY - wGap; }
    // Poistka na veľkosť (P0-9): subheadline sa nekreslí, ak po odpočítaní
    // CTA a AI tagu ostane menej ako 1,6× jeho výšky, alebo je formát
    // pod min(W,H) 400 px.
    const showSub = shouldShowSubheadline(format, layout, wCur - (cb.y + pad), content.headline, content.subheadline);
    const subH = Math.round(TB.subheadline(format.width, format.height) * 1.6);
    if (showSub) { subY = wCur - subH; wCur = subY - Math.round(wGap * 0.6); }
    const hlDost = Math.max(20, wCur - pad);
    const hlH = Math.min(Math.round(headlineSize * 1.15 * 2), hlDost);
    const hlY = wCur - hlH;

    placeReserveWide("Headline", content.headline, hlY, hlH, headlineSize, { r: 1, g: 1, b: 1 }, "Bold");

    if (showSub) {
      placeReserveWide("Subheadline", content.subheadline, subY, subH,
        TB.subheadline(format.width, format.height), { r: 1, g: 1, b: 1 }, "Regular");
    }
    if (showCta) {
      addMasterCta(frame, content.ctaText, textX, btnY,
        Math.max(88, Math.min(wBtn.width, wideWidth(btnY, wBtn.height))), wBtn.height);
    }
    if (showsLogo) {
      // Wide: logo leží na plnom brand paneli, nie na fotke → bez podkladu.
      placeLogo(frame, figmaLogo,
        cb.x + cb.w - pad - wLogo.width, wDolnaHrana - wLogo.height,
        wLogo.width, wLogo.height, false);
    }
  } else {
    const _kvHolder = addMasterCoreImage(frame, figmaImage, imageSize, [0, 0, format.width, format.height], focal, content.showGuides, brandColor(layout));
    const _obrazokDole = (_kvHolder && typeof _kvHolder.obrazokDole === "number")
      ? _kvHolder.obrazokDole : format.height;

    const headlineSize = TB.headline(format.width, format.height);
    const subheadlineSize = TB.subheadline(format.width, format.height);
    const gap = Math.round(headlineSize * 0.35);
    const textW = cb.w - pad * 2;
    const headlineBoxH = Math.round(format.height * 0.13);
    const subheadlineBoxH = Math.round(format.height * 0.09);
    const btn = TB.button(format.width, format.height);
    const logo = TB.logoBox(format.width, format.height);
    const logoClear = TB.logoClear(format.width, format.height);
    const showsLogo = shouldShowLogo(format, layout, figmaLogo);
    const logoOwnRow = showsLogo && (logo.width + logoClear) > textW * 0.5;
    const sDolnaHrana = cb.y + cb.h - pad - spodok.total;
    const logoTop = (showsLogo && !logoOwnRow) ? (sDolnaHrana - logo.height) : (cb.y + cb.h);
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
    // Rezerva na celý spodný pás (legal + AI disclosure), nie len na AI tag —
    // predtým sa legal nepočítal vôbec a pri zalomení pretiekol mimo frame.
    let cursorY = cb.y + cb.h - pad - spodok.total;
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
    const showSubheadline = shouldShowSubheadline(format, layout, cursorY - (cb.y + pad), content.headline, content.subheadline);
    if (showSubheadline) {
      cursorY -= subheadlineBoxH;
      subheadlineY = cursorY;
      cursorY -= gap;
    }
    cursorY -= headlineBoxH;
    const headlineY = cursorY;

    // Scrim musí byť dostatočne krycí UŽ na hornej hrane headlineu, nie až
    // pod ním. Predtým sa začínal presne na headlineY s krytím 0 %, takže
    // headline ležal v úplne priesvitnej časti gradientu (namerané
    // 1,8–2,9 : 1 na svetlom KV).
    //
    // Preto: začni o výšku jedného riadku VYŠŠIE (nábeh) a rampu veď tak,
    // aby na headlineY už bolo ~70 % cieľového krytia. Zároveň scrim
    // nesiaha ďalej ako treba — to je odpoveď na pôvodnú výhradu z P0-7,
    // že plošné krytie dolných 62 % prepaľovalo svetlý KV.
    const scrimHeadroom = Math.round(headlineSize * 1.10);
    const scrimTop = Math.max(0, headlineY - scrimHeadroom);
    const scrimH = Math.min(format.height, format.height - scrimTop);
    // Keď je vizuál vložený cez CONTAIN, text sedí na plnej brand ploche
    // POD obrázkom. Tam scrim nemá čo robiť — len by zbytočne zašpinil
    // čistú farbu (presne to bola výhrada „prepaľuje do hneda"). Kreslí sa
    // len vtedy, keď text naozaj leží na fotke.
    const scrimTreba = scrimTop < (_obrazokDole - 2);
    // Podiel scrimu, ktorý padne nad headline — v ňom musí krytie vyrásť
    // z 0 na ~70 %.
    const rampEnd = clamp(scrimHeadroom / Math.max(1, scrimH), 0.06, 0.45);
    const scrimAlpha = scrimAlphaFor(layout);
    const scrim = figma.createRectangle();
    scrim.name = "Bottom readability gradient";
    scrim.resize(format.width, scrimH);
    scrim.x = 0;
    scrim.y = scrimTop;
    const _a = function (podiel) { return Math.round(scrimAlpha * podiel * 100) / 100; };
    scrim.fills = [{
      type: "GRADIENT_LINEAR",
      gradientTransform: [[0, 1, 0], [1, 0, 0]],
      gradientStops: [
        { position: 0.00, color: { r: 0.10, g: 0.10, b: 0.10, a: 0.00 } },
        { position: rampEnd * 0.5, color: { r: 0.08, g: 0.08, b: 0.08, a: _a(0.34) } },
        { position: rampEnd, color: { r: 0.05, g: 0.05, b: 0.05, a: _a(0.70) } },
        { position: rampEnd + (1 - rampEnd) * 0.35, color: { r: 0.03, g: 0.03, b: 0.03, a: _a(0.88) } },
        { position: 1.00, color: { r: 0.00, g: 0.00, b: 0.00, a: scrimAlpha } }
      ]
    }];
    // POZOR: vytvorený node bez rodiča Figma položí na aktuálnu STRÁNKU.
    // Preto sa nepoužitý scrim musí explicitne odstrániť, inak zostanú
    // na page osirelé obdĺžniky.
    if (scrimTreba) {
      frame.appendChild(scrim);
    } else {
      try { scrim.remove(); } catch (e) {}
    }

    // Centrovanie headlinu je podľa TP správne len tam, kde pod ním nič
    // ľavo-zarovnané nestojí (Google 900×1600 — CTA aj lockup dodáva systém).
    // Keď formát CTA má, tá je vždy vľavo, rovnako logo a AI tag. Centrovaný
    // headline nad ľavým CTA vyzerá ako chyba sadzby — preto sa centruje
    // iba pri formátoch bez CTA.
    const jeVysoky = format.height / format.width >= 1.7 && format.width >= 600;
    const textAlign = (jeVysoky && layout.show_cta === false) ? "CENTER" : "LEFT";
    // Keď scrim nie je (text sedí na plnej brand ploche), farbu textu urči
    // podľa jasu tej plochy — inak biely text na svetlom korale nie je vidieť.
    FARBA_TEXTU = scrimTreba ? { r: 1, g: 1, b: 1 } : textNaPodklade(brandColor(layout));
    const farbaTextu = FARBA_TEXTU;
    const headlineNode = placeReserveText(
      "Headline", content.headline, cb.x + pad, headlineY, headlineBoxH,
      headlineSize, farbaTextu, "Bold", textAlign
    );
    if (headlineNode && family === "portrait") {
      headlineNode.textAlignVertical = "CENTER";
    }
    if (showSubheadline) {
      placeReserveText(
        "Subheadline", content.subheadline, cb.x + pad, subheadlineY, subheadlineBoxH,
        subheadlineSize, farbaTextu, "Regular", textAlign
      );
    }
    if (layout.show_cta !== false) {
      addMasterCta(frame, content.ctaText, cb.x + pad, btnY, btnW, btn.height);
    }
    if (shouldShowLogo(format, layout, figmaLogo)) {
      const logoX = logoOwnRow
        ? Math.round(cb.x + (cb.w - logo.width) / 2)
        : (cb.x + cb.w - pad - logo.width);
      placeLogo(frame, figmaLogo, logoX, sDolnaHrana - logo.height, logo.width, logo.height);
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
  // Legal na odmeranej výške a zarovnaný na spodok content boxu, AI tag
  // presne nad ním — obe pozície pochádzajú z planBottomStack, takže sedia
  // s rezervou, ktorú si layout vyhradil vyššie.
  // Legal aj AI tag ležia v tej istej ploche ako headline → rovnaká farba.
  // Predtým sa tu farba počítala z brand farby aj vtedy, keď text ležal na
  // tmavom scrime — výsledkom bol tmavý text na tmavom (kontrast 1,0 : 1).
  const farbaSpodku = FARBA_TEXTU;
  if (spodok.legalH) {
    addTemplateText(
      frame, "Legal text", content.legalText,
      [spodok.x, spodok.legalY, spodok.w, spodok.legalH],
      spodok.legalSize, farbaSpodku, "Regular", "LEFT"
    );
  }
  // PSD (970×250): AI disclosure je vľavo dole CEZ FOTKU (x=30), aj keď
  // headline a legal sedia v pravom paneli (legal x=618). Surď to hovorí
  // rovnako — „AI-generated tag, pozícia vľavo dole". Preto legal sleduje
  // textový stĺpec, ale AI tag zostáva pri ľavom okraji.
  if (spodok.aiH) {
    const aiX = cb.x + pad;
    const aiY = (spodok.x > cb.x + pad + 2) ? spodok.legalY : spodok.aiY;
    addAiNote(frame, format, cb, aiY, aiX, farbaSpodku);
  }
}

function buildAdformPsdLayout(frame, format, layout, content, figmaImage, imageSize, figmaLogo) {
  // psdId = "za ktorý PSD artboard sa tento formát považuje". Pre Vinted
  // 970×250 / 300×600 je to alias na adform_970x250/adform_300x600 (rovnaké
  // pixelové rozmery, potvrdená výnimka — pozri ADFORM_PSD_ALIASES).
  // format.id ostáva nedotknutý všade inde (názov frame-u, tbFormatId...).
  const psdId = ADFORM_PSD_ALIASES[format.id] || format.id;
  const rules = ADFORM_PSD_RULES[psdId];
  if (!rules) {
    buildFullBleedLayout(frame, format, layout, content.headline, figmaImage, figmaLogo);
    return;
  }

  frame.fills = [{ type: "SOLID", color: brandColor(layout) }];
  const focal = {
    x: typeof layout.crop_anchor_x === "number" ? layout.crop_anchor_x : 0.5,
    y: typeof layout.crop_anchor_y === "number" ? layout.crop_anchor_y : 0.5
  };
  if (psdId === "adform_970x250") {
    addFocalImageFrame(frame, figmaImage, imageSize, "Key visual crop — left zone", [0, 0, 425, 250], focal, { x: 0.66, y: 0.52 });
  } else if (psdId === "adform_160x600") {
    addFocalImageFrame(frame, figmaImage, imageSize, "Key visual crop — top zone", [0, 0, 160, 330], focal, { x: 0.62, y: 0.48 });
  } else if (psdId === "adform_300x250") {
    addFocalImageFrame(frame, figmaImage, imageSize, "Key visual crop — full frame", [0, 0, 300, 250], focal, { x: 0.76, y: 0.52 });
  } else {
    addFocalImageFrame(frame, figmaImage, imageSize, "Key visual crop — full frame", [0, 0, format.width, format.height], focal, { x: 0.68, y: 0.40 });
  }

  addAdformBackgroundTreatment(frame, format, rules, psdId);
  // 970×250 má slogan vpravo hore na plnom brand paneli; 160×600 má
  // spodný panel, ale slogan je hore na fotke → tam podložku treba.
  // Na 970×250 leží slogan na tmavom brand paneli → biela.
  // Inde leží na fotke → farba podľa jasu vizuálu (kvBg z horných rohov,
  // čo je presne oblasť, kde slogan sedí).
  // V PSD je slogan biely vo všetkých štyroch artboardoch a leží buď na
  // tmavom čitateľnostnom prechode (300×250, 300×600), alebo na brand
  // paneli (970×250). Držíme sa predlohy.
  addSloganLogo(frame, rules.slogan, psdId === "adform_970x250", { r: 1, g: 1, b: 1 });

  // Nahraný lockup patrí do veľkého štvorcového brand prvku, nie do horného sloganu.
  if (shouldShowLogo(format, layout, figmaLogo) && rules.bankLogo) {
    placeLogo(
      frame, figmaLogo,
      rules.bankLogo[0], rules.bankLogo[1], rules.bankLogo[2], rules.bankLogo[3]
    );
  }

  if (content.badgeText && rules.badge) {
    const b = rules.badge;
    // Žiadny sivý rám okolo prelepky. V PSD je „prelepka" jeden smart
    // object bez obtiahnutia — pridaný rám vyzeral ako sivá žiara.
    const badge = addSolidRect(frame, "Badge / prelepka", b[0], b[1], b[2], b[3], TB.color.badge, 1);
    badge.cornerRadius = Math.round(Math.min(b[2], b[3]) * 0.18);
    // P2-3: PSD má prelepku natočenú ≈ −8° s mäkkým tieňom (doteraz chýbalo,
    // farba TB.color.badge = #DB7B67 už sedí). Figma rotation je v stupňoch,
    // kladná hodnota = proti smeru hodinových ručičiek, otáča okolo stredu
    // node-u — smer/posun oproti PSD zatiaľ neoverený na živom výstupe.
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
    if (headlineNode && content.subheadline && !jeRovnakyText(content.headline, content.subheadline)) {
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
    const button = addSolidRect(frame, "CTA button", c[0], c[1], c[2], c[3], TB.color.cta, 1);
    button.cornerRadius = Math.round(c[3] * 0.08);
    const ctaText = content.ctaText || STYLE.ctaText;
    addTemplateText(
      frame, "CTA text", ctaText + "  ›", [c[0] + 8, c[1], c[2] - 16, c[3]],
      Math.round(clamp(c[3] * 0.28, 9, 15)),
      { r: 1, g: 1, b: 1 }, "Bold", "CENTER", "CENTER"
    );
  }

  if (content.aiGenerated && rules.ai) {
    const aiNode = addTemplateText(
      frame, "AI generované", "✧  " + STYLE.aiTagText, rules.ai,
      Math.round(clamp(rules.ai[3] * 0.47, 7, 10)),
      { r: 1, g: 1, b: 1 }, "Regular", "LEFT"
    );
    // PSD: vrstva „AI GENEROVANE" má krytie 204/255 = 80 %.
    if (aiNode) aiNode.opacity = 0.80;
  }
}

// Full bleed podľa Surďovej predlohy: KV na celý frame + jemný tmavý gradient
// dole + headline biely vľavo dole (Tatra banka Sans) + logo VPRAVO DOLE.
function buildFullBleedLayout(frame, format, layout, headline, figmaImage, figmaLogo) {
  // Surďovo pravidlo (9f619e9): pri výraznej nezhode pomerov CONTAIN,
  // okraje brand farbou. Rovnaký prah 1,35 ako v addMasterCoreImage.
  if (figmaImage && layout.image_fit !== "contain" && CUR_IMG_W && CUR_IMG_H) {
    const _fr = format.width / format.height;
    const _kv = CUR_IMG_W / CUR_IMG_H;
    if (Math.max(_kv / _fr, _fr / _kv) > 1.35) layout.image_fit = "contain";
  }
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
    // Text/logo sa kotvia na spodok VIZUÁLU (cBottom = dy+dh), takže sadnú
    // na fotku, nie na brand pás okolo nej — ten prípad tu nerieš kontrastom.
    frame.fills = [{ type: "SOLID", color: brandColor(layout) }];
    addImageRect(frame, figmaImage, "KV (contain)", dx, dy, dw, dh, "FILL");
    cTop = dy; cBottom = dy + dh; cLeft = dx; cRight = dx + dw;
  } else if (figmaImage) {
    frame.fills = [{ type: "IMAGE", imageHash: figmaImage.hash, scaleMode: "FILL" }];
  } else {
    // P0-16b: bez obrázka je toto JEDINÁ plocha pod headlineom — biely text
    // priamo na brandColor(layout) (z priemernej farby KV) dával pri
    // svetlom pastelovom KV 1,6 : 1. Stmav so zachovaním hue.
    const noImageBg = ensureReadableSurface(brandColor(layout), { r: 1, g: 1, b: 1 }, 4.5);
    noteContrastIfLow(layout, noImageBg, { r: 1, g: 1, b: 1 }, 4.5, "full_bleed_no_image");
    frame.fills = [{ type: "SOLID", color: noImageBg }];
  }

  const pad = Math.round(clamp(Math.min(format.width, format.height) * STYLE.paddingPct, 10, 60));
  const cW = cRight - cLeft, cH = cBottom - cTop;

  // Jemný tmavý gradient dole — ukotvený na spodok VIZUÁLU (pri contain končí na
  // spodku obrázka, nie frame-u), aby čitateľnosť textu bola presne tam.
  // P0-16c: koncová alfa bola natvrdo STYLE.scrimOpacity (0,55) bez ohľadu na
  // jas KV — na svetlom KV nestačí. scrimAlphaFor() už rieši presne tento
  // výpočet (biely text, čierny scrim, WCAG 4,5 : 1) inde v master_safe;
  // rovnaký vzorec platí tu, len bez layout.kv_luma_bottom defaultuje na
  // najtmavšie krytie (bezpečná strana, rovnako ako predtým).
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
      { position: 1, color: { r: 0, g: 0, b: 0, a: scrimAlphaFor(layout) } }
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
  // Rovnaké argumenty (availableHeight, headline, subheadline) ako pri
  // ostatných volaniach shouldShowSubheadline (P0-21) — predtým tu chýbali,
  // takže táto vetva nemala ani duplicate-text kontrolu, ani skutočný
  // priestorový guard.
  if (SUBHEAD && shouldShowSubheadline(format, layout, bottomY - cTop - pad, headline, SUBHEAD)) {
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

  const pad = Math.max(6, Math.round(format.height * 0.12));
  const hasLogo = shouldShowLogo(format, layout, figmaLogo);
  let contentX = pad;
  if (hasLogo) {
    const logoH = Math.min(format.height - pad * 2, Math.round(format.height * 0.6));
    const logoW = Math.max(50, Math.round(logoH * (255 / 243)));
    placeLogo(frame, figmaLogo, pad, Math.round((format.height - logoH) / 2), logoW, logoH);
    contentX = pad + logoW + Math.round(pad * 0.8);
  }

  // P0-16d: headline box siaha až po format.width - pad (nižšie, availW).
  // Scrim musí ostať krycí PO CELEJ tejto šírke a vyblednúť až ZA ňou —
  // predtým gradient dosiahol alfu 0 presne pri format.width (rovnaká
  // oblasť, kde končí headline box), takže koniec dlhého textu sadal na
  // takmer priehľadný scrim nad svetlou fotkou (namerané na 728×90, 320×50).
  // Plateau alfa je scrimAlphaFor(layout), nie natvrdo 0,66 — to pri
  // naozaj svetlom/bielom KV (luma≈1) dávalo len ~2,7 : 1 (WCAG:
  // 1,05 / (luma·(1−0,66) + 0,05)), zďaleka pod požadovaných 4,5 : 1.
  const textEndX = format.width - pad;
  const fadeStart = Math.min(0.98, textEndX / format.width);
  const plateauAlpha = scrimAlphaFor(layout);
  // Plugin nevidí skutočné pixely KV — použije rovnaký zjednodušený model
  // ako scrimAlphaFor (čierny scrim nad plochou s jasom kv_luma_bottom),
  // nie skutočný obrázok. Chýbajúci kv_luma_bottom defaultuje na 1
  // (najsvetlejšie, najprísnejší prípad) — rovnako ako scrimAlphaFor.
  const _microLuma = (layout && typeof layout.kv_luma_bottom === "number") ? layout.kv_luma_bottom : 1;
  const _microBlend = _microLuma * (1 - plateauAlpha);
  noteContrastIfLow(
    layout, { r: _microBlend, g: _microBlend, b: _microBlend }, { r: 1, g: 1, b: 1 }, 4.5, "micro_scrim"
  );
  const scrim = figma.createRectangle();
  scrim.name = "Left readability scrim";
  scrim.resize(format.width, format.height);
  scrim.x = 0;
  scrim.y = 0;
  scrim.fills = [{
    type: "GRADIENT_LINEAR",
    gradientTransform: [[1, 0, 0], [0, 1, 0]],
    gradientStops: [
      { position: 0.00, color: { r: 0, g: 0, b: 0, a: Math.max(plateauAlpha, 0.78) } },
      { position: fadeStart * 0.70, color: { r: 0, g: 0, b: 0, a: plateauAlpha } },
      // Krycí až sem — teda po celej šírke, kde môže sedieť text — a
      // vyblednutie na 0 nechá až za textEndX, do zvyšného pad-u.
      { position: fadeStart, color: { r: 0, g: 0, b: 0, a: plateauAlpha } },
      { position: 1.00, color: { r: 0, g: 0, b: 0, a: 0.00 } }
    ]
  }];
  frame.appendChild(scrim);

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
  const isGoogleLogo = format.id === "google_logo_square" || format.id === "google_logo_wide";
  frame.fills = isGoogleLogo ? [] : [{ type: "SOLID", color: BRAND_COLOR }];
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
