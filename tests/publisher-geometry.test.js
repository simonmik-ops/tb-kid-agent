const assert = require("assert");
const fs = require("fs");

const code = fs.readFileSync(require.resolve("../plugin/code.js"), "utf8");
const start = code.indexOf("function clamp");
const end = code.indexOf("function buildNativeCenterLayout", start);
assert.ok(start >= 0 && end > start, "publisher geometry helpers must exist");
const helpers = new Function(code.slice(start, end) + "; return { getInterscrollerComposition };")();

const wide = helpers.getInterscrollerComposition({ width: 2000, height: 1400, safeZones: { top: 0, bottom: 0 } });
assert(wide.panelW <= 880, "wide panel must not cover the full 2000 px creative");
assert(wide.btnW <= 280, "wide CTA must remain a normal button width");
assert(wide.panelX >= 0 && wide.panelY >= 0);
assert(wide.panelX + wide.panelW <= 2000 && wide.panelY + wide.panelH <= 1400);

const strip = helpers.getInterscrollerComposition({ width: 1200, height: 400, safeZones: { top: 0, bottom: 0 } });
assert(strip.panelW < 600, "landscape interscroller panel must preserve the key visual");
assert(strip.btnW <= 280);

const portrait = helpers.getInterscrollerComposition({ width: 300, height: 600, safeZones: { sides: 50, top: 0, bottom: 0 } });
assert(portrait.panelW > 0 && portrait.panelW <= 200);
assert(portrait.panelX >= 50 && portrait.panelX + portrait.panelW <= 250);

console.log("publisher geometry: ok");
