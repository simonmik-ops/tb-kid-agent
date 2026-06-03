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

  // Logo assety — žiadna fotka, iba logo + farba (transparentné pozadie)
  if (format.id === "google_logo_wide" || format.id === "google_logo_square") {
    return {
      layout_type: "logo_only",
      image_fit: "none",
      photo_width_pct: 0,
      crop_anchor_x: focalX,
      crop_anchor_y: focalY,
      headline_position: "center",
      logo_position: "center",
      brand_color_pct: 0
    };
  }

  // 320×50 — žiadna fotka, iba logo + farba + text
  if (format.width === 320 && format.height === 50) {
    return {
      layout_type: "logo_only",
      image_fit: "none",
      photo_width_pct: 0,
      crop_anchor_x: focalX,
      crop_anchor_y: focalY,
      headline_position: "center",
      logo_position: "left",
      brand_color_pct: 100
    };
  }

  // Ultra-široký A nízky (ratio > 3.5, height < 300): strip layout
  // — brand farba pozadia, fotka vpravo (contain, max 30%), text+logo vľavo
  if (ratio > 3.5 && format.height < 300) {
    return {
      layout_type: "strip",
      image_fit: "contain",
      photo_width_pct: 30,
      crop_anchor_x: focalX,
      crop_anchor_y: focalY,
      headline_position: "left",
      logo_position: "left",
      brand_color_pct: 100
    };
  }

  // Ultra-široký (ratio > 3.5): split layout — fotka 40% vľavo cropnutá na focal point, zvyšok brandová farba + text
  if (ratio > 3.5) {
    return {
      layout_type: "split",
      image_fit: "fill",
      photo_width_pct: 40,
      crop_anchor_x: focalX,
      crop_anchor_y: focalY,
      headline_position: "right",
      logo_position: "top-right",
      brand_color_pct: 60
    };
  }

  // Úzky/vysoký (ratio < 0.3): stacked layout — logo hore, foto v strede, text dole
  if (ratio < 0.3) {
    return {
      layout_type: "stacked",
      image_fit: "fill",
      photo_width_pct: 100,
      crop_anchor_x: focalX,
      crop_anchor_y: focalY,
      headline_position: "bottom",
      logo_position: "top",
      brand_color_pct: 0
    };
  }

  // Štvorce a blízke pomery: full bleed s text overlay dole
  return {
    layout_type: "full_bleed",
    image_fit: "fill",
    photo_width_pct: 100,
    crop_anchor_x: focalX,
    crop_anchor_y: focalY,
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

  const results = [];

  // Filtruj formáty podľa typu (awareness/hardsell/remarketing)
  const relevantFormats = FORMATS.filter(f => f.type.includes(adType));
  console.log(`Relevantných formátov pre "${adType}": ${relevantFormats.length}`);

  for (const format of relevantFormats) {
    console.log(`Plánujem layout pre: ${format.name}`);
    try {
      const layout = await planLayout(visualAnalysis, format, headline, adType);
      // Vždy nastav layout_type z deterministickej stratégie — Claude ho môže vynechať
      const strategy = getLayoutStrategy(format, visualAnalysis);
      layout.layout_type = strategy.layout_type;
      layout.crop_anchor_x = strategy.crop_anchor_x;
      layout.crop_anchor_y = strategy.crop_anchor_y;
      layout.photo_width_pct = strategy.photo_width_pct;
      // Pre strip: farba pozadia a info o komplexnosti
      if (strategy.layout_type === "strip") {
        layout.bg_r = visualAnalysis.bg_r || 0.1;
        layout.bg_g = visualAnalysis.bg_g || 0.1;
        layout.bg_b = visualAnalysis.bg_b || 0.18;
        layout.is_complex_visual = visualAnalysis.is_complex_visual || false;
      }
      results.push({ format, layout, visualAnalysis });
    } catch (err) {
      console.error(`Chyba pri ${format.name}:`, err.message);
      // Fallback layout
      const fallbackStrategy = getLayoutStrategy(format, visualAnalysis);
      results.push({
        format,
        layout: {
          layout_type: fallbackStrategy.layout_type,
          crop_anchor_x: fallbackStrategy.crop_anchor_x,
          crop_anchor_y: fallbackStrategy.crop_anchor_y,
          photo_width_pct: fallbackStrategy.photo_width_pct,
          image_fit: "fill",
          crop_anchor: "center",
          headline_position: "bottom",
          headline_size_px: Math.min(48, format.height * 0.08),
          logo_position: "top-left",
          text_area_height_px: 60,
          reasoning: "fallback layout"
        },
        visualAnalysis
      });
    }
  }

  return results;
}

module.exports = { processAllFormats, getLayoutStrategy };
