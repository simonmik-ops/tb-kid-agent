// Regresia 10.9.2026 (zadanie E, buildSideSafeLayout — 120x600/160x600/
// 450x800 bocny branding "skyscraper"): logo sedelo hore vlavo (x+pad,y+pad)
// a AI disclosure tag (addAiNote, oddelene v orchestracii po tomto builderi)
// koncil NAD CTA namiesto pod nim - namerane na zivom vystupe: 120x600 logo
// na (12,12); AI y=524, CTA y=544 (AI nad CTA, presny opak referencie).
//
// REFERENCIA_Surdo_hodnoty_18_8.md kap. 4 (300x600): CTA y=514, logo y=514 -
// "CTA a logo su zarovnane na tu istu zakladnu, tvoria jednu liniu", AI tag
// y=568 (pod obomi). Tento test overuje presne tuto geometriu cez skutocny
// buildSideSafeLayout() + addAiNote() (rovnaka volacia postupnost ako
// orchestracia pouziva pre layoutType "side_safe").
//
// Dolezity detail (zistene az pri overovani tejto opravy): placeLogo()
// vynucuje min. 50 px na mensom rozmere loga (dotaznik) - pri uzkych
// formatoch (120x600) je poziadovana vyska loga (<=btnH, typicky <50px)
// mensia nez toto minimum, takze placeLogo() logo DORASTIE nad poziadovanu
// vysku. Ak by sa "zakladna" pocitala z POZIADOVANEJ vysky (pred dorovnanim),
// skutocne logo by preteklo pod CTA aj do AI rezervy. Test preto overuje
// zdielanu ZAKLADNU (spodnu hranu), nie hornu y-suradnicu, a pocita s
// realnym (post-rescale) rozmerom loga.
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
    remove: function () {
      if (this.parent) { const i = this.parent.children.indexOf(this); if (i >= 0) this.parent.children.splice(i, 1); }
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

function makeContext() {
  const context = {
    __html__: "<html></html>",
    figma: {
      createRectangle: makeNode, createFrame: makeNode,
      createText: function () {
        const node = makeNode();
        let _chars = "", _height = 0, _width = 0, _autoResize = "NONE";
        Object.defineProperty(node, "characters", { get() { return _chars; }, set(v) { _chars = v; } });
        Object.defineProperty(node, "textAutoResize", { get() { return _autoResize; }, set(v) { _autoResize = v; } });
        Object.defineProperty(node, "height", {
          get() {
            if (_autoResize === "WIDTH_AND_HEIGHT") return this.fontSize ? Math.round(this.fontSize * 1.3) : 0;
            if (_autoResize === "HEIGHT" && this.fontSize && this.width) {
              const cpl = Math.max(1, Math.floor(this.width / (this.fontSize * 0.55)));
              const lines = Math.max(1, Math.ceil(String(_chars).length / cpl));
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
        node.type = "TEXT";
        return node;
      },
      showUI: function () {}, closePlugin: function () {},
      ui: { onmessage: null, postMessage: function () {} },
      root: { children: [] }, currentPage: { children: [] }
    },
    console: console
  };
  vm.createContext(context);
  vm.runInContext(
    source +
      "\nthis.buildSideSafeLayout = buildSideSafeLayout;" +
      "\nthis.addAiNote = addAiNote;" +
      "\nthis.resolveSideSafeContentBox = resolveSideSafeContentBox;" +
      "\nthis.AI_ON = true;",
    context
  );
  vm.runInContext("AI_ON = true;", context);
  return context;
}

// Presne ta ista postupnost, akou orchestracia vola side_safe (viď
// createAllFrames): builder najprv, potom addAiNote s panelovym contentBoxom
// odvodenym z resolveSideSafeContentBox (nie z celeho frame-u).
function run(context, width, height, layout, ctaText, hasLogo) {
  const frame = makeNode();
  frame.width = width; frame.height = height;
  const format = { width, height };
  context.__frame = frame; context.__format = format; context.__layout = layout;
  context.__headline = "Investovanie s Tatra bankou";
  context.__ctaText = ctaText;
  context.__figmaImage = null;
  context.__figmaLogo = hasLogo ? { hash: "fake-logo" } : null;
  vm.runInContext(
    "buildSideSafeLayout(__frame, __format, __layout, __headline, __ctaText, __figmaImage, __figmaLogo);",
    context
  );
  vm.runInContext(
    "var b = resolveSideSafeContentBox(__format); addAiNote(__frame, __format, { x: b.panelX, y: b.panelY, w: b.panelW, h: b.panelH });",
    context
  );
  return frame;
}

for (const [w, h] of [[120, 600], [160, 600], [450, 800]]) {
  const context = makeContext();
  const layout = { show_headline: true, show_logo: true, show_cta: true, show_ai_disclosure: true };
  const frame = run(context, w, h, layout, "Zistiť viac", true);

  const logo = frame.findOne((n) => n.name === "Logo");
  const cta = frame.findOne((n) => n.name === "CTA button");
  const ai = frame.findOne((n) => n.name === "AI generované");
  const headline = frame.findOne((n) => n.name === "Headline");

  assert(logo, w + "x" + h + ": logo must be drawn");
  assert(cta, w + "x" + h + ": CTA button must be drawn");
  assert(ai, w + "x" + h + ": AI disclosure tag must be drawn");

  // Logo v pravom dolnom rohu panelu, nie hore vlavo (stary bug: 12,12).
  assert(logo.x >= cta.x + cta.width,
    w + "x" + h + ": logo must sit to the right of CTA, got logo.x=" + logo.x + " cta.right=" + (cta.x + cta.width));
  assert(logo.y > h / 2,
    w + "x" + h + ": logo must be anchored in the bottom half of the format, not top-left, got logo.y=" + logo.y);

  // CTA a logo zdielaju jednu "zakladnu" (spodnu hranu) - jedna linia.
  assert.strictEqual(logo.y + logo.height, cta.y + cta.height,
    w + "x" + h + ": logo and CTA must share the same bottom edge (baseline), got logo.bottom=" +
    (logo.y + logo.height) + " cta.bottom=" + (cta.y + cta.height));

  // AI tag pod obomi (logo aj CTA), nie nad nimi (stary bug: AI y=524 < CTA y=544).
  assert(ai.y >= cta.y + cta.height,
    w + "x" + h + ": AI tag must sit below CTA, got ai.y=" + ai.y + " cta.bottom=" + (cta.y + cta.height));
  assert(ai.y >= logo.y + logo.height,
    w + "x" + h + ": AI tag must sit below logo, got ai.y=" + ai.y + " logo.bottom=" + (logo.y + logo.height));

  // Headline nesmie prerastat do CTA/logo riadku.
  assert(headline.y + headline.height <= cta.y,
    w + "x" + h + ": headline must not overlap the CTA/logo row, got headline.bottom=" +
    (headline.y + headline.height) + " cta.y=" + cta.y);
}

// Bez CTA (len logo) - logo stale vpravo dole, AI stale pod nim.
{
  const context = makeContext();
  const layout = { show_headline: true, show_logo: true, show_cta: false, show_ai_disclosure: true };
  const frame = run(context, 120, 600, layout, null, true);
  const logo = frame.findOne((n) => n.name === "Logo");
  const ai = frame.findOne((n) => n.name === "AI generované");
  assert(logo, "no-CTA: logo must still be drawn");
  // Pravy okraj loga musi sediet tesne pri pravom okraji panelu (x+w blizko
  // 120-pad) - na uzkych formatoch bez CTA moze byt logo takmer cez celu
  // sirku obsahu, takze samotne logo.x nie je spolahlivy signal "vpravo".
  assert(logo.x + logo.width >= 120 - 20,
    "no-CTA: logo's right edge must be anchored near the panel's right edge, got logo.right=" + (logo.x + logo.width));
  assert(logo.y > 600 / 2,
    "no-CTA: logo must be anchored in the bottom half, not top-left, got logo.y=" + logo.y);
  assert(ai.y >= logo.y + logo.height,
    "no-CTA: AI tag must sit below the standalone logo, got ai.y=" + ai.y + " logo.bottom=" + (logo.y + logo.height));
}

console.log("side_safe logo anchor + CTA baseline + AI below (zadanie E): ok");
