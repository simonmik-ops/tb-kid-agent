#!/usr/bin/env node

const fs = require("fs");
const { PNG } = require("pngjs");

const input = process.argv[2];
const output = process.argv[3];
if (!input || !output) {
  process.stderr.write("Usage: normalize-png-opaque-rect.js input.png output.png\n");
  process.exit(2);
}

const png = PNG.sync.read(fs.readFileSync(input));
const rows = new Array(png.height).fill(false);
const cols = new Array(png.width).fill(false);

for (let y = 0; y < png.height; y++) {
  let opaque = 0;
  for (let x = 0; x < png.width; x++) {
    if (png.data[(y * png.width + x) * 4 + 3] >= 245) opaque++;
  }
  rows[y] = opaque / png.width >= 0.70;
}
for (let x = 0; x < png.width; x++) {
  let opaque = 0;
  for (let y = 0; y < png.height; y++) {
    if (png.data[(y * png.width + x) * 4 + 3] >= 245) opaque++;
  }
  cols[x] = opaque / png.height >= 0.70;
}

function longestRun(flags) {
  let bestStart = 0;
  let bestEnd = -1;
  let start = -1;
  for (let i = 0; i <= flags.length; i++) {
    if (i < flags.length && flags[i]) {
      if (start < 0) start = i;
    } else if (start >= 0) {
      if (i - 1 - start > bestEnd - bestStart) {
        bestStart = start;
        bestEnd = i - 1;
      }
      start = -1;
    }
  }
  return { start: bestStart, end: bestEnd, length: Math.max(0, bestEnd - bestStart + 1) };
}

const xr = longestRun(cols);
const yr = longestRun(rows);
if (xr.length < png.width * 0.65 || yr.length < png.height * 0.65) {
  throw new Error("No dominant opaque rectangle found");
}

const width = xr.length;
const height = yr.length;
const cropped = new PNG({ width, height });
for (let y = 0; y < height; y++) {
  const sourceStart = ((yr.start + y) * png.width + xr.start) * 4;
  const targetStart = y * width * 4;
  png.data.copy(cropped.data, targetStart, sourceStart, sourceStart + width * 4);
}
fs.writeFileSync(output, PNG.sync.write(cropped));
process.stdout.write(`${png.width}x${png.height} -> ${width}x${height} (${xr.start},${yr.start})\n`);
