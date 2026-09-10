// Regresia 10.9.2026: qa_wide_color_extension vyžadovalo natvrdo aspoň 4
// gradient stopy ("stops.length >= 4"), aby uznalo panel za plynulý. Meta
// Automatic Placements 1200×628 (buildMasterSafeLayout, isMetaWide vetva,
// komisia z 9.9.) kreslí ekvivalentný, plne kryjúci panel len s 3 stopmi
// (0 → priehľadné, boundary → plné, 1 → plné — bez samostatnej fázy jemného
// nábehu na začiatku, ktorú majú generické 4-stopové panely navyše). Táto
// kontrola preto falošne hlásila chybu aj na formáte, ktorý vyzerá správne.
//
// Oprava kontroluje len skutočnú vlastnosť (posledné dva stopy plne kryjú),
// nie počet stopov — 4-stopové panely (generický wide, master_safe) aj
// 3-stopové (Meta) teraz obe prechádzajú, keď reálne dosahujú plnú krycosť.
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync(require.resolve("../plugin/code.js"), "utf8");

function makeNode() {
  const node = {
    name: "", x: 0, y: 0, width: 0, height: 0, fills: [], children: [], visible: true,
    fontName: null, fontSize: 0, characters: "", textAutoResize: "NONE", opacity: 1,
    resize: function (w, h) { this.width = w; this.height = h; },
    appendChild: function (child) { child.parent = this; this.children.push(child); },
    remove: function () {},
    findOne: function (pred) {
      for (const c of this.children) {
        if (pred(c)) return c;
        const found = c.findOne ? c.findOne(pred) : null;
        if (found) return found;
      }
      return null;
    },
    findAll: function (pred) {
      const out = [];
      for (const c of this.children) {
        if (pred(c)) out.push(c);
        if (c.findAll) out.push(...c.findAll(pred));
      }
      return out;
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
    showUI: function () {},
    closePlugin: function () {},
    ui: { onmessage: null, postMessage: function () {} },
    root: { children: [] },
    currentPage: { children: [] }
  },
  console: console
};
vm.createContext(context);
vm.runInContext(
  source + "\nthis.buildMasterSafeLayout = buildMasterSafeLayout;\nthis.validateGeneratedFrame = validateGeneratedFrame;",
  context
);

function runMetaWide() {
  const frame = makeNode();
  frame.width = 1200; frame.height = 628;
  const format = { width: 1200, height: 628, channel: "Meta" };
  const layout = { show_headline: true, show_logo: true, show_cta: false, show_legal: false, show_subheadline: true };
  const content = {
    headline: "Investovanie", subheadline: "Od 50 eur.",
    ctaText: null, legalText: null, badgeText: null, aiGenerated: false
  };
  context.__frame = frame; context.__format = format; context.__layout = layout; context.__content = content;
  context.__figmaImage = { hash: "fake-image" }; context.__figmaLogo = { hash: "fake-logo" };
  vm.runInContext(
    "buildMasterSafeLayout(__frame, __format, __layout, __content, __figmaImage, {width:2000,height:2000}, __figmaLogo, {x:0,y:0,w:__format.width,h:__format.height});",
    context
  );
  const qa = vm.runInContext(
    "validateGeneratedFrame(__frame, __format, __layout, \"master_safe\", __content, null);",
    context
  );
  return qa;
}

const panelBeforeAssert = (function () {
  // kontrola predpokladu: Meta wide panel má skutočne 3 stopy (nie 4) a
  // posledné dva sú plne kryjúce — inak by tento test nič nedokazoval.
  const frame = makeNode();
  frame.width = 1200; frame.height = 628;
  const format = { width: 1200, height: 628, channel: "Meta" };
  const layout = { show_headline: true, show_logo: true, show_cta: false, show_legal: false, show_subheadline: true };
  const content = { headline: "Investovanie", subheadline: "Od 50 eur.", ctaText: null, legalText: null, badgeText: null, aiGenerated: false };
  context.__frame = frame; context.__format = format; context.__layout = layout; context.__content = content;
  context.__figmaImage = { hash: "fake-image" }; context.__figmaLogo = { hash: "fake-logo" };
  vm.runInContext(
    "buildMasterSafeLayout(__frame, __format, __layout, __content, __figmaImage, {width:2000,height:2000}, __figmaLogo, {x:0,y:0,w:__format.width,h:__format.height});",
    context
  );
  return frame.findOne((n) => n.name === "Wide content panel");
})();
const stops = panelBeforeAssert.fills[0].gradientStops;
assert.strictEqual(stops.length, 3,
  "kontrola predpokladu: Meta wide panel musí mať presne 3 stopy, got " + stops.length);
assert(stops[1].color.a >= 0.98 && stops[2].color.a >= 0.98,
  "kontrola predpokladu: posledné dva stopy musia byť plne kryjúce");

const qa = runMetaWide();
assert(!qa.issues.includes("qa_wide_color_extension"),
  "Meta 1200x628 (3-stop panel, reálne plne kryjúci) nesmie byť falošne označený ako qa_wide_color_extension, got " +
  JSON.stringify(qa.issues));

console.log("qa_wide_color_extension 3-stop false positive (Meta 1200x628): ok");
