// code.js
try {
  figma.showUI(__html__, { width: 500, height: 640 });
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

async function createAllFrames({ formats, headline, adType, imageBytes, logoBytes }) {
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  await figma.loadFontAsync({ family: "Inter", style: "Bold" });

  var figmaImage = null;
  if (imageBytes && imageBytes.length > 0) {
    figmaImage = figma.createImage(new Uint8Array(imageBytes));
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
      const layoutType = layout.layout_type || "full_bleed";

      const frame = figma.createFrame();
      frame.name = format.name + " \u2014 " + adType.toUpperCase();
      frame.resize(format.width, format.height);
      frame.x = xOffset;
      frame.y = 0;
      frame.clipsContent = true;

      if (layoutType === "strip") {
        buildStripLayout(frame, format, layout, headline, figmaImage, figmaLogo);
      } else if (layoutType === "split") {
        buildSplitLayout(frame, format, layout, headline, figmaImage, figmaLogo);
      } else if (layoutType === "stacked") {
        buildStackedLayout(frame, format, layout, headline, figmaImage, figmaLogo);
      } else if (layoutType === "blurred_bg") {
        buildBlurredBgLayout(frame, format, layout, headline, figmaImage, figmaLogo);
      } else if (layoutType === "logo_only") {
        buildLogoOnlyLayout(frame, format, layout, headline, figmaLogo);
      } else {
        buildFullBleedLayout(frame, format, layout, headline, figmaImage, figmaLogo);
      }

      addSafeZones(frame, format);

      page.appendChild(frame);
      allFrames.push(frame);
      xOffset += format.width + 80;

      figma.ui.postMessage({ type: "progress", done: allFrames.length, total: formats.length });
    }
  }

  const firstPage = Array.from(figma.root.children).find(p => p.name === channels[0]);
  if (firstPage) figma.currentPage = firstPage;
  if (allFrames.length > 0) figma.viewport.scrollAndZoomIntoView(allFrames.slice(0, 3));

  figma.ui.postMessage({ type: "done", formatCount: formats.length, pageCount: channels.length });
}

// Pomocná funkcia: vloží logo do ľavého horného rohu (alebo inej pozície)
// logoH = výška logo rectu, pad = vnútorný padding
function placeLogo(frame, figmaLogo, x, y, w, h) {
  if (!figmaLogo) return;
  const logoRect = figma.createRectangle();
  logoRect.name = "Logo";
  logoRect.resize(w, h);
  logoRect.x = x;
  logoRect.y = y;
  logoRect.fills = [{ type: "IMAGE", imageHash: figmaLogo.hash, scaleMode: "FIT" }];
  frame.appendChild(logoRect);
}

// Brand farba pozadia, fotka vpravo (contain 30%), text+logo vľavo
// Pre height < 300 — 728×90, 970×250, 1200×200
function buildStripLayout(frame, format, layout, headline, figmaImage, figmaLogo) {
  // TB paleta: červená #C8102E alebo tmavomodrá #1A1A2E
  // Použijeme extrahovanú farbu z vizuálu, fallback na tmavomodrú
  const bgColor = {
    r: layout.bg_r || 0.10,
    g: layout.bg_g || 0.10,
    b: layout.bg_b || 0.18
  };
  frame.fills = [{ type: "SOLID", color: bgColor }];

  const photoW = Math.round(format.width * 0.30);

  // Fotka vpravo — len ak vizuál nie je príliš komplikovaný
  if (figmaImage && !layout.is_complex_visual) {
    const photoRect = figma.createRectangle();
    photoRect.name = "Foto (contain)";
    photoRect.resize(photoW, format.height);
    photoRect.x = format.width - photoW;
    photoRect.y = 0;
    // FIT = object-fit: contain — celá fotka viditeľná, tváre neodrezané
    photoRect.fills = [{ type: "IMAGE", imageHash: figmaImage.hash, scaleMode: "FIT" }];
    frame.appendChild(photoRect);
  }

  // Logo vľavo hore
  const logoH = Math.round(format.height * 0.35);
  const logoW = Math.round(logoH * 3);
  placeLogo(frame, figmaLogo, 12, Math.round((format.height - logoH) / 2) - Math.round(format.height * 0.15), logoW, logoH);

  // Headline vľavo — obmedzená šírka aby nepresahoval do foto zóny
  const textAreaW = format.width - photoW - 32;
  const fontSize = Math.max(7, Math.min(layout.headline_size_px || 18, Math.floor(format.height * 0.25)));
  const txt = figma.createText();
  txt.fontName = { family: "Inter", style: "Bold" };
  txt.characters = headline || "HEADLINE";
  txt.fontSize = fontSize;
  txt.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  txt.resize(textAreaW, format.height);
  txt.textAutoResize = "HEIGHT";
  txt.x = 16;
  txt.y = Math.round((format.height - fontSize * 1.2) / 2);
  frame.appendChild(txt);
}

// Celý obrázok + tmavý overlay + text dole
function buildFullBleedLayout(frame, format, layout, headline, figmaImage, figmaLogo) {
  if (figmaImage) {
    frame.fills = [{ type: "IMAGE", imageHash: figmaImage.hash, scaleMode: "FILL" }];
  } else {
    frame.fills = [{ type: "SOLID", color: { r: 0.9, g: 0.9, b: 0.9 } }];
  }

  const overlayH = layout.text_area_height_px || Math.round(format.height * 0.25);
  const overlay = figma.createRectangle();
  overlay.name = "Text overlay";
  overlay.resize(format.width, overlayH);
  overlay.x = 0;
  overlay.y = format.height - overlayH;
  overlay.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity: 0.5 }];
  frame.appendChild(overlay);

  // Logo vpravo hore (nad overlay zónou)
  const logoH = Math.round(Math.min(overlayH * 0.55, format.width * 0.12));
  const logoW = Math.round(logoH * 3.5);
  placeLogo(frame, figmaLogo, format.width - logoW - 14, format.height - overlayH + Math.round((overlayH - logoH) / 2), logoW, logoH);

  const fontSize = Math.max(10, Math.min(layout.headline_size_px || 36, Math.floor(format.height * 0.08)));
  const txt = figma.createText();
  txt.fontName = { family: "Inter", style: "Bold" };
  txt.characters = headline || "HEADLINE";
  txt.fontSize = fontSize;
  txt.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  txt.x = 16;
  txt.y = format.height - overlayH + Math.round((overlayH - fontSize * 1.2) / 2);
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
    ? [{ type: "IMAGE", imageHash: figmaImage.hash, scaleMode: "FILL" }]
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

  // Logo v hornej časti brand sekcie
  const logoH = Math.round(Math.min(format.height * 0.12, 60));
  const logoW = Math.round(logoH * 3.5);
  placeLogo(frame, figmaLogo, photoW + Math.round((brandW - logoW) / 2), Math.round(format.height * 0.08), logoW, logoH);

  const fontSize = Math.max(8, Math.min(layout.headline_size_px || 24, Math.floor(format.height * 0.30)));
  const txt = figma.createText();
  txt.fontName = { family: "Inter", style: "Bold" };
  txt.characters = headline || "HEADLINE";
  txt.fontSize = fontSize;
  txt.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  txt.x = photoW + 12;
  txt.y = Math.round((format.height - fontSize * 1.2) / 2);
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

  // Logo vycentrované v logo zóne
  const lW = Math.round(Math.min(format.width * 0.55, logoH * 4));
  const lH = Math.round(logoH * 0.6);
  placeLogo(frame, figmaLogo, Math.round((format.width - lW) / 2), Math.round((logoH - lH) / 2), lW, lH);

  const photoRect = figma.createRectangle();
  photoRect.name = "Foto";
  photoRect.resize(format.width, photoH);
  photoRect.x = 0;
  photoRect.y = logoH;
  photoRect.fills = figmaImage
    ? [{ type: "IMAGE", imageHash: figmaImage.hash, scaleMode: "FILL" }]
    : [{ type: "SOLID", color: { r: 0.85, g: 0.85, b: 0.85 } }];
  frame.appendChild(photoRect);

  const textRect = figma.createRectangle();
  textRect.name = "Text z\u00f3na";
  textRect.resize(format.width, textH);
  textRect.x = 0;
  textRect.y = logoH + photoH;
  textRect.fills = [{ type: "SOLID", color: { r: 0.95, g: 0.95, b: 0.95 } }];
  frame.appendChild(textRect);

  const fontSize = Math.max(8, Math.min(layout.headline_size_px || 14, Math.floor(format.width * 0.10)));
  const txt = figma.createText();
  txt.fontName = { family: "Inter", style: "Bold" };
  txt.characters = headline || "HEADLINE";
  txt.fontSize = fontSize;
  txt.fills = [{ type: "SOLID", color: { r: 0.1, g: 0.1, b: 0.1 } }];
  txt.x = Math.round(format.width * 0.08);
  txt.y = logoH + photoH + Math.round((textH - fontSize * 1.4) / 2);
  frame.appendChild(txt);
}

// Žiadna fotka — brand farba + logo + text
function buildLogoOnlyLayout(frame, format, layout, headline, figmaLogo) {
  frame.fills = [{ type: "SOLID", color: BRAND_COLOR }];

  // Logo vycentrované v hornej polovici
  const lH = Math.round(Math.min(format.height * 0.40, format.width * 0.25));
  const lW = Math.round(lH * 3.5);
  placeLogo(frame, figmaLogo, Math.round((format.width - lW) / 2), Math.round(format.height * 0.12), lW, lH);

  const fontSize = Math.max(7, Math.floor(format.height * 0.18));
  const txt = figma.createText();
  txt.fontName = { family: "Inter", style: "Bold" };
  txt.characters = headline || "HEADLINE";
  txt.fontSize = fontSize;
  txt.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  txt.x = 12;
  txt.y = Math.round(format.height * 0.65);
  frame.appendChild(txt);
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

  // Logo vľavo v text zóne
  const logoH = Math.round(overlayH * 0.45);
  const logoW = Math.round(logoH * 3.5);
  placeLogo(frame, figmaLogo, 20, format.height - overlayH + Math.round((overlayH - logoH) / 2), logoW, logoH);

  const fontSize = Math.max(10, Math.min(layout.headline_size_px || 32, Math.floor(format.height * 0.06)));
  const txt = figma.createText();
  txt.fontName = { family: "Inter", style: "Bold" };
  txt.characters = headline || "HEADLINE";
  txt.fontSize = fontSize;
  txt.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  txt.x = 20;
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
