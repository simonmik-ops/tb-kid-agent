#!/usr/bin/env node
// Vizuálna regresia proti tests/visual-baselines/manifest.json.
//
// 13.9.2026 oprava troch reálnych chýb (diagnostika: qa:presentation gate):
//   1. findActual() čítalo len actualDir samotný (fs.readdirSync bez
//      rekurzie) — reálne bulk exporty (napr. BulkExport_byCorewake) majú
//      každý kanál vo vlastnom podpriečinku, takže sa nenašiel NIČ, aj keď
//      export reálne existoval.
//   2. Normalizácia porovnávala len ASCII "x" (entry.id.match(/\d+x\d+/i)),
//      nie "×" (multiplication sign, U+00D7), ktorý reálne Figma bulk
//      exporty v názve súboru používajú ("1200×628"), takže sa rozmer
//      nikdy nenašiel zhodný, aj keď názov súboru rozmer obsahoval.
//   3. Prefix matching predpokladal pevné poradie "kanál+rozmer" (z
//      entry.id, napr. "adform300x600"), ale reálne názvy súborov majú
//      rozmer PRVÝ ("300×600_·_Adform_..."), takže sa join nezhodoval ani
//      keď oba tokeny reálne v mene boli.
//
// Táto oprava nemení sémantiku "chýbajúci súbor = FAIL" (bolo už predtým
// správne) — len robí "actualPath" hľadanie schopné reálne NÁJSŤ súbor,
// ktorý reálne existuje, takže "chýba" znamená naozaj chýba, nie "skript
// nevedel hľadať".
//
// Čisté funkcie nižšie sú exportované (module.exports), aby ich vedel
// priamo zavolať tests/visual-regression-gate.test.js — CLI beh (spodná
// časť súboru) sa spúšťa len keď je tento súbor spustený priamo
// (require.main === module), nie keď ho test požiada cez require().
const fs = require("fs");
const path = require("path");

// Export sa považuje za "čerstvý", ak je novší než tento počet hodín — inak
// FAIL (nie tiché prijatie ako aktuálny dôkaz). Konfigurovateľné cez env,
// nech sa dá naladiť bez úpravy kódu. 48h pokrýva bežný "večer export,
// ráno spustený gate" prípad a zároveň odmietne export starý niekoľko dní
// (namerané reálne: BulkExport_byCorewake, README "Date: 09/08/2026,
// 09:44 AM" — presne ten prípad, ktorý zadanie žiada odmietnuť pre dávku
// 173:*, keďže dnešný dátum je výrazne neskôr).
const MAX_EXPORT_AGE_HOURS = Number(process.env.QA_EXPORT_MAX_AGE_HOURS || 48);

// Rekurzívne nájde všetky PNG/JPG súbory pod dir — bulk exporty majú každý
// kanál vo vlastnom podpriečinku (napr. "Adform/300×600_·_....png").
function walkImageFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    let entries;
    try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch (e) { continue; }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (/\.(png|jpe?g)$/i.test(entry.name)) out.push(full);
    }
  }
  return out;
}

// "×" (U+00D7) -> "x", diakritika preč (č/á/ý/ô/... -> c/a/y/o/...), malé
// písmená, všetko nealfanumerické na medzeru — takže "1200×628" aj
// "1200x628", "čistý_vizuál" aj "cisty-vizual" normalizujú na to isté.
function normalizeToken(value) {
  return String(value)
    .replace(/×/g, "x")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildCandidates(actualDir) {
  return walkImageFiles(actualDir).map((file) => ({
    file,
    normalized: normalizeToken(path.relative(actualDir, file))
  }));
}

// Zhoda podľa VŠETKÝCH tokenov z entry.id (napr. "adform_300x600" ->
// ["adform","300x600"]) prítomných KDEKOĽVEK v normalizovanej relatívnej
// ceste (priečinok + súbor) — nezávisle od poradia, na rozdiel od pôvodnej
// pevnej "kanál+rozmer" konkatenácie, ktorá sa nezhodovala s reálnym
// poradím súborov ("rozmer_·_kanál_...").
function findActual(entry, candidates, actualDir, onAmbiguous) {
  const exact = path.join(actualDir, entry.actual || entry.baseline);
  if (fs.existsSync(exact)) return exact;
  const needleTokens = normalizeToken(entry.id).split(" ").filter(Boolean);
  if (!needleTokens.length) return null;
  const matches = candidates.filter((c) => needleTokens.every((t) => c.normalized.includes(t)));
  if (!matches.length) return null;
  // Viac zhôd (napr. rovnaký rozmer vo viacerých kanáloch) — vyber
  // najkratšiu normalizovanú cestu (najtesnejšia zhoda), ale nahlás, že
  // to bolo nejednoznačné, nech sa to dá overiť ručne.
  matches.sort((a, b) => a.normalized.length - b.normalized.length);
  if (matches.length > 1 && typeof onAmbiguous === "function") {
    onAmbiguous(entry, matches);
  }
  return matches[0].file;
}

// Dátum exportu — prednostne z "Bulk Export by Corewake"-štýl README
// ("Date: MM/DD/YYYY, HH:MM AM/PM") priamo v koreni actualDir, inak
// najnovší mtime medzi nájdenými obrázkami. README dátum je spoľahlivejší
// (nezávislý od kopírovania/zip/unzip, ktoré mtime často prepíšu na "teraz").
function detectExportDate(actualDir, candidates) {
  if (fs.existsSync(actualDir)) {
    // Preferuj .txt pred .html — Corewake README.html rozdeľuje "Date:" a
    // hodnotu do samostatných tagov (napr. <td>Date:</td><td>09/08/2026,
    // 09:44 AM</td>), takže priamy regex na surový HTML reťazec zlyhá
    // (namerané naživo: BulkExport_byCorewake_README.html). .txt verzia je
    // čistý text presne v tvare "Date: MM/DD/YYYY, HH:MM AM/PM" — spustí sa
    // vždy, keď existuje, .html len ako fallback so stripnutými tagmi.
    const readmeNames = fs.readdirSync(actualDir)
      .filter((n) => /readme/i.test(n) && /\.(txt|html?)$/i.test(n))
      .sort((a, b) => (/\.txt$/i.test(a) ? -1 : 1) - (/\.txt$/i.test(b) ? -1 : 1));
    for (const readmeName of readmeNames) {
      try {
        let content = fs.readFileSync(path.join(actualDir, readmeName), "utf8");
        if (/\.html?$/i.test(readmeName)) content = content.replace(/<[^>]+>/g, " ");
        const m = content.match(/Date:\s*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4}),?\s*([0-9]{1,2}:[0-9]{2}\s*[AP]M)?/i);
        if (m) {
          const parsed = new Date(m[1] + (m[2] ? " " + m[2] : ""));
          if (!isNaN(parsed.getTime())) return { date: parsed, source: readmeName };
        }
      } catch (e) { /* skús ďalší README kandidát / padni na mtime */ }
    }
  }
  if (!candidates.length) return null;
  let newest = 0;
  for (const c of candidates) {
    const mtime = fs.statSync(c.file).mtimeMs;
    if (mtime > newest) newest = mtime;
  }
  return newest ? { date: new Date(newest), source: "súborový mtime (žiadny README dátum)" } : null;
}

module.exports = { walkImageFiles, normalizeToken, buildCandidates, findActual, detectExportDate, MAX_EXPORT_AGE_HOURS };

if (require.main === module) {
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

  if (!fs.existsSync(manifestPath)) {
    fail("chýba baseline manifest " + manifestPath);
  } else {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    fs.mkdirSync(diffDir, { recursive: true });
    let compared = 0;
    let failed = 0;
    const missing = [];

    const candidates = buildCandidates(actualDir);

    process.stdout.write("Actual export dir: " + actualDir + " (" + candidates.length + " obrázkov nájdených rekurzívne)\n");

    const exportInfo = detectExportDate(actualDir, candidates);
    if (exportInfo) {
      const ageHours = (Date.now() - exportInfo.date.getTime()) / 3600000;
      process.stdout.write(
        "Export dátum: " + exportInfo.date.toISOString() + " (zdroj: " + exportInfo.source + "), vek " +
        ageHours.toFixed(1) + "h\n"
      );
      if (ageHours > MAX_EXPORT_AGE_HOURS) {
        fail(
          "export je starý " + ageHours.toFixed(1) + "h (limit " + MAX_EXPORT_AGE_HOURS +
          "h) — ODMIETNUTÝ ako dôkaz pre aktuálnu dávku. Zdroj dátumu: " + exportInfo.source +
          ". Vygeneruj čerstvý export a spusť znova."
        );
      }
    } else if (candidates.length) {
      process.stdout.write("Export dátum: nezistiteľný (žiadny README, žiadny súbor na zmeranie mtime)\n");
    }

    const onAmbiguous = (entry, matches) => {
      process.stdout.write(
        "  (poznámka: " + entry.id + " sa zhodovalo s " + matches.length + " súbormi, použitý najtesnejší: " +
        path.relative(actualDir, matches[0].file) + ")\n"
      );
    };

    for (const entry of manifest.entries || []) {
      const baselinePath = path.join(baselineDir, entry.baseline);
      const actualPath = findActual(entry, candidates, actualDir, onAmbiguous);
      if (!fs.existsSync(baselinePath)) {
        fail(entry.id + ": chýba baseline " + baselinePath);
        failed++;
        continue;
      }
      if (!actualPath) {
        fail(entry.id + ": chýba AKTUÁLNY export (hľadané rekurzívne v " + actualDir + ", žiadny súbor nezodpovedal)");
        missing.push(entry.id);
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
        process.stdout.write(`PASS ${entry.id}: ${(ratio * 100).toFixed(2)} % rozdiel (${path.relative(actualDir, actualPath)})\n`);
      }
    }

    process.stdout.write("\nPorovnaných: " + compared + " / " + (manifest.entries || []).length + " manifest záznamov.\n");
    if (missing.length) {
      process.stdout.write("Chýbajúce aktuálne exporty (FAIL): " + missing.join(", ") + "\n");
    }
    if (!failed && compared > 0) {
      process.stdout.write(`Visual regression: ${compared} referencií prešlo.\n`);
    } else if (!failed && compared === 0) {
      // Manifest existuje, ale nemá žiadne záznamy — nie je čo porovnať.
      // Toto NIE JE tichý úspech: nulový počet porovnaní sa musí vidieť.
      process.stdout.write("Visual regression: 0 záznamov v manifeste — nič sa neporovnalo.\n");
    }
  }
}
