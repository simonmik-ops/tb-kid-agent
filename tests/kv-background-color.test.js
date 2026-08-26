// Zadanie 26.8, blok A: kvBackgroundColor() v plugin/ui.html už nesmie brať
// medián z dvoch najsvetlejších horných rohov KV (P0-A1 bug — #F87B66 na
// referenčnom KID KV namiesto skutočnej #C55E4D kampaňovej plochy). Namiesto
// pixel-presného testu na reálnej fotke (mimo repa, canvas-resize v
// prehliadači sa aj tak mierne líši od Node/sharp simulácie použitej pri
// manuálnom overovaní — pozri commit message) tento test overuje princíp na
// syntetickom 64×64 obrázku so známymi zložkami:
//   - široká stredná farba pozadia (to, čo chceme dostať späť)
//   - malý svetlý "highlight" pás (nasvietená stena)
//   - malý tmavý roh (rohový tieň)
//   - stredový blok inej farby (simuluje subjekt) — musí byť mimo vzorky
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const html = fs.readFileSync(require.resolve("../plugin/ui.html"), "utf8");
const start = html.indexOf("async function kvBackgroundColor");
const end = html.indexOf("async function kvBottomLuma", start);
assert(start >= 0 && end > start, "kvBackgroundColor must exist in ui.html");
const source = html.slice(start, end);

assert(!/blok = 12/.test(source), "old two-corner sampling block must be gone");
assert(/marginPx/.test(source) && /dropDark/.test(source) && /dropLight/.test(source),
  "new perimeter-sample + asymmetric-trim algorithm must be present");

function buildContext() {
  const W = 64, H = 64;
  const data = new Uint8ClampedArray(W * H * 4);
  const MID = [197, 94, 77]; // #C55E4D — cielova kampanova farba
  const HIGHLIGHT = [248, 123, 102]; // #F87B66 — stary bug (nasvietena stena)
  const SHADOW = [30, 15, 12]; // rohovy tien
  const SUBJECT = [30, 40, 120]; // stredovy "subjekt" — nesmie ovplyvnit vysledok

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let c = MID;
      if (y < 5) c = HIGHLIGHT; // horny pas = highlight (stary bug tu vzorkoval)
      if (x >= W - 5 && y >= H - 5) c = SHADOW; // maly rohovy tien
      const marginPx = Math.round(W * 0.15);
      if (x >= marginPx && x < W - marginPx && y >= marginPx && y < H - marginPx) c = SUBJECT;
      const i = (y * W + x) * 4;
      data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
    }
  }

  const context = {
    createImageBitmap: async () => ({ width: W, height: H }),
    document: {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({
          drawImage: () => {},
          getImageData: () => ({ data: data })
        })
      })
    }
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context;
}

(async function () {
  const context = buildContext();
  const result = await context.kvBackgroundColor({});
  assert(result, "must return a colour for a valid image");

  const got = { r: Math.round(result.r * 255), g: Math.round(result.g * 255), b: Math.round(result.b * 255) };
  const target = { r: 197, g: 94, b: 77 };
  const maxDelta = Math.max(
    Math.abs(got.r - target.r), Math.abs(got.g - target.g), Math.abs(got.b - target.b)
  );
  assert(maxDelta <= 5,
    "median of trimmed perimeter sample must recover the background colour, got #" +
    [got.r, got.g, got.b].map((v) => v.toString(16).padStart(2, "0")).join("") +
    " expected close to #c55e4d");

  // Regresia proti staremu bugu: highlight (#f87b66) nesmie vyhrat.
  const highlightDelta = Math.abs(got.r - 248) + Math.abs(got.g - 123) + Math.abs(got.b - 102);
  assert(highlightDelta > 20, "result must not collapse back onto the highlight-corner colour");

  console.log("kv background colour derivation: ok");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
