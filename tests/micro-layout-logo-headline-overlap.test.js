// Regresia 9.9.2026: buildMicroLayout() počítalo contentX (ľavý okraj
// headlinu) z PREDPOKLADANEJ šírky loga (logoW), predtým než placeLogo()
// interne dorovná pod STYLE.minLogoPx (50px) a logo preškáluje nahor.
//
// Na 320×50: logoH vychádza 30px (pod 50px prahom) → placeLogo() ho
// interne preškáluje na min. rozmer 50px a následne orezáva podľa
// dostupného miesta vo frame — skutočná vykreslená šírka je 66px, nie
// predpokladaných 50px. contentX = pad + 50 + gap = 61, ale skutočný
// pravý okraj loga (pad + 66 = 72) siaha o 11px ĎALEJ — headline preto
// sedel 11px POD logom.
//
// Príčinou je regresia z commitu 586ab9e7 (merge zaloha-8-9, 8.9.2026,
// P1-12 "logo pravidlá") — ten pridal do placeLogo() dorovnávaciu logiku
// (_mensi/STYLE.minLogoPx/kMax), ale nezmenil kontrakt funkcie (žiadny
// return), takže žiadny z ~20 volajúcich naprieč súborom sa o tomto
// dorovnaní nemohol dozvedieť. Pred týmto commitom placeLogo() žiadne
// interné škálovanie nerobilo, takže sa "predpokladané" a "skutočné"
// nemalo ako rozísť.
//
// Oprava: placeLogo() teraz vracia skutočný vykreslený uzol; buildMicroLayout
// číta jeho .width namiesto vlastného odhadu. Headline sa neposúva natvrdo
// — len sa mení ZDROJ, z ktorého sa jeho ľavý okraj počíta.
//
// 728×90 (rovnaký "micro" builder, iný rozmer) bolo tiež overené — jeho
// logoH (54px) je už nad 50px prahom, takže placeLogo() tam žiadne
// dorovnanie nikdy nerobil a assumed/real sa nikdy nerozišli. Test to
// explicitne pinuje, aby prípadná budúca zmena prahu/vzorca tento fakt
// nezmenila potichu.
//
// Test beží skutočný buildMicroLayout() zo zdroja (cez vm).
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync(require.resolve("../plugin/code.js"), "utf8");

function makeNode() {
  const node = {
    name: "", x: 0, y: 0, width: 0, height: 0, fills: [], children: [],
    fontName: null, fontSize: 0, characters: "", textAutoResize: "NONE",
    textAlignHorizontal: "LEFT", opacity: 1,
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
    createFrame: makeNode,
    createText: function () {
      const node = makeNode();
      let _chars = "", _width = 0, _height = 0, _autoResize = "NONE";
      Object.defineProperty(node, "characters", { get() { return _chars; }, set(v) { _chars = v; } });
      Object.defineProperty(node, "textAutoResize", { get() { return _autoResize; }, set(v) { _autoResize = v; } });
      Object.defineProperty(node, "width", {
        get() {
          if (_autoResize === "WIDTH_AND_HEIGHT") return this.fontSize ? Math.round(String(_chars).length * this.fontSize * 0.55) : 0;
          return _width;
        },
        set(v) { _width = v; }
      });
      Object.defineProperty(node, "height", {
        get() {
          if (_autoResize === "WIDTH_AND_HEIGHT") return this.fontSize ? Math.round(this.fontSize * 1.3) : 0;
          return _height;
        },
        set(v) { _height = v; }
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
vm.runInContext(source + "\nthis.buildMicroLayout = buildMicroLayout;", context);

function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function runMicro(width, height) {
  const frame = makeNode();
  frame.width = width;
  frame.height = height;
  const format = { width, height };
  const layout = { show_headline: true, show_logo: true };
  context.__frame = frame;
  context.__format = format;
  context.__layout = layout;
  context.__headline = "Investovanie s Tatra bankou";
  context.__figmaImage = { hash: "fake-image" };
  context.__figmaLogo = { hash: "fake-logo" };
  vm.runInContext(
    "buildMicroLayout(__frame, __format, __layout, __headline, __figmaImage, __figmaLogo);",
    context
  );
  return frame;
}

// 320×50: logoH (30px) je pod STYLE.minLogoPx (50px) — placeLogo() ho
// interne dorovnáva, skutočná šírka (66px) je väčšia, než predpokladaných
// 50px. Headline nesmie začínať skôr, než kde skutočné logo končí.
{
  const frame = runMicro(320, 50);
  const logo = frame.findOne((n) => n.name === "Logo");
  const headline = frame.findOne((n) => n.name === "Headline" || n.characters === "Investovanie s Tatra bankou");
  assert(logo && headline, "320x50: logo and headline must both be drawn");
  assert(logo.width > 50,
    "kontrola predpokladu: na 320x50 musí placeLogo() logo interne dorovnať nad predpokladaných 50px, got width=" + logo.width);
  assert(headline.x >= logo.x + logo.width,
    "320x50: headline (x=" + headline.x + ") nesmie začínať pred skutočným pravým okrajom loga (x=" + (logo.x + logo.width) + ")");
  assert(!overlaps(logo, headline),
    "320x50: logo a headline sa nesmú prekrývať");
}

// 728×90: kontrola predpokladu — logoH (54px) je UŽ nad 50px prahom,
// placeLogo() preto žiadne dorovnanie nerobí a assumed/real sa nikdy
// nerozišli. Ak by sa táto vlastnosť niekedy zmenila (napr. iný vzorec pre
// logoH), tento test by na to explicitne upozornil.
{
  const frame = runMicro(728, 90);
  const logo = frame.findOne((n) => n.name === "Logo");
  const headline = frame.findOne((n) => n.name === "Headline" || n.characters === "Investovanie s Tatra bankou");
  assert(logo && headline, "728x90: logo and headline must both be drawn");
  assert(logo.width <= 60,
    "kontrola predpokladu: na 728x90 logoH musí zostať nad minLogoPx (žiadne interné dorovnanie, šírka blízko predpokladanej ~57px), got " + logo.width);
  assert(!overlaps(logo, headline),
    "728x90: logo a headline sa nesmú prekrývať");
}

console.log("buildMicroLayout logo/headline overlap (320x50, regression from 586ab9e7): ok");
