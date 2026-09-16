// Regresia 13.9.2026 (qa:presentation gate): scripts/visual-regression.js
// nikdy nebolo súčasťou žiadneho npm skriptu (npm test == scripts/run-
// tests.js, žiadne volanie visual-regression.js) — "52/52 passing"
// neznamenalo NIČ o skutočnom vzhľade vygenerovaných frameov. Táto
// zadanie opravuje samotný gate (nie renderery) a tento test zamyká tri
// konkrétne, naživo overené chyby, ktoré ho robili nefunkčným:
//
//   1. findActual() čítalo actualDir bez rekurzie — reálne bulk exporty
//      (BulkExport_byCorewake, overené na disku) majú každý kanál vo
//      vlastnom podpriečinku, takže sa nenašiel žiadny súbor, aj keď
//      export reálne existoval.
//   2. Normalizácia nerozumela "×" (multiplication sign, U+00D7) — reálne
//      Figma bulk exporty ho v názve súboru používajú ("1200×628"), staré
//      /\d+x\d+/i na ňom nikdy nenašlo zhodu.
//   3. "Chýbajúci súbor = FAIL, nikdy tichý úspech" muselo zostať platné
//      AJ po oprave hľadania — inak by oprava #1 mohla omylom začať
//      "nachádzať" niečo nesprávne namiesto správneho hlásenia chyby.
//
// Testuje priamo exportované čisté funkcie (module.exports v visual-
// regression.js, require.main guard oddeľuje toto od CLI behu), nie
// simuláciu/source.includes() — presne opačný prístup, než mali kritizované
// posledné logo testy (spustené overuje SKUTOČNÚ implementáciu).
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const visualRegression = require("../scripts/visual-regression.js");
const { normalizeToken, walkImageFiles, buildCandidates, findActual, detectExportDate } = visualRegression;

// ── 1) normalizeToken: × vs x, diakritika, oddeľovače ────────────────────
assert.strictEqual(normalizeToken("1200×628"), normalizeToken("1200x628"),
  "× (multiplication sign) and ASCII x must normalize identically");
assert.strictEqual(normalizeToken("čistý_vizuál"), normalizeToken("cisty-vizual"),
  "diacritics must be stripped so channel/role name variants match");
assert.strictEqual(normalizeToken("Adform_300x600"), normalizeToken("adform 300x600"),
  "underscores and spaces must normalize identically");

// ── 2) recursive search across real-shaped subfolder structure ──────────
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "visual-regression-test-"));
try {
  const adformDir = path.join(tmpRoot, "Adform");
  fs.mkdirSync(adformDir, { recursive: true });
  // presná štruktúra reálneho bulk exportu: kanál je priečinok, súbor má
  // "×" a "_·_" oddeľovače, presne ako BulkExport_byCorewake na disku.
  const fileA = "300×600_·_Adform_-_publisher_—_PRODUCTION_[investovanie].png";
  const fileB = "160×600_·_Adform_-_publisher_—_PRODUCTION_[investovanie].png";
  fs.writeFileSync(path.join(adformDir, fileA), "fake-png-bytes");
  fs.writeFileSync(path.join(adformDir, fileB), "fake-png-bytes");

  const found = walkImageFiles(tmpRoot);
  assert.strictEqual(found.length, 2, "walkImageFiles must find PNGs nested inside a channel subfolder, got " + found.length);

  const candidates = buildCandidates(tmpRoot);
  const match600 = findActual({ id: "adform_300x600", baseline: "adform_300x600.png" }, candidates, tmpRoot);
  assert(match600 && match600.endsWith(fileA),
    "adform_300x600 must match the 300×600 file inside the Adform subfolder despite × vs x and dimension-first filename order, got " + match600);

  const match160 = findActual({ id: "adform_160x600", baseline: "adform_160x600.png" }, candidates, tmpRoot);
  assert(match160 && match160.endsWith(fileB),
    "adform_160x600 must match its own file, not the 300x600 one, got " + match160);

  // ── 3) genuinely missing entry must return null, never a wrong match ──
  const missing = findActual({ id: "adform_970x250", baseline: "adform_970x250.png" }, candidates, tmpRoot);
  assert.strictEqual(missing, null,
    "a format with no matching file anywhere must return null (the CLI turns this into a FAIL), got " + missing);
} finally {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}

// ── 4) freshness: README date parsing (both .txt and Corewake-style .html) ──
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "visual-regression-freshness-"));
  try {
    fs.writeFileSync(path.join(dir, "Export_README.txt"), "Date:      09/08/2026, 09:44 AM\nPlan: Free\n");
    const info = detectExportDate(dir, []);
    assert(info, "a README.txt with a Date: line must be detected");
    assert.strictEqual(info.date.getUTCFullYear(), 2026);
    assert.strictEqual(info.date.getUTCMonth(), 8, "September is month index 8");
    assert.strictEqual(info.date.getUTCDate(), 8);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
{
  // Corewake's actual README.html splits "Date:" and the value into
  // separate table cells — confirmed live against the real file on disk
  // (BulkExport_byCorewake_README.html). A naive regex on raw HTML fails
  // to find the date; tag-stripping must still recover it.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "visual-regression-freshness-html-"));
  try {
    fs.writeFileSync(path.join(dir, "Export_README.html"),
      "<html><body><table><tr><td>Date:</td><td>09/08/2026, 09:44 AM</td></tr></table></body></html>");
    const info = detectExportDate(dir, []);
    assert(info, "a Corewake-style README.html must still yield a detected date after tag-stripping");
    assert.strictEqual(info.date.getUTCDate(), 8);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
{
  // .txt must be preferred over .html when both exist (the .html's split
  // tags are a less reliable source than the plain-text file).
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "visual-regression-freshness-both-"));
  try {
    fs.writeFileSync(path.join(dir, "Export_README.txt"), "Date: 01/02/2026, 03:00 AM\n");
    fs.writeFileSync(path.join(dir, "Export_README.html"), "<td>Date:</td><td>09/08/2026, 09:44 AM</td>");
    const info = detectExportDate(dir, []);
    assert.strictEqual(path.extname(info.source), ".txt", "must prefer the .txt README over .html, got " + info.source);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ── 5) end-to-end CLI: a directory missing an expected format must FAIL
// and NAME the missing format — never a silent pass. Run as a real
// subprocess against the actual manifest, proving the whole pipeline, not
// just the internal helpers.
{
  const { spawnSync } = require("child_process");
  const partialDir = fs.mkdtempSync(path.join(os.tmpdir(), "visual-regression-cli-"));
  try {
    const adformDir = path.join(partialDir, "Adform");
    fs.mkdirSync(adformDir, { recursive: true });
    // Only 2 of the 4 baseline-covered Adform formats present — the other
    // 2 must be reported as missing, by name, and the process must exit
    // non-zero. Must be REAL, readable PNG bytes (pngjs throws on garbage
    // input) — the point of this test is the missing-format reporting for
    // the other two, not the pixel comparison of these.
    const { PNG } = require("pngjs");
    function tinyPngBuffer(w, h) {
      const png = new PNG({ width: w, height: h });
      png.data.fill(255);
      return PNG.sync.write(png);
    }
    fs.writeFileSync(path.join(adformDir, "300×600_·_Adform_-_publisher_—_PRODUCTION_[investovanie].png"), tinyPngBuffer(300, 600));
    fs.writeFileSync(path.join(adformDir, "160×600_·_Adform_-_publisher_—_PRODUCTION_[investovanie].png"), tinyPngBuffer(160, 600));

    const result = spawnSync(process.execPath, [require.resolve("../scripts/visual-regression.js"), partialDir], {
      encoding: "utf8"
    });
    assert.notStrictEqual(result.status, 0,
      "the CLI must exit non-zero when expected formats are missing, got status=" + result.status);
    const output = (result.stdout || "") + (result.stderr || "");
    assert(output.includes("adform_300x250"), "missing format adform_300x250 must be named in the output, got:\n" + output);
    assert(output.includes("adform_970x250"), "missing format adform_970x250 must be named in the output, got:\n" + output);
    assert(output.includes("Chýbajúce aktuálne exporty"), "output must explicitly call out the missing-exports summary");
  } finally {
    fs.rmSync(partialDir, { recursive: true, force: true });
    fs.rmSync(path.join(path.resolve(__dirname, ".."), "artifacts", "visual-diff"), { recursive: true, force: true });
  }
}

console.log("visual-regression.js gate: recursive search, ×/x + diacritic normalization, missing-format FAIL, README freshness: ok");
