#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const pixelmatch = require("pixelmatch");
const { PNG } = require("pngjs");

const root = path.resolve(__dirname, "..");
const actualDir = path.resolve(process.argv[2] || path.join(root, "tests", "visual-actual"));
const baselineDir = path.resolve(process.argv[3] || path.join(root, "tests", "visual-baselines"));
const diffDir = path.resolve(process.argv[4] || path.join(root, "artifacts", "visual-diff"));
const manifestPath = path.join(baselineDir, "manifest.json");

function fail(message) {
  process.stderr.write("VISUAL QA FAIL: " + message + "\n");
  process.exitCode = 1;
}

function readPng(file) {
  return PNG.sync.read(fs.readFileSync(file));
}

function findActual(entry) {
  const exact = path.join(actualDir, entry.actual || entry.baseline);
  if (fs.existsSync(exact)) return exact;
  if (!fs.existsSync(actualDir)) return null;
  const prefix = entry.id.replace(/_/g, "").toLowerCase();
  const dimensions = (entry.id.match(/\d+x\d+/i) || [""])[0].toLowerCase();
  const candidates = fs.readdirSync(actualDir)
    .filter((name) => name.toLowerCase().endsWith(".png"))
    .map((name) => ({ name, compact: name.replace(/[^a-z0-9]/gi, "").toLowerCase() }));
  const match = candidates.find((item) => item.compact.includes(prefix)) ||
    candidates.find((item) => dimensions && item.compact.includes(dimensions));
  return match ? path.join(actualDir, match.name) : null;
}

if (!fs.existsSync(manifestPath)) {
  fail("chýba baseline manifest " + manifestPath);
} else {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  fs.mkdirSync(diffDir, { recursive: true });
  let compared = 0;
  let failed = 0;

  for (const entry of manifest.entries || []) {
    const baselinePath = path.join(baselineDir, entry.baseline);
    const actualPath = findActual(entry);
    if (!fs.existsSync(baselinePath)) {
      fail(entry.id + ": chýba baseline " + baselinePath);
      failed++;
      continue;
    }
    if (!actualPath) {
      fail(entry.id + ": chýba vyrenderovaný PNG v " + actualDir);
      failed++;
      continue;
    }

    const baseline = readPng(baselinePath);
    const actual = readPng(actualPath);
    if (baseline.width !== actual.width || baseline.height !== actual.height) {
      fail(entry.id + `: rozmery ${actual.width}×${actual.height}, referencia ${baseline.width}×${baseline.height}`);
      failed++;
      continue;
    }

    const diff = new PNG({ width: baseline.width, height: baseline.height });
    const different = pixelmatch(
      baseline.data, actual.data, diff.data, baseline.width, baseline.height,
      { threshold: entry.pixelThreshold ?? 0.10, includeAA: false, alpha: 0.6, diffColor: [255, 0, 80] }
    );
    const ratio = different / (baseline.width * baseline.height);
    const maxRatio = entry.maxDiffRatio ?? 0.015;
    compared++;
    if (ratio > maxRatio) {
      const diffPath = path.join(diffDir, entry.id + ".diff.png");
      fs.writeFileSync(diffPath, PNG.sync.write(diff));
      fail(entry.id + `: rozdiel ${(ratio * 100).toFixed(2)} %, maximum ${(maxRatio * 100).toFixed(2)} %; diff ${diffPath}`);
      failed++;
    } else {
      process.stdout.write(`PASS ${entry.id}: ${(ratio * 100).toFixed(2)} % rozdiel\n`);
    }
  }

  if (!failed) process.stdout.write(`Visual regression: ${compared} referencií prešlo.\n`);
}
