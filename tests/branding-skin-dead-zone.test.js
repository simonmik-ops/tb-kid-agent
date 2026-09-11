// Regresia 11.9.2026 (P0-24): buildBrandingSkinLayout kreslilo KV ako
// jediný "Background image" FILL cez CELÝ rám (0,0,format.width,
// format.height) — vrátane centrálnej "mŕtvej zóny", ktorú publisher
// (Markíza/JOJ) prekryje vlastným webom (safeZones.centerWidth +
// topOffset). Na 2000×1400 to znamená: tvár aj headline grafika v strede
// KV skončia presne v obdĺžniku x[500,1500] y[200,1400], ktorý v produkcii
// nikto neuvidí.
//
// safeZoneRect/resolveContentBox (inde v tomto súbore) tú istú
// centerWidth/topOffset dvojicu už interpretuje správne opačne — obsah
// (text) patrí do bočného pásu MIMO zóny. Táto oprava zosúlaďuje obrázok s
// tým istým pravidlom: žiadny image node nesmie zasahovať do
// x[(W-centerWidth)/2, (W+centerWidth)/2] × y[topOffset, H].
//
// Rozsah (úloha A): LEN toto — mŕtva zóna musí byť čistá kampaňová farba,
// bez fotky, bez gradientu. ČO presne je v bočných pásoch/hornom páse
// namiesto toho je úloha B — vedome nerozhodnutá, čaká na Simonu/Surďa
// (B-8). Táto oprava preto zachováva fotku v hornom páse (y 0..topOffset,
// celá šírka — TEN nie je súčasť mŕtvej zóny, tá začína až pri
// y=topOffset) a v oboch bočných stĺpcoch, len ako tri samostatné FILL
// orezy namiesto jedného cez celý rám — vizuálne najbližšie k pôvodnému
// stavu, žiadne nové dizajnové rozhodnutie o tom, čo bočné pásy majú
// obsahovať.
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync(require.resolve("../plugin/code.js"), "utf8");

function makeNode() {
  const node = {
    name: "", x: 0, y: 0, width: 0, height: 0, fills: [], children: [], visible: true,
    fontName: null, fontSize: 0, characters: "", textAutoResize: "NONE",
    resize: function (w, h) { this.width = w; this.height = h; },
    appendChild: function (child) { child.parent = this; this.children.push(child); },
    remove: function () {},
    findAll: function (pred) {
      const out = [];
      for (const c of this.children) {
        if (pred(c)) out.push(c);
        if (c.findAll) out.push(...c.findAll(pred));
      }
      return out;
    },
    findOne: function (pred) {
      for (const c of this.children) {
        if (pred(c)) return c;
        const found = c.findOne ? c.findOne(pred) : null;
        if (found) return found;
      }
      return null;
    }
  };
  return node;
}

const context = {
  __html__: "<html></html>",
  figma: {
    createRectangle: makeNode, createFrame: makeNode, createText: makeNode,
    showUI: function () {}, closePlugin: function () {},
    ui: { onmessage: null, postMessage: function () {} },
    root: { children: [] }, currentPage: { children: [] }
  },
  console: console
};
vm.createContext(context);
vm.runInContext(source + "\nthis.buildBrandingSkinLayout = buildBrandingSkinLayout;", context);

function rectOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.width > b.x &&
    a.y < b.y + b.h && a.y + a.height > b.y;
}

function run(width, height, safeZones) {
  const frame = makeNode();
  frame.width = width; frame.height = height;
  const format = { width, height, safeZones };
  const layout = { show_headline: true, show_logo: true, show_cta: true };
  context.__frame = frame; context.__format = format; context.__layout = layout;
  context.__headline = "Investovanie s Tatra bankou"; context.__ctaText = "Zistiť viac";
  context.__figmaImage = { hash: "fake-kv" }; context.__figmaLogo = { hash: "fake-logo" };
  vm.runInContext(
    "buildBrandingSkinLayout(__frame, __format, __layout, __headline, __ctaText, __figmaImage, __figmaLogo);",
    context
  );
  return frame;
}

// kkv_markiza_branding_full / kkv_joj_branding / bsu_joj_branding: 2000×1400,
// safeZones { centerWidth: 1000, topOffset: 200 }.
{
  const frame = run(2000, 1400, { centerWidth: 1000, topOffset: 200 });
  const deadZone = { x: 500, y: 200, w: 1000, h: 1200 };
  const images = frame.findAll((n) => Array.isArray(n.fills) && n.fills.some((f) => f.type === "IMAGE"));
  assert(images.length > 0, "2000x1400: at least one KV image node must be drawn");
  for (const img of images) {
    assert(!rectOverlap(img, deadZone),
      "2000x1400: image node '" + img.name + "' " + JSON.stringify({ x: img.x, y: img.y, w: img.width, h: img.height }) +
      " must not overlap the publisher dead zone " + JSON.stringify(deadZone));
  }

  // Overí, že mimo mŕtvej zóny fotka stále reálne je (nejde o regresiu
  // opačným smerom — úplné vypnutie fotky by tiež "prešlo" testom vyššie).
  const coversLeftColumn = images.some((img) =>
    img.x <= 0 && img.x + img.width >= 500 && img.y <= 200 && img.y + img.height >= 1400 - 1);
  const coversRightColumn = images.some((img) =>
    img.x <= 1500 && img.x + img.width >= 2000 && img.y <= 200 && img.y + img.height >= 1400 - 1);
  assert(coversLeftColumn, "2000x1400: left publisher-visible column (0..500, 200..1400) must still show KV imagery");
  assert(coversRightColumn, "2000x1400: right publisher-visible column (1500..2000, 200..1400) must still show KV imagery");
}

// tig_games_branding: 1920×1080, safeZones { centerWidth: 1000, topOffset: 100 }.
{
  const frame = run(1920, 1080, { centerWidth: 1000, topOffset: 100 });
  const deadZone = { x: 460, y: 100, w: 1000, h: 980 };
  const images = frame.findAll((n) => Array.isArray(n.fills) && n.fills.some((f) => f.type === "IMAGE"));
  for (const img of images) {
    assert(!rectOverlap(img, deadZone),
      "1920x1080: image node '" + img.name + "' must not overlap the publisher dead zone, got " +
      JSON.stringify({ x: img.x, y: img.y, w: img.width, h: img.height }));
  }
}

// ── Task C: qa_subject_in_dead_zone must actually catch the P0-24 bug ────
// Tested in isolation from the builder (real validateGeneratedFrame(), a
// synthetic frame) — before this fix, NO check compared image position to
// the dead zone at all, so a full-bleed image passed QA silently.
vm.runInContext("this.validateGeneratedFrame = validateGeneratedFrame;", context);
function makeQaFrame(imageBoxes) {
  const frame = makeNode();
  frame.width = 2000; frame.height = 1400; frame.clipsContent = true;
  for (const box of imageBoxes) {
    const img = makeNode();
    img.name = "Background image"; img.x = box.x; img.y = box.y; img.width = box.w; img.height = box.h;
    img.fills = [{ type: "IMAGE", imageHash: "kv" }];
    frame.appendChild(img);
  }
  return frame;
}
function runQa(frame, safeZones) {
  const format = { width: 2000, height: 1400, safeZones };
  const layout = {};
  const content = { headline: null, subheadline: null, ctaText: null, legalText: null, badgeText: null, hasLogo: false };
  context.__frame = frame; context.__format = format; context.__layout = layout; context.__content = content;
  return vm.runInContext(
    "validateGeneratedFrame(__frame, __format, __layout, \"branding_skin\", __content, null);",
    context
  );
}

const buggyFrame = makeQaFrame([{ x: 0, y: 0, w: 2000, h: 1400 }]); // the exact P0-24 shape
const buggyQa = runQa(buggyFrame, { centerWidth: 1000, topOffset: 200 });
assert(buggyQa.issues.includes("qa_subject_in_dead_zone"),
  "a full-bleed image over the dead zone must be flagged as qa_subject_in_dead_zone, got " + JSON.stringify(buggyQa.issues));

const fixedFrame = makeQaFrame([
  { x: 0, y: 0, w: 2000, h: 200 },
  { x: 0, y: 200, w: 500, h: 1200 },
  { x: 1500, y: 200, w: 500, h: 1200 }
]);
const fixedQa = runQa(fixedFrame, { centerWidth: 1000, topOffset: 200 });
assert(!fixedQa.issues.includes("qa_subject_in_dead_zone"),
  "three images that avoid the dead zone must NOT be flagged, got " + JSON.stringify(fixedQa.issues));

const noZoneFrame = makeQaFrame([{ x: 0, y: 0, w: 2000, h: 1400 }]);
const noZoneQa = runQa(noZoneFrame, { top: 0, bottom: 0 });
assert(!noZoneQa.issues.includes("qa_subject_in_dead_zone"),
  "formats without a declared centerWidth/topOffset dead zone must never flag this, got " + JSON.stringify(noZoneQa.issues));

console.log("branding_skin KV must not cover the publisher dead zone (P0-24): ok");
