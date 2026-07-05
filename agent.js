// agent.js
const Anthropic = require("@anthropic-ai/sdk");
const FORMATS = require("./formats");

const client = new Anthropic({
  apiKey: (process.env.ANTHROPIC_API_KEY || "").replace(/\s/g, "")
});

const ANTHROPIC_MODEL = "claude-sonnet-4-5";

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isTransientAnthropicError(err) {
  const message = String(err && err.message ? err.message : err).toLowerCase();
  const status = err && (err.status || err.statusCode || err.code);
  const transientStatuses = new Set([408, 429, 500, 502, 503, 504, 529]);

  if (transientStatuses.has(Number(status))) return true;

  return (
    message.includes("premature close") ||
    message.includes("socket hang up") ||
    message.includes("connection terminated") ||
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("etimedout") ||
    message.includes("timeout") ||
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("overloaded") ||
    message.includes("rate limit") ||
    message.includes("529") ||
    message.includes("500") ||
    message.includes("502") ||
    message.includes("503") ||
    message.includes("504")
  );
}

async function createMessageWithRetry(params, label) {
  const maxAttempts = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await client.messages.create(params);
    } catch (err) {
      lastError = err;
      if (!isTransientAnthropicError(err) || attempt === maxAttempts) break;

      const waitMs = 700 * attempt;
      console.warn(`${label} zlyhalo (${attempt}/${maxAttempts}), skusam znova za ${waitMs} ms: ${err.message}`);
      await sleep(waitMs);
    }
  }

  throw new Error(`${label} zlyhalo po ${maxAttempts} pokusoch: ${lastError && lastError.message ? lastError.message : lastError}`);
}

const DEFAULT_VISUAL_RECIPE = {
  visualType: "centered_subject",
  subjectPosition: "center",
  cropMode: "protect_subject",
  smallFormatMode: "brand_panel",
  textMode: "auto",
  logoMode: "auto"
};

function normalizeRecipe(visualRecipe) {
  return { ...DEFAULT_VISUAL_RECIPE, ...(visualRecipe || {}) };
}

function recipeFocalPoint(recipe, visualAnalysis) {
  const positions = {
    center: [0.5, 0.5],
    left: [0.32, 0.5],
    right: [0.68, 0.5],
    top: [0.5, 0.32],
    bottom: [0.5, 0.68]
  };

  const fallback = positions[recipe.subjectPosition] || positions.center;
  return {
    x: visualAnalysis.recommended_focal_x || fallback[0],
    y: visualAnalysis.recommended_focal_y || fallback[1]
  };
}

async function analyzeVisual(imageBase64, mediaType) {
  // Krok 1: Analyzuj vizuál
  const analysis = await createMessageWithRetry({
    model: ANTHROPIC_MODEL,
    max_tokens: 1000,
    messages: [{
      role: "user",
      content: [
        {
          type: "image",
          source: { type: "base64", media_type: mediaType, data: imageBase64 }
        },
        {
          type: "text",
          text: `Analyzuj tento reklamný vizuál. Odpovedz VÝHRADNE v JSON bez akéhokoľvek iného textu:
{
  "subject_position": "kde je hlavný objekt (napr. center, left, right, bottom-right)",
  "focal_point": "čo je najdôležitejší vizuálny prvok",
  "has_text": true,
  "background": "popis pozadia",
  "color_dominant": "dominantná farba pozadia slovom",
  "bg_r": 0.1,
  "bg_g": 0.1,
  "bg_b": 0.3,
  "is_complex_visual": false,
  "safe_to_crop_top": true,
  "safe_to_crop_bottom": true,
  "safe_to_crop_sides": true,
  "recommended_focal_x": 0.5,
  "recommended_focal_y": 0.5
}
bg_r/g/b sú hodnoty 0.0–1.0 dominantnej farby pozadia. is_complex_visual je true ak je vizuál príliš detailný/rušný na použitie v malom priestore (napr. veľa postáv, rušné pozadie).`
        }
      ]
    }]
  }, "Analyza vizualu");

  const text = analysis.content[0].text.trim();
  // Extrahuj JSON aj keby bol obalený v markdown bloku
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Nepodarilo sa parsovať analýzu vizuálu");
  return JSON.parse(jsonMatch[0]);
}

function getLayoutStrategy(format, visualAnalysis, visualRecipe) {
  const recipe = normalizeRecipe(visualRecipe);
  const ratio = format.width / format.height;
  const focal = recipeFocalPoint(recipe, visualAnalysis);
  const focalX = focal.x;
  const focalY = focal.y;
  const protectSubject = recipe.cropMode !== "fill_frame" || recipe.visualType === "product_packshot" || recipe.visualType === "people_face";
  const productLike = recipe.visualType === "product_packshot";
  const typographyLed = recipe.visualType === "typography_led";

  const base = {
    image_fit: "fill",
    photo_width_pct: 100,
    crop_anchor_x: focalX,
    crop_anchor_y: focalY,
    headline_position: "bottom",
    logo_position: "top-left",
    brand_color_pct: 0,
    show_headline: !typographyLed,
    show_logo: !format.noLogo,
    safe_content: null,
    visual_recipe: recipe,
    protect_subject: protectSubject,
    risk_flags: []
  };

  // Logo assety — žiadna fotka, iba logo + farba (transparentné pozadie)
  if (format.id === "google_logo_wide" || format.id === "google_logo_square") {
    return {
      ...base,
      layout_type: "logo_only",
      image_fit: "none",
      photo_width_pct: 0,
      headline_position: "center",
      logo_position: "center",
      brand_color_pct: 0,
      show_headline: false,
      show_logo: true
    };
  }

  // Google RSA a Demand Gen image assety majú byť čisté obrázky bez textu a loga.
  if (format.id.startsWith("google_rsa_") || format.id.startsWith("demandgen_")) {
    return {
      ...base,
      layout_type: "clean_image",
      image_fit: productLike || protectSubject ? "contain" : "fill",
      show_headline: false,
      show_logo: false
    };
  }

  // Performance Max: obrázok môže niesť headline, logo/CTA dopĺňa systém.
  if (format.id.startsWith("pmax_")) {
    return {
      ...base,
      layout_type: "headline_only",
      image_fit: productLike || protectSubject ? "contain" : "fill",
      show_logo: false,
      headline_position: ratio < 0.9 ? "bottom" : "left"
    };
  }

  // Full page brandingy musia rešpektovať webový obsah v strede.
  if (format.id === "markiza_branding_full" || format.id === "joj_branding") {
    return {
      ...base,
      layout_type: "branding_skin",
      image_fit: "fill",
      photo_width_pct: 100,
      headline_position: "sides",
      logo_position: "top-sides",
      safe_content: format.safeZones
    };
  }

  // Samostatné bočné branding plochy: message/logo držať v úzkej safe zóne.
  if (
    format.id === "markiza_branding_side" ||
    format.id === "zenske_branding_side" ||
    format.id === "topky_branding"
  ) {
    return {
      ...base,
      layout_type: "side_safe",
      image_fit: "fill",
      headline_position: "center",
      logo_position: "top",
      safe_content: format.safeZones?.safeInner || { width: Math.min(format.width, 160), height: Math.min(format.height, 600) }
    };
  }

  // Interscrollery z prezentácie majú stredovú čitateľnú zónu a no-go okraje/vrch/spodok.
  if (format.id.includes("interscroller")) {
    return {
      ...base,
      layout_type: "interscroller_safe",
      image_fit: "fill",
      headline_position: "safe-bottom",
      logo_position: format.id === "topky_interscroller" ? "below-top-safe" : "safe-top",
      safe_content: format.safeZones
    };
  }

  if (format.id === "engerio_native") {
    return {
      ...base,
      layout_type: "native_center",
      show_logo: false,
      headline_position: "bottom",
      image_fit: "fill"
    };
  }

  if (format.channel === "E-mail") {
    return {
      ...base,
      layout_type: "email_layout",
      image_fit: "fill",
      headline_position: "below-image",
      logo_position: "top"
    };
  }

  if (format.id === "pinterest_pin") {
    return {
      ...base,
      layout_type: "pinterest_pin",
      headline_position: "bottom",
      logo_position: "top",
      safe_content: { maxTextAreaPct: 30 }
    };
  }

  // 320×50 — žiadna fotka, iba logo + farba + text
  if (format.width === 320 && format.height === 50) {
    return {
      ...base,
      layout_type: "logo_only",
      image_fit: "none",
      photo_width_pct: 0,
      headline_position: "center",
      logo_position: "left",
      brand_color_pct: 100
    };
  }

  // Pri veľmi malých a úzkych banneroch je bezpečnejšie nepoužiť agresívny crop master vizuálu.
  if (format.height <= 100 || (ratio > 4.5 && format.height <= 250)) {
    if (recipe.smallFormatMode === "no_image") {
      return {
        ...base,
        layout_type: "logo_only",
        image_fit: "none",
        photo_width_pct: 0,
        headline_position: "center",
        logo_position: "left",
        brand_color_pct: 100,
        risk_flags: ["small_format_no_image"]
      };
    }

    return {
      ...base,
      layout_type: "strip",
      image_fit: recipe.smallFormatMode === "detail" ? "fill" : "contain",
      photo_width_pct: recipe.smallFormatMode === "detail" ? 28 : 22,
      headline_position: "left",
      logo_position: "left",
      brand_color_pct: 100,
      risk_flags: ["small_format_brand_panel"]
    };
  }

  // Ultra-široký A nízky (ratio > 3.5, height < 300): strip layout
  // — brand farba pozadia, fotka vpravo (contain, max 30%), text+logo vľavo
  if (ratio > 3.5 && format.height < 300) {
    return {
      ...base,
      layout_type: "strip",
      image_fit: protectSubject ? "contain" : "fill",
      photo_width_pct: 30,
      headline_position: "left",
      logo_position: "left",
      brand_color_pct: 100
    };
  }

  // Ultra-široký (ratio > 3.5): split layout — fotka 40% vľavo cropnutá na focal point, zvyšok brandová farba + text
  if (ratio > 3.5) {
    return {
      ...base,
      layout_type: protectSubject ? "strip" : "split",
      image_fit: protectSubject ? "contain" : "fill",
      photo_width_pct: protectSubject ? 32 : 40,
      headline_position: protectSubject ? "left" : "right",
      logo_position: "top-right",
      brand_color_pct: 60
    };
  }

  // Úzky/vysoký (ratio < 0.3): stacked layout — logo hore, foto v strede, text dole
  if (ratio < 0.3) {
    return {
      ...base,
      layout_type: "stacked",
      image_fit: protectSubject ? "contain" : "fill",
      photo_width_pct: 100,
      headline_position: "bottom",
      logo_position: "top",
      brand_color_pct: 0
    };
  }

  // Portrait formáty (ratio 0.3–0.75): full_bleed — FILL mode centruje subjekt, brand overlay dole
  // Blurred_bg sa nepoužíva — funguje len s transparentnými PNG cutoutmi
  if (ratio < 0.75) {
    return {
      ...base,
      layout_type: protectSubject && productLike ? "blurred_bg" : "full_bleed",
      image_fit: protectSubject ? "contain" : "fill",
      photo_width_pct: 100,
      headline_position: "bottom",
      logo_position: "top-left",
      brand_color_pct: 0
    };
  }

  // Štvorce a blízke pomery: full bleed s text overlay dole
  return {
    ...base,
    layout_type: "full_bleed",
    image_fit: protectSubject && productLike ? "contain" : "fill",
    photo_width_pct: 100,
    headline_position: "bottom",
    logo_position: "top-left",
    brand_color_pct: 0
  };
}

async function planLayout(visualAnalysis, format, headline, adType, visualRecipe) {
  // Krok 2: Pre každý formát rozhodni o layoute
  const strategy = getLayoutStrategy(format, visualAnalysis, visualRecipe);

  const plan = await createMessageWithRetry({
    model: ANTHROPIC_MODEL,
    max_tokens: 800,
    messages: [{
      role: "user",
      content: `Si expert na digitálnu reklamu. Máš vizuál s týmito vlastnosťami:
${JSON.stringify(visualAnalysis, null, 2)}

Formát: ${format.name} (${format.width}×${format.height}px, ratio ${format.ratio})
Typ reklamy: ${adType}
Headline: "${headline}"
Safe zóny: ${JSON.stringify(format.safeZones)}
Poznámky: ${format.notes}

Odporúčaná layout stratégia (dodrž ju):
${JSON.stringify(strategy, null, 2)}

Odpovedz VÝHRADNE v JSON bez akéhokoľvek iného textu:
{
  "image_fit": "fill",
  "crop_anchor": "center",
  "crop_anchor_x": ${strategy.crop_anchor_x},
  "crop_anchor_y": ${strategy.crop_anchor_y},
  "layout_type": "${strategy.layout_type}",
  "photo_width_pct": ${strategy.photo_width_pct},
  "headline_position": "${strategy.headline_position}",
  "headline_size_px": 48,
  "logo_position": "${strategy.logo_position}",
  "text_area_height_px": 80,
  "reasoning": "krátke zdôvodnenie"
}`
    }]
  }, `Layout plan pre ${format.name}`);

  const text = plan.content[0].text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`Nepodarilo sa parsovať layout pre ${format.name}`);
  return JSON.parse(jsonMatch[0]);
}

async function processAllFormats(imageBase64, mediaType, headline, adType, visualRecipe) {
  const recipe = normalizeRecipe(visualRecipe);
  console.log("Analyzujem vizuál...");
  const visualAnalysis = await analyzeVisual(imageBase64, mediaType);
  visualAnalysis.recommended_focal_x = recipeFocalPoint(recipe, visualAnalysis).x;
  visualAnalysis.recommended_focal_y = recipeFocalPoint(recipe, visualAnalysis).y;
  visualAnalysis.visual_recipe = recipe;
  console.log("Analýza:", visualAnalysis);

  const relevantFormats = FORMATS.filter(f => f.type.includes(adType));
  console.log(`Relevantných formátov pre "${adType}": ${relevantFormats.length}`);

  const results = relevantFormats.map(format => {
    const strategy = getLayoutStrategy(format, visualAnalysis, recipe);
    const layout = {
      layout_type: strategy.layout_type,
      image_fit: strategy.image_fit,
      crop_anchor_x: strategy.crop_anchor_x,
      crop_anchor_y: strategy.crop_anchor_y,
      photo_width_pct: strategy.photo_width_pct,
      headline_position: strategy.headline_position,
      headline_size_px: Math.min(72, Math.max(10, Math.round(format.height * 0.07))),
      logo_position: strategy.logo_position,
      text_area_height_px: Math.round(format.height * 0.22),
      bg_r: visualAnalysis.bg_r || 0.1,
      bg_g: visualAnalysis.bg_g || 0.1,
      bg_b: visualAnalysis.bg_b || 0.18,
      is_complex_visual: visualAnalysis.is_complex_visual || false,
      show_headline: strategy.show_headline !== false,
      show_logo: strategy.show_logo !== false,
      safe_content: strategy.safe_content || null,
      visual_recipe: recipe,
      protect_subject: strategy.protect_subject || false,
      risk_flags: strategy.risk_flags || []
    };
    return { format, layout, visualAnalysis };
  });

  return results;
}

module.exports = { processAllFormats, getLayoutStrategy };
