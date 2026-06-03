// figma.js — MCP verzia
// Figma REST API neumožňuje vytváranie súborov a frames cez Personal Access Token.
// Táto verzia:
//   1. Uloží výsledky analýzy do last-result.json
//   2. Vygeneruje Figma Plugin JS kód do figma-plugin-code.js (záloha)
// Samotný zápis do Figma prebieha cez Claude Code MCP (use_figma tool).

const fs = require("fs");
const path = require("path");

const RESULTS_FILE = path.join(__dirname, "last-result.json");
const PLUGIN_FILE  = path.join(__dirname, "figma-plugin-code.js");

function saveResults(formatResults, headline, adType) {
  const payload = {
    headline,
    adType,
    timestamp: new Date().toISOString(),
    formats: formatResults.map(({ format, layout }) => ({ format, layout }))
  };
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(payload, null, 2));
  console.log("Výsledky uložené →", RESULTS_FILE);
  return payload;
}

function generatePluginCode(formats, headline, adType) {
  const byChannel = {};
  for (const { format, layout } of formats) {
    if (!byChannel[format.channel]) byChannel[format.channel] = [];
    byChannel[format.channel].push({ format, layout });
  }

  const lines = ["(async () => {", "  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });"];

  for (const [channel, items] of Object.entries(byChannel)) {
    const safeId = channel.replace(/[^a-zA-Z0-9]/g, "_");
    lines.push(`\n  // ── ${channel} ──`);
    lines.push(`  const page_${safeId} = figma.createPage();`);
    lines.push(`  page_${safeId}.name = ${JSON.stringify(channel)};`);
    lines.push(`  figma.currentPage = page_${safeId};`);
    lines.push(`  let xOff = 0;`);

    for (const { format, layout } of items) {
      const fid = format.id;
      const headlineY = layout.headline_position === "bottom"
        ? format.height - (layout.text_area_height_px || 60) - 20
        : 20;
      const fSize = Math.min(layout.headline_size_px || 48, Math.floor(format.height * 0.08));

      lines.push(`\n  // ${format.name} (${format.width}×${format.height})`);
      lines.push(`  const f_${fid} = figma.createFrame();`);
      lines.push(`  f_${fid}.name = ${JSON.stringify(format.name + " — " + adType.toUpperCase())};`);
      lines.push(`  f_${fid}.resize(${format.width}, ${format.height});`);
      lines.push(`  f_${fid}.x = xOff; f_${fid}.y = 0;`);
      lines.push(`  f_${fid}.fills = [{ type: 'SOLID', color: { r: 0.95, g: 0.95, b: 0.95 } }];`);

      lines.push(`  const t_${fid} = figma.createText();`);
      lines.push(`  t_${fid}.characters = ${JSON.stringify(headline || "HEADLINE")};`);
      lines.push(`  t_${fid}.fontSize = ${fSize};`);
      lines.push(`  t_${fid}.x = 20; t_${fid}.y = ${headlineY};`);
      lines.push(`  t_${fid}.resize(${format.width - 40}, ${layout.text_area_height_px || 60});`);
      lines.push(`  f_${fid}.appendChild(t_${fid});`);

      if (format.safeZones?.top) {
        lines.push(`  const sz_${fid} = figma.createRectangle();`);
        lines.push(`  sz_${fid}.name = "Safe zone — TOP";`);
        lines.push(`  sz_${fid}.resize(${format.width}, ${format.safeZones.top});`);
        lines.push(`  sz_${fid}.fills = [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 }, opacity: 0.1 }];`);
        lines.push(`  f_${fid}.appendChild(sz_${fid});`);
      }

      lines.push(`  page_${safeId}.appendChild(f_${fid});`);
      lines.push(`  xOff += ${format.width + 80};`);
    }
  }

  lines.push(`\n  figma.notify("TB KID 2026 — ${adType} — všetky formáty vytvorené!");`);
  lines.push("})();");

  return lines.join("\n");
}

// Zachované pre kompatibilitu so server.js — v MCP verzii netvára REST súbor
async function createFile(name) {
  return { key: "mcp-pending", name };
}

async function buildFigmaDocument(fileKey, formatResults, headline, adType) {
  const saved = saveResults(formatResults, headline, adType);
  const pluginCode = generatePluginCode(saved.formats, headline, adType);
  fs.writeFileSync(PLUGIN_FILE, pluginCode);
  console.log("Plugin kód uložený →", PLUGIN_FILE);
  return saved;
}

module.exports = { createFile, buildFigmaDocument };
