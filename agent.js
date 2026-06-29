// agent.js
const Anthropic = require("@anthropic-ai/sdk");
const FORMATS = require("./formats");

const client = new Anthropic({
  apiKey: (process.env.ANTHROPIC_API_KEY || "").replace(/\s/g, "")
});

async function analyzeVisual(imageBase64, mediaType) {
  // Krok 1: Analyzuj vizuál
  const analysis = await client.messages.create({
    model: "claude-sonnet-4-5",
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
  });

  const text = analysis.content[0].text.trim();
  // Extrahuj JSON aj keby bol obalený v markdown bloku
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Nepodarilo sa parsovať analýzu vizuálu");
  return JSON.parse(jsonMatch[0]);
}

function getLayoutStrategy(format, visualAnalysis) {
  const ratio = format.width / format.height;
  const focalX = visualAnalysis.recommended_focal_x || 0.5;
  const focalY = visualAnalysis.recommended_focal_y || 0.5;

  const base = {
    image_fit: "fill",
    photo_width_pct: 100,
    crop_anchor_x: focalX,
    crop_anchor_y: focalY,
    headline_position: "bottom",
    logo_position: "top-left",
    brand_color_pct: 0,
    show_headline: true,
    show_logo: !format.noLogo,
    safe_content: null
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
      show_headline: false,
      show_logo: false
    };
  }

  // Performance Max: obrázok môže niesť headline, logo/CTA dopĺňa systém.
  if (format.id.startsWith("pmax_")) {
    return {
      ...base,
      layout_type: "headline_only",
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

  // Ultra-široký A nízky (ratio > 3.5, height < 300): strip layout
  // — brand farba pozadia, fotka vpravo (contain, max 30%), text+logo vľavo
  if (ratio > 3.5 && format.height < 300) {
    return {
      ...base,
      layout_type: "strip",
      image_fit: "contain",
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
      layout_type: "split",
      image_fit: "fill",
      photo_width_pct: 40,
      headline_position: "right",
      logo_position: "top-right",
      brand_color_pct: 60
    };
  }

  // Úzky/vysoký (ratio < 0.3): stacked layout — logo hore, foto v strede, text dole
  if (ratio < 0.3) {
    return {
      ...base,
      layout_type: "stacked",
      image_fit: "fill",
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
      layout_type: "full_bleed",
      image_fit: "fill",
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
    image_fit: "fill",
    photo_width_pct: 100,
    headline_position: "bottom",
    logo_position: "top-left",
    brand_color_pct: 0
  };
}

async function planLayout(visualAnalysis, format, headline, adType) {
  // Krok 2: Pre každý formát rozhodni o layoute
  const strategy = getLayoutStrategy(format, visualAnalysis);

  const plan = await client.messages.create({
    model: "claude-sonnet-4-5",
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
  });

  const text = plan.content[0].text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`Nepodarilo sa parsovať layout pre ${format.name}`);
  return JSON.parse(jsonMatch[0]);
}

async function processAllFormats(imageBase64, mediaType, headline, adType) {
  console.log("Analyzujem vizuál...");
  const visualAnalysis = await analyzeVisual(imageBase64, mediaType);
  console.log("Analýza:", visualAnalysis);

  const relevantFormats = FORMATS.filter(f => f.type.includes(adType));
  console.log(`Relevantných formátov pre "${adType}": ${relevantFormats.length}`);

  const results = relevantFormats.map(format => {
    const strategy = getLayoutStrategy(format, visualAnalysis);
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
      safe_content: strategy.safe_content || null
    };
    return { format, layout, visualAnalysis };
  });

  return results;
}

module.exports = { processAllFormats, getLayoutStrategy };
