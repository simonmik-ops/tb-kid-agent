// Regresia 9.9.2026: Meta (Facebook & Instagram) Automatic Placements na
// troch formátoch (1200×1200, 1200×628, 1080×1920) nesedelo s overenou
// Surďovou referenciou (z2gIXYePfNODOwmjecZwRB, frame 2:1135/2:1116/2:1099):
//   - logo malo tmavý variant namiesto bieleho (square/wide) / vôbec sa
//     nemalo kresliť (portrait)
//   - wide headline padal na pevnú pozíciu namiesto centrovania v
//     referenčnom kontajneri (krátky 1-riadkový text skončil na y=443)
//   - wide panel prekrýval fotku od x=540 namiesto referenčných x=746→882
//   - wide AI tag sa kotvil pod headline vpravo namiesto vľavo dole pri
//     fotke (x=50,y=553)
//   - portrait fotka bola fitovaná na 0..1080 namiesto oversized KV
//     (-303,-271,1686×1686), headline padal na y=1648 (~870px nižšie než
//     referencia)
//   - square headline nesedel v referenčnom kontajneri (60,887,843,262)
//
// Úzko orezané na format.channel === "Meta" + presné rozmery — iné kanály
// (topky.sk, Vinted, Httpool, ...) ani iné Meta rozmery nesmú byť
// zasiahnuté vôbec.
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync(require.resolve("../plugin/code.js"), "utf8");

function makeNode() {
  const node = {
    name: "", x: 0, y: 0, width: 0, height: 0, fills: [], children: [],
    fontName: null, fontSize: 0, characters: "", textAutoResize: "NONE",
    textAlignHorizontal: "LEFT", textAlignVertical: "TOP",
    lineHeight: null, letterSpacing: null, cornerRadius: 0, opacity: 1,
    resize: function (w, h) { this.width = w; this.height = h; },
    appendChild: function (child) { child.parent = this; this.children.push(child); },
    remove: function () {
      if (this.parent) {
        const i = this.parent.children.indexOf(this);
        if (i >= 0) this.parent.children.splice(i, 1);
      }
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
    createRectangle: makeNode,
    createEllipse: makeNode,
    createFrame: makeNode,
    createText: function () {
      const node = makeNode();
      let _chars = "", _height = 0, _width = 0, _autoResize = "NONE";
      Object.defineProperty(node, "characters", {
        get() { return _chars; }, set(v) { _chars = v; }
      });
      Object.defineProperty(node, "textAutoResize", {
        get() { return _autoResize; }, set(v) { _autoResize = v; }
      });
      Object.defineProperty(node, "height", {
        get() {
          if (_autoResize === "WIDTH_AND_HEIGHT") return this.fontSize ? Math.round(this.fontSize * 1.3) : 0;
          if (_autoResize === "HEIGHT" && this.fontSize && this.width) {
            const charsPerLine = Math.max(1, Math.floor(this.width / (this.fontSize * 0.55)));
            const lines = Math.max(1, Math.ceil(String(_chars).length / charsPerLine));
            return Math.ceil(lines * this.fontSize * 1.3);
          }
          return _height;
        },
        set(v) { _height = v; }
      });
      Object.defineProperty(node, "width", {
        get() {
          if (_autoResize === "WIDTH_AND_HEIGHT") return this.fontSize ? Math.round(String(_chars).length * this.fontSize * 0.55) : 0;
          return _width;
        },
        set(v) { _width = v; }
      });
      return node;
    },
    showUI: function () {},
    closePlugin: function () {},
    ui: { onmessage: null, postMessage: function () {} },
    root: { children: [] },
    currentPage: { children: [] }
  },
  console: console
};
vm.createContext(context);
vm.runInContext(source + "\nthis.buildMasterSafeLayout = buildMasterSafeLayout;", context);

function alphaAt(position, stops) {
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i], b = stops[i + 1];
    if (position >= a.position && position <= b.position) {
      const t = (position - a.position) / (b.position - a.position || 1);
      return a.color.a + t * (b.color.a - a.color.a);
    }
  }
  return stops[stops.length - 1].color.a;
}

function runMeta(width, height, opts) {
  opts = opts || {};
  const frame = makeNode();
  frame.width = width;
  frame.height = height;
  const format = Object.assign({ width, height, channel: "Meta" }, opts.format || {});
  const layout = Object.assign({
    show_headline: true, show_logo: true, show_cta: false, show_legal: true,
    show_subheadline: true
  }, opts.layout || {});
  const content = Object.assign({
    headline: "Začnite investovať", subheadline: "už od 50 EUR s InvestQ appkou",
    ctaText: null, legalText: "Marketingové oznámenie. S investovaním sú spojené riziká.",
    badgeText: null, aiGenerated: true
  }, opts.content || {});
  context.__frame = frame;
  context.__format = format;
  context.__layout = layout;
  context.__content = content;
  context.__figmaImage = { hash: "fake-image" };
  context.__figmaLogo = { hash: "fake-logo-dark" };
  context.__figmaLogoWhite = { hash: "fake-logo-white" };
  vm.runInContext(
    "buildMasterSafeLayout(__frame, __format, __layout, __content, __figmaImage, {width:1000,height:1000}, __figmaLogo, {x:0,y:0,w:__format.width,h:__format.height}, __figmaLogoWhite);",
    context
  );
  return frame;
}

// ── 1200×628 (wide) ─────────────────────────────────────────────────────
{
  const frame = runMeta(1200, 628);
  const headline = frame.findOne((n) => n.name === "Headline");
  const subheadline = frame.findOne((n) => n.name === "Subheadline");
  const logo = frame.findOne((n) => n.name === "Logo");
  const ai = frame.findOne((n) => n.name === "AI generované");
  const panel = frame.findOne((n) => n.name === "Wide content panel");

  assert(headline && subheadline && logo && ai && panel, "1200x628: all expected nodes must be drawn");

  // Headline+subheadline group must sit inside the reference container
  // (646,146,503,300), not at a fixed bottom-anchored y (old bug: y=443).
  assert(headline.x === 646, "1200x628: headline x must be the reference container x=646, got " + headline.x);
  assert(headline.y >= 146 && headline.y + headline.height <= 446,
    "1200x628: headline must stay inside the reference container (y=146..446), got y=" + headline.y + "..." + (headline.y + headline.height));
  assert(subheadline.y + subheadline.height <= 446,
    "1200x628: subheadline must stay inside the reference container (bottom<=446), got bottom=" + (subheadline.y + subheadline.height));

  // Logo must use the white variant (fake-logo-white), not the dark one.
  assert.strictEqual(logo.fills[0].imageHash, "fake-logo-white",
    "1200x628: logo must use the white variant per reference");

  // AI tag: fixed bottom-left near the photo (x=50,y=553), not under the headline.
  assert.strictEqual(ai.x, 50, "1200x628: AI tag x must be 50 (bottom-left near photo), got " + ai.x);
  assert.strictEqual(ai.y, 553, "1200x628: AI tag y must be 553, got " + ai.y);

  // Panel must start at x=746 (reference "prechod"), not the generic x=540,
  // and reach full opacity by x=882 (reference VIZUAL-BACKGROUND start).
  assert.strictEqual(panel.x, 746, "1200x628: panel must start at the reference x=746, not the generic 540, got " + panel.x);
  const stops = panel.fills[0].gradientStops;
  const boundaryPos = (882 - 746) / (1200 - 746);
  assert(alphaAt(boundaryPos, stops) >= 0.99,
    "1200x628: panel must reach full opacity by x=882 (reference), got alpha=" + alphaAt(boundaryPos, stops).toFixed(3));
  assert(alphaAt(0, stops) <= 0.01,
    "1200x628: panel must be fully transparent at its own left edge (x=746), so the photo is visible up to there");
}

// ── 1080×1920 (portrait) ────────────────────────────────────────────────
{
  const frame = runMeta(1080, 1920);
  const headline = frame.findOne((n) => n.name === "Headline");
  const subheadline = frame.findOne((n) => n.name === "Subheadline");
  const logo = frame.findOne((n) => n.name === "Logo");
  const ai = frame.findOne((n) => n.name === "AI generované");
  const kv = frame.findOne((n) => n.name === "Key visual — protected full master");
  const panel = frame.findOne((n) => n.name === "Adaptive portrait content panel");

  assert(headline && kv && panel && ai, "1080x1920: headline/KV/panel/AI must all be drawn");
  assert(!logo, "1080x1920: reference layout has no visible logo — none must be drawn");

  // KV must match the reference VIZUAL-KV exactly, not the old 0..1080 fit.
  assert.strictEqual(kv.x, -303, "1080x1920: KV x must be reference -303, got " + kv.x);
  assert.strictEqual(kv.y, -271, "1080x1920: KV y must be reference -271, got " + kv.y);
  assert.strictEqual(kv.width, 1686, "1080x1920: KV width must be reference 1686, got " + kv.width);
  assert.strictEqual(kv.height, 1686, "1080x1920: KV height must be reference 1686, got " + kv.height);

  // Panel must start at the reference y=780, not the old ~1080/1097.
  assert.strictEqual(panel.y, 780, "1080x1920: panel y must be reference 780, got " + panel.y);

  // Headline must sit inside the reference container (71,777,938,376),
  // centered horizontally — not at the old y=1648 (~870px lower).
  assert.strictEqual(headline.x, 71, "1080x1920: headline x must be reference container x=71, got " + headline.x);
  assert(headline.y >= 777 && headline.y + headline.height <= 1153,
    "1080x1920: headline must stay inside the reference container (y=777..1153), got y=" + headline.y + "..." + (headline.y + headline.height) +
    " (old bug: y=1648)");
  assert.strictEqual(headline.textAlignHorizontal, "CENTER", "1080x1920: headline must be horizontally centered per reference");

  // AI tag centered horizontally on frame width, at reference y=1189.
  assert.strictEqual(ai.y, 1189, "1080x1920: AI tag y must be reference 1189, got " + ai.y);
  const aiCenter = ai.x + ai.width / 2;
  assert(Math.abs(aiCenter - 1080 / 2) <= 2,
    "1080x1920: AI tag must be centered on frame width (540), got center=" + aiCenter);
}

// ── 1200×1200 (square) ──────────────────────────────────────────────────
{
  const frame = runMeta(1200, 1200);
  const headline = frame.findOne((n) => n.name === "Headline");
  const subheadline = frame.findOne((n) => n.name === "Subheadline");
  const logo = frame.findOne((n) => n.name === "Logo");

  assert(headline && logo, "1200x1200: headline and logo must be drawn");

  assert.strictEqual(headline.x, 60, "1200x1200: headline x must be reference container x=60, got " + headline.x);
  assert(headline.y >= 887 && headline.y + headline.height <= 1149,
    "1200x1200: headline must stay inside the reference container (y=887..1149), got y=" + headline.y + "..." + (headline.y + headline.height));
  if (subheadline) {
    assert(subheadline.y + subheadline.height <= 1149,
      "1200x1200: subheadline must stay inside the reference container (bottom<=1149)");
  }
  assert.strictEqual(logo.fills[0].imageHash, "fake-logo-white",
    "1200x1200: logo must use the white variant per reference");
}

console.log("Meta Automatic Placements composition (9.9.2026): ok");
