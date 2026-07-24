// code.js
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

// AI disclosure — malý text vľavo dole (potvrdené z Figmy)
function addAiNote(frame, format) {
  const t = figma.createText();
  t.name = "AI generované";
  t.fontName = FONT;
  t.characters = STYLE.aiTagText;
  t.fontSize = Math.round(clamp(Math.min(format.width, format.height) * 0.028, 10, 22));
  t.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  t.opacity = 0.9;
  t.textAutoResize = "WIDTH_AND_HEIGHT";
  const pad = Math.round(clamp(Math.min(format.width, format.height) * STYLE.paddingPct, 8, 60));
  frame.appendChild(t);
  t.x = pad;
  t.y = format.height - t.height - Math.round(pad * 0.5);
  t.locked = true;
}

async function createAllFrames({
  formats, headline, subheadline, ctaText, legalText, badgeText, adType,
  imageBytes, logoBytes, visualRecipe, tagging, showGuides, aiGenerated
}) {
  const campaignTag = tagging || "kid-062026";
  // Pomôcky (safe zóny, "Recipe" štítok, "checks" badge, validation report)
  // sa dajú vypnúť pre čistý výstup na prezentáciu / export. Default = zapnuté.
  const guides = showGuides !== false;
  const aiNote = aiGenerated === true; // AI disclosure len keď je vizuál AI-generovaný
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  await figma.loadFontAsync({ family: "Inter", style: "Bold" });
  await resolveBrandFont(); // Tatra banka Sans, fallback Inter

  var figmaImage = null;
  var figmaImageSize = null;
  if (imageBytes && imageBytes.length > 0) {
    figmaImage = figma.createImage(new Uint8Array(imageBytes));
    figmaImageSize = await figmaImage.getSizeAsync();
  }

  var figmaLogo = null;
  if (logoBytes && logoBytes.length > 0) {
    figmaLogo = figma.createImage(new Uint8Array(logoBytes));
  }

  const byChannel = {};
  for (const item of formats) {
    const ch = item.format.channel;
    if (!byChannel[ch]) byChannel[ch] = [];
    byChannel[ch].push(item);
  }

  const allFrames = [];
  const channels = Object.keys(byChannel);

  for (const channel of channels) {
    const items = byChannel[channel];

    let page = Array.from(figma.root.children).find(p => p.name === channel);
    if (!page) {
      page = figma.createPage();
      page.name = channel;
    }

    let xOffset = 0;

    for (const { format, layout } of items) {
      // Lokálny plugin môže testovať PSD šablóny ešte pred nasadením nového
      // backendu na Railway. Starší backend template nepozná, ale stabilné ID áno.
      const hasLocalAdformTemplate = LOCAL_ADFORM_PSD_IDS.indexOf(format.id) !== -1;
      const useMasterSafe = visualRecipe && visualRecipe.masterSafeMode !== false;
      const layoutType = hasLocalAdformTemplate
        ? (useMasterSafe ? "master_safe" : "adform_psd")
        : (layout.layout_type || "full_bleed");
      if (useMasterSafe && hasLocalAdformTemplate) {
        const ratio = format.width / format.height;
        layout.master_family = ratio > 1.45 ? "wide" : (ratio < 0.75 ? "portrait" : "square");
        layout.master_safe_zone = true;
      }

      const frame = figma.createFrame();
      const variantName = format.variantLabel ? " \u2014 " + format.variantLabel : "";
      const sideName = format.variantSide ? " " + format.variantSide.toUpperCase() : "";
      frame.name = format.name + variantName + sideName + " \u2014 " + adType.toUpperCase() + " [" + campaignTag + "]";
      frame.resize(format.width, format.height);
      frame.x = xOffset;
      frame.y = 0;
      frame.clipsContent = true;

      if (layoutType === "video_placeholder") {
        buildVideoPlaceholderLayout(frame, format, layout, headline, figmaImage, figmaLogo);
      } else if (layoutType === "clean_image") {
        buildCleanImageLayout(frame, format, layout, figmaImage);
      } else if (layoutType === "headline_only") {
        buildHeadlineOnlyLayout(frame, format, layout, headline, figmaImage);
      } else if (layoutType === "branding_skin") {
        buildBrandingSkinLayout(frame, format, layout, headline, figmaImage, figmaLogo);
      } else if (layoutType === "side_safe") {
        buildSideSafeLayout(frame, format, layout, headline, figmaImage, figmaLogo);
      } else if (layoutType === "interscroller_safe") {
        buildInterscrollerSafeLayout(frame, format, layout, headline, figmaImage, figmaLogo);
      } else if (layoutType === "native_center") {
        buildNativeCenterLayout(frame, format, layout, headline, figmaImage);
      } else if (layoutType === "email_layout") {
        buildEmailLayout(frame, format, layout, headline, figmaImage, figmaLogo);
      } else if (layoutType === "pinterest_pin") {
        buildPinterestPinLayout(frame, format, layout, headline, figmaImage, figmaLogo);
      } else if (layoutType === "strip") {
        buildStripLayout(frame, format, layout, headline, figmaImage, figmaLogo);
      } else if (layoutType === "split") {
        buildSplitLayout(frame, format, layout, headline, figmaImage, figmaLogo);
      } else if (layoutType === "stacked") {
        buildStackedLayout(frame, format, layout, headline, figmaImage, figmaLogo);
      } else if (layoutType === "blurred_bg") {
        buildBlurredBgLayout(frame, format, layout, headline, figmaImage, figmaLogo);
      } else if (layoutType === "logo_only") {
        buildLogoOnlyLayout(frame, format, layout, headline, figmaLogo);
      } else if (layoutType === "adform_psd") {
        buildAdformPsdLayout(frame, format, layout, {
          headline,
          subheadline,
          ctaText,
          legalText,
          badgeText,
          aiGenerated: aiNote
        }, figmaImage, figmaImageSize, figmaLogo);
      } else if (layoutType === "master_safe") {
        buildMasterSafeLayout(frame, format, layout, {
          headline,
          subheadline,
          ctaText,
          legalText,
          badgeText,
          aiGenerated: aiNote,
          showGuides: guides
        }, figmaImage, figmaImageSize, figmaLogo);
      } else {
        buildFullBleedLayout(frame, format, layout, headline, figmaImage, figmaLogo);
      }

      // AI disclosure (vľavo dole) — mimo logo-only a native formátov
      if (aiNote && layoutType !== "logo_only" && layoutType !== "clean_image" && layoutType !== "adform_psd" && layoutType !== "master_safe") {
        addAiNote(frame, format);
      }

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

  figma.ui.postMessage({ type: "done", formatCount: formats.length, pageCount: channels.length });
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

function shouldShowHeadline(layout, headline) {
  return layout.show_headline !== false && !!headline;
}

function shouldShowLogo(format, layout, figmaLogo) {
  return !!figmaLogo && !format.noLogo && layout.show_logo !== false;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
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
function buildBrandingSkinLayout(frame, format, layout, headline, figmaImage, figmaLogo) {
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

  if (shouldShowHeadline(layout, headline)) {
    const fontSize = 42;
    const y = topOffset + 80;
    addText(frame, headline, pad, y, sideW - pad * 2, 260, fontSize, { r: 1, g: 1, b: 1 });
    addText(frame, headline, format.width - sideW + pad, y, sideW - pad * 2, 260, fontSize, { r: 1, g: 1, b: 1 });
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

function buildSideSafeLayout(frame, format, layout, headline, figmaImage, figmaLogo) {
  frame.fills = [{ type: "SOLID", color: BRAND_COLOR }];
  addImageRect(frame, figmaImage, "Background image", 0, 0, format.width, format.height, "FILL");
  addSolidRect(frame, "Brand overlay", 0, 0, format.width, format.height, BRAND_COLOR, 0.62);

  const safe = layout.safe_content || {};
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

  if (shouldShowHeadline(layout, headline)) {
    const fontSize = Math.round(clamp(contentW * 0.12, 13, 24));
    const textY = y + Math.round(contentH * 0.28);
    addText(frame, headline, x + pad, textY, contentW - pad * 2, contentH - (textY - y) - pad, fontSize, { r: 1, g: 1, b: 1 }, "CENTER");
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

function buildInterscrollerSafeLayout(frame, format, layout, headline, figmaImage, figmaLogo) {
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

  if (shouldShowHeadline(layout, headline)) {
    const fontSize = Math.round(clamp(panelH * 0.20, 24, 58));
    addText(frame, headline, safe.x + pad * 1.55, panelY + pad, safe.w - pad * 3.1, panelH - pad * 2, fontSize, { r: 1, g: 1, b: 1 });
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

function buildEmailLayout(frame, format, layout, headline, figmaImage, figmaLogo) {
  frame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  const heroH = Math.round(format.height * 0.54);
  addImageRect(frame, figmaImage, "Hero image", 0, 0, format.width, heroH, "FILL");
  addSolidRect(frame, "Content area", 0, heroH, format.width, format.height - heroH, { r: 1, g: 1, b: 1 }, 1);

  const pad = Math.round(clamp(format.width * 0.07, 28, 56));
  if (shouldShowLogo(format, layout, figmaLogo)) {
    const logoH = Math.round(clamp(format.width * 0.08, 38, 62));
    placeLogo(frame, figmaLogo, pad, heroH + pad, Math.round(logoH * 3.5), logoH);
  }

  if (shouldShowHeadline(layout, headline)) {
    const fontSize = Math.round(clamp(format.width * 0.055, 28, 44));
    const textY = heroH + pad + Math.round(format.width * 0.13);
    addText(frame, headline, pad, textY, format.width - pad * 2, format.height - textY - pad, fontSize, BRAND_COLOR);
  }
}

function buildPinterestPinLayout(frame, format, layout, headline, figmaImage, figmaLogo) {
  buildCleanImageLayout(frame, format, layout, figmaImage);
  const pad = Math.round(format.width * 0.06);

  if (shouldShowLogo(format, layout, figmaLogo)) {
    const logoH = Math.round(clamp(format.height * 0.045, 46, 72));
    const logoW = Math.round(logoH * 3.5);
    addSolidRect(frame, "Logo contrast", pad - 12, pad - 12, logoW + 24, logoH + 24, BRAND_COLOR, 0.82);
    placeLogo(frame, figmaLogo, pad, pad, logoW, logoH);
  }

  if (shouldShowHeadline(layout, headline)) {
    const textAreaH = Math.round(format.height * 0.24);
    const y = format.height - textAreaH - pad;
    addSolidRect(frame, "Text overlay max 30%", pad, y, format.width - pad * 2, textAreaH, BRAND_COLOR, 0.88);
    const fontSize = Math.round(clamp(format.width * 0.062, 34, 58));
    addText(frame, headline, pad * 1.5, y + pad, format.width - pad * 3, textAreaH - pad * 2, fontSize, { r: 1, g: 1, b: 1 }, "CENTER");
  }
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

function addTemplateText(frame, name, value, box, fontSize, color, style, align) {
  if (!value || !box) return null;
  const txt = figma.createText();
  txt.name = name;
  txt.fontName = style === "Regular" ? FONT_REGULAR : (style === "Light" ? FONT_LIGHT : FONT);
  txt.characters = value;
  txt.fontSize = fontSize;
  txt.fills = [{ type: "SOLID", color: color || { r: 1, g: 1, b: 1 } }];
  txt.textAlignHorizontal = align || "LEFT";
  txt.textAutoResize = "HEIGHT";
  txt.resize(box[2], box[3]);
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

function addAdformBackgroundTreatment(frame, format, rules) {
  if (format.id === "adform_970x250") {
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
  gradient.name = format.id === "adform_300x600" ? "Bottom readability gradient" : "Left readability gradient";
  gradient.resize(format.width, format.height);
  gradient.x = 0;
  gradient.y = 0;
  gradient.fills = [{
    type: "GRADIENT_LINEAR",
    gradientTransform: format.id === "adform_300x600"
      ? [[0, 1, 0], [1, 0, 0]]
      : [[1, 0, 0], [0, 1, 0]],
    gradientStops: [
      { position: 0, color: { r: 0.04, g: 0.04, b: 0.05, a: 0.06 } },
      { position: 1, color: { r: 0.04, g: 0.04, b: 0.05, a: 0.78 } }
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
// Obrázok zväčšíme tak, aby centrálna polovica pokryla obrazovú zónu.
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

  const scale = Math.max(
    zone[2] / (imageSize.width * 0.5),
    zone[3] / imageSize.height
  );
  const renderedW = imageSize.width * scale;
  const renderedH = imageSize.height * scale;
  const rect = figma.createRectangle();
  rect.name = "Master visual — 2000×2000 core";
  rect.resize(renderedW, renderedH);
  rect.fills = [{ type: "IMAGE", imageHash: figmaImage.hash, scaleMode: "FILL" }];
  rect.x = clamp(zone[2] * 0.5 - clamp(focal.x, 0.25, 0.75) * renderedW, zone[2] - renderedW, 0);
  rect.y = clamp(zone[3] * 0.5 - clamp(focal.y, 0.25, 0.75) * renderedH, zone[3] - renderedH, 0);
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
  const button = addSolidRect(frame, "CTA button", x, y, w, h, { r: 0.02, g: 0.27, b: 0.98 }, 1);
  button.cornerRadius = Math.max(2, Math.round(h * 0.08));
  addTemplateText(
    frame, "CTA text", value + "  ›",
    [x + 6, y + Math.round(h * 0.24), w - 12, h * 0.55],
    Math.round(clamp(h * 0.28, 8, 16)),
    { r: 1, g: 1, b: 1 }, "Bold", "CENTER"
  );
}

function buildMasterSafeLayout(frame, format, layout, content, figmaImage, imageSize, figmaLogo) {
  const family = layout.master_family || "square";
  const focal = {
    x: typeof layout.crop_anchor_x === "number" ? layout.crop_anchor_x : 0.5,
    y: typeof layout.crop_anchor_y === "number" ? layout.crop_anchor_y : 0.5
  };
  const pad = Math.round(clamp(Math.min(format.width, format.height) * 0.065, 10, 54));
  frame.fills = [{ type: "SOLID", color: brandColor(layout) }];

  if (family === "wide") {
    const imageW = Math.round(format.width * 0.52);
    addMasterCoreImage(frame, figmaImage, imageSize, [0, 0, imageW, format.height], focal, content.showGuides);
    addSolidRect(
      frame, "Wide content panel", imageW, 0, format.width - imageW, format.height,
      brandColor(layout), 0.96
    );
    const textX = imageW + pad;
    const textW = format.width - textX - pad;
    const headlineSize = Math.round(clamp(format.height * 0.17, 14, 42));
    addTemplateText(
      frame, "Headline", content.headline,
      [textX, Math.round(format.height * 0.22), textW, Math.round(format.height * 0.30)],
      headlineSize, { r: 1, g: 1, b: 1 }, "Bold", "LEFT"
    );
    addTemplateText(
      frame, "Subheadline", content.subheadline,
      [textX, Math.round(format.height * 0.54), textW, Math.round(format.height * 0.14)],
      Math.round(clamp(headlineSize * 0.48, 8, 18)),
      { r: 1, g: 1, b: 1 }, "Regular", "LEFT"
    );
    addMasterCta(
      frame, content.ctaText, textX, Math.round(format.height * 0.72),
      Math.min(textW * 0.46, 150), Math.round(clamp(format.height * 0.19, 28, 48))
    );
    if (shouldShowLogo(format, layout, figmaLogo)) {
      const logoH = Math.round(clamp(format.height * 0.27, 48, 82));
      placeLogo(frame, figmaLogo, format.width - pad - logoH, format.height - pad - logoH, logoH, logoH);
    }
  } else {
    addMasterCoreImage(frame, figmaImage, imageSize, [0, 0, format.width, format.height], focal, content.showGuides);

    const scrimH = Math.round(format.height * (family === "portrait" ? 0.48 : 0.44));
    const scrim = figma.createRectangle();
    scrim.name = "Bottom readability gradient";
    scrim.resize(format.width, scrimH);
    scrim.x = 0;
    scrim.y = format.height - scrimH;
    scrim.fills = [{
      type: "GRADIENT_LINEAR",
      gradientTransform: [[0, 1, 0], [1, 0, 0]],
      gradientStops: [
        { position: 0, color: { r: 0.03, g: 0.03, b: 0.04, a: 0.04 } },
        { position: 1, color: { r: 0.03, g: 0.03, b: 0.04, a: 0.80 } }
      ]
    }];
    frame.appendChild(scrim);

    const headlineSize = Math.round(clamp(
      Math.min(format.width * 0.075, format.height * 0.055), 14, 44
    ));
    const headlineY = Math.round(format.height * (family === "portrait" ? 0.61 : 0.64));
    const textW = format.width - pad * 2;
    addTemplateText(
      frame, "Headline", content.headline,
      [pad, headlineY, textW, Math.round(format.height * 0.13)],
      headlineSize, { r: 1, g: 1, b: 1 }, "Bold", "LEFT"
    );
    addTemplateText(
      frame, "Subheadline", content.subheadline,
      [pad, headlineY + Math.round(format.height * 0.12), textW, Math.round(format.height * 0.09)],
      Math.round(clamp(headlineSize * 0.50, 8, 18)),
      { r: 1, g: 1, b: 1 }, "Regular", "LEFT"
    );
    addMasterCta(
      frame, content.ctaText, pad, Math.round(format.height * 0.82),
      Math.round(clamp(format.width * 0.40, 88, 150)),
      Math.round(clamp(format.height * 0.085, 30, 48))
    );
    if (shouldShowLogo(format, layout, figmaLogo)) {
      const logoH = Math.round(clamp(Math.min(format.width, format.height) * 0.22, 50, 82));
      placeLogo(frame, figmaLogo, format.width - pad - logoH, format.height - pad - logoH, logoH, logoH);
    }
  }

  if (content.aiGenerated) addAiNote(frame, format);
}

function buildAdformPsdLayout(frame, format, layout, content, figmaImage, imageSize, figmaLogo) {
  const rules = ADFORM_PSD_RULES[format.id];
  if (!rules) {
    buildFullBleedLayout(frame, format, layout, content.headline, figmaImage, figmaLogo);
    return;
  }

  frame.fills = [{ type: "SOLID", color: brandColor(layout) }];
  const focal = {
    x: typeof layout.crop_anchor_x === "number" ? layout.crop_anchor_x : 0.5,
    y: typeof layout.crop_anchor_y === "number" ? layout.crop_anchor_y : 0.5
  };
  if (format.id === "adform_970x250") {
    addFocalImageFrame(frame, figmaImage, imageSize, "Key visual crop — left zone", [0, 0, 425, 250], focal, { x: 0.66, y: 0.52 });
  } else if (format.id === "adform_160x600") {
    addFocalImageFrame(frame, figmaImage, imageSize, "Key visual crop — top zone", [0, 0, 160, 330], focal, { x: 0.62, y: 0.48 });
  } else if (format.id === "adform_300x250") {
    addFocalImageFrame(frame, figmaImage, imageSize, "Key visual crop — full frame", [0, 0, 300, 250], focal, { x: 0.76, y: 0.52 });
  } else {
    addFocalImageFrame(frame, figmaImage, imageSize, "Key visual crop — full frame", [0, 0, format.width, format.height], focal, { x: 0.68, y: 0.40 });
  }

  addAdformBackgroundTreatment(frame, format, rules);
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
    const button = addSolidRect(frame, "CTA button", c[0], c[1], c[2], c[3], { r: 0.02, g: 0.27, b: 0.98 }, 1);
    button.cornerRadius = Math.round(c[3] * 0.08);
    const ctaText = content.ctaText || STYLE.ctaText;
    addTemplateText(
      frame, "CTA text", ctaText + "  ›", [c[0] + 8, c[1] + Math.round(c[3] * 0.25), c[2] - 16, c[3] * 0.5],
      Math.round(clamp(c[3] * 0.28, 9, 15)),
      { r: 1, g: 1, b: 1 }, "Bold", "CENTER"
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
  if (figmaImage && layout.image_fit === "contain") {
    frame.fills = [{ type: "SOLID", color: brandColor(layout) }];
    addImageRect(frame, figmaImage, "Foto - protected subject FIT", 0, 0, format.width, format.height, "FIT");
  } else {
    frame.fills = figmaImage
      ? [{ type: "IMAGE", imageHash: figmaImage.hash, scaleMode: "FILL" }]
      : [{ type: "SOLID", color: brandColor(layout) }];
  }

  const pad = Math.round(clamp(Math.min(format.width, format.height) * STYLE.paddingPct, 10, 60));

  // Jemný tmavý gradient dole — priehľadný hore → tmavý dole (čitateľnosť textu)
  const gradH = Math.round(format.height * STYLE.scrimHeightPct);
  const gradRect = figma.createRectangle();
  gradRect.name = "Gradient scrim";
  gradRect.resize(format.width, gradH);
  gradRect.x = 0;
  gradRect.y = format.height - gradH;
  gradRect.fills = [{
    type: "GRADIENT_LINEAR",
    gradientTransform: [[0, 1, 0], [1, 0, 0]],
    gradientStops: [
      { position: 0, color: { r: 0, g: 0, b: 0, a: 0 } },
      { position: 1, color: { r: 0, g: 0, b: 0, a: STYLE.scrimOpacity } }
    ]
  }];
  frame.appendChild(gradRect);

  // Logo VPRAVO DOLE (Surď) — ~15 % šírky, min 50 px
  let logoRight = 0;
  if (shouldShowLogo(format, layout, figmaLogo)) {
    const logoW = Math.max(STYLE.minLogoPx, Math.round(format.width * STYLE.logoWidthPct));
    const logoH = Math.round(logoW * 0.95); // TB square lockup ~1:0.95
    const lx = format.width - logoW - pad;
    const ly = format.height - logoH - pad;
    placeLogo(frame, figmaLogo, lx, ly, logoW, logoH);
    logoRight = logoW + pad; // koľko miesta vpravo zabrať headlinu
  }

  if (!shouldShowHeadline(layout, headline)) return;

  // Headline biely vľavo dole — nechá miesto logu vpravo
  const fontSize = Math.max(STYLE.minTextPx, Math.round(format.height * STYLE.headlinePct));
  const txt = figma.createText();
  txt.fontName = FONT;
  txt.characters = headline || "HEADLINE";
  txt.fontSize = fontSize;
  txt.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  try { txt.letterSpacing = { value: -2, unit: "PERCENT" }; } catch (e) {}
  const textW = format.width - pad * 2 - (logoRight ? logoRight * 0.8 : 0);
  txt.resize(Math.max(40, textW), Math.round(format.height * 0.4));
  txt.textAutoResize = "HEIGHT";
  txt.x = pad;
  txt.y = format.height - pad - txt.height;
  frame.appendChild(txt);
  // po autoresize znovu ukotvi dole
  txt.y = format.height - pad - txt.height;
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
function buildLogoOnlyLayout(frame, format, layout, headline, figmaLogo) {
  const isGoogleLogo = format.id === "google_logo_square" || format.id === "google_logo_wide";
  frame.fills = isGoogleLogo ? [] : [{ type: "SOLID", color: BRAND_COLOR }];

  // Logo vycentrované
  const lH = Math.min(Math.round(format.height * 0.25), Math.round(format.width * 0.18), 80);
  const lW = Math.round(lH * 3.5);
  const lPad = Math.round(format.height * 0.15);
  placeLogo(frame, figmaLogo, Math.round((format.width - lW) / 2), lPad, lW, lH);

  if (shouldShowHeadline(layout, headline)) {
    const fontSize = Math.max(7, Math.min(Math.floor(format.height * 0.10), Math.floor(format.width * 0.06)));
    const txt = figma.createText();
    txt.fontName = FONT;
    txt.characters = headline;
    txt.fontSize = fontSize;
    // Pre Google logo formáty (transparentné pozadie) — tmavý text; inak biely
    txt.fills = [{ type: "SOLID", color: isGoogleLogo ? BRAND_COLOR : { r: 1, g: 1, b: 1 } }];
    txt.resize(format.width - 24, format.height);
    txt.textAutoResize = "HEIGHT";
    txt.x = 12;
    txt.y = lPad + lH + Math.round(format.height * 0.06);
    frame.appendChild(txt);
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
