#!/usr/bin/env node
// Regeneruje zapečenú kópiu katalógu formátov (FORMAT_CATALOG) v plugin/ui.html
// z aktuálneho formats.js (module.exports = NORMALIZED_FORMATS — po
// inferRole/normalizeFormat, nie surové FORMATS). Excel cesta v pluginu
// odtiaľto číta ako spoľahlivý základ, nezávislý od Railway/servera. Pozri
// P0-27 + P2-29.
//
// Spustenie: node scripts/generate-format-catalog.js

const fs = require("fs");
const path = require("path");

const NORMALIZED_FORMATS = require("../formats.js");
const uiPath = path.join(__dirname, "..", "plugin", "ui.html");

const catalog = NORMALIZED_FORMATS.map(function (f) {
  return {
    id: f.id,
    name: f.name,
    channel: f.channel,
    campaign: f.campaign || null,
    width: f.width,
    height: f.height,
    role: f.role,
    safeZones: f.safeZones,
    limit: f.limit || null,
    notes: f.notes || null,
    rules: f.rules
  };
});

const json = JSON.stringify(catalog);
const generatedAt = new Date().toISOString().slice(0, 10);
const block =
  "  // ═══ FORMAT_CATALOG — GENEROVANÉ, needituj ručne ═══\n" +
  "  // Zdroj: formats.js (NORMALIZED_FORMATS, po inferRole/normalizeFormat).\n" +
  "  // Regenerácia: node scripts/generate-format-catalog.js\n" +
  "  // Posledná regenerácia: " + generatedAt + " (" + catalog.length + " formátov).\n" +
  "  const FORMAT_CATALOG = " + json + ";\n" +
  "  // ═══ /FORMAT_CATALOG ═══";

const startMarker = "  // ═══ FORMAT_CATALOG — GENEROVANÉ, needituj ručne ═══";
const endMarker = "  // ═══ /FORMAT_CATALOG ═══";

const html = fs.readFileSync(uiPath, "utf8");
const startIdx = html.indexOf(startMarker);
const endIdx = html.indexOf(endMarker);

let next;
if (startIdx === -1 || endIdx === -1) {
  throw new Error(
    "FORMAT_CATALOG markers not found in plugin/ui.html — insert the block manually once, then this script can regenerate it."
  );
} else {
  const before = html.slice(0, startIdx);
  const after = html.slice(endIdx + endMarker.length);
  next = before + block + after;
}

fs.writeFileSync(uiPath, next);
process.stdout.write("FORMAT_CATALOG regenerated: " + catalog.length + " formátov, " + Math.round(json.length / 1024) + " kB.\n");
