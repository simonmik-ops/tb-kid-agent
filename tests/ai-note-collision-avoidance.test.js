// Regresia 9.9.2026 (nájdené pri vizuálnej kontrole živého výstupu, Vinted
// 300×250 publisher): addAiNote() kontrolovalo kolíziu s
// Logo/CTA button/Subheadline/Headline/Legal text len RAZ — po posunutí nad
// prvý nájdený kolidujúci prvok sa nová pozícia už neoverila voči ostatným.
// Namerané na živom výstupe: AI tag (pôvodne pri "Legal text") sa posunul
// nahor, no skončil namiesto toho v zóne "CTA button" (9px zvislý presah,
// 88px vodorovný presah — text "AI generované" doslova pod textom tlačidla
// "Zistiť viac"). Tento test reprodukuje presne tú istú geometriu (300×250,
// prvky na zmeraných súradniciach zo živého výstupu) a beží skutočnú
// addAiNote() zo zdroja (cez vm).
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync(require.resolve("../plugin/code.js"), "utf8");

function makeNode(props) {
  const node = Object.assign({
    name: "", x: 0, y: 0, width: 0, height: 0, fills: [], children: [],
    fontName: null, fontSize: 0, characters: "", textAutoResize: "NONE",
    textAlignHorizontal: "LEFT", opacity: 1, letterSpacing: null, locked: false,
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
    }
  }, props || {});
  return node;
}

const context = {
  __html__: "<html></html>",
  figma: {
    createText: function () {
      // AI note text je vždy krátky jednoriadkový nápis ("✧  AI generované")
      // — WIDTH_AND_HEIGHT sa tu zjednodušene správa ako pevná jednoriadková
      // výška podľa fontSize, nepotrebujeme simulovať skutočné zalamovanie.
      const node = makeNode();
      let _autoResize = "NONE";
      Object.defineProperty(node, "textAutoResize", {
        get() { return _autoResize; }, set(v) { _autoResize = v; }
      });
      Object.defineProperty(node, "height", {
        get() {
          if (_autoResize === "WIDTH_AND_HEIGHT" || _autoResize === "HEIGHT") {
            return this.fontSize ? Math.round(this.fontSize * 1.3) : 0;
          }
          return 0;
        },
        set() {}
      });
      Object.defineProperty(node, "width", {
        get() {
          if (_autoResize === "WIDTH_AND_HEIGHT") {
            return this.fontSize ? Math.round(this.fontSize * 6) : 0;
          }
          return 0;
        },
        set() {}
      });
      return node;
    },
    closePlugin: function () {},
    showUI: function () {},
    ui: { onmessage: null, postMessage: function () {} },
    root: { children: [] },
    currentPage: { children: [] }
  },
  console: console
};
vm.createContext(context);
vm.runInContext(source + "\nthis.addAiNote = addAiNote;", context);

function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

// Presné súradnice zo živého výstupu (Vinted 300×250 publisher,
// L6yFpLkKcHe9flUk3i11T1, node 59:2712) — Headline/Subheadline/CTA/Logo/
// Legal text tak, ako ich buildMasterSafeLayout skutočne umiestnil.
const frame = makeNode({ width: 300, height: 250 });
frame.appendChild(makeNode({ name: "Headline", x: 15, y: 122, width: 270, height: 22 }));
frame.appendChild(makeNode({ name: "Subheadline", x: 15, y: 152, width: 270, height: 13 }));
frame.appendChild(makeNode({ name: "CTA button", x: 15, y: 173, width: 104, height: 36 }));
frame.appendChild(makeNode({ name: "Logo", x: 233, y: 185, width: 52, height: 50 }));
frame.appendChild(makeNode({ name: "Legal text", x: 15, y: 220, width: 270, height: 26 }));

const format = { width: 300, height: 250 };
const cb = { x: 0, y: 0, w: 300, h: 250 };
context.__frame = frame;
context.__format = format;
context.__cb = cb;
vm.runInContext("addAiNote(__frame, __format, __cb);", context);

const aiNote = frame.findOne((n) => n.name === "AI generované");
assert(aiNote, "AI note must be drawn");

const cta = frame.findOne((n) => n.name === "CTA button");
const legal = frame.findOne((n) => n.name === "Legal text");
const logo = frame.findOne((n) => n.name === "Logo");

assert(!overlaps(aiNote, cta),
  "AI note (y=" + aiNote.y + ".." + (aiNote.y + aiNote.height) + ") nesmie zasahovať do CTA button (y=" +
  cta.y + ".." + (cta.y + cta.height) + ") po posunutí kvôli kolízii s iným prvkom");
assert(!overlaps(aiNote, legal),
  "AI note nesmie zasahovať do Legal text");
assert(!overlaps(aiNote, logo),
  "AI note nesmie zasahovať do loga");

console.log("AI note iterative collision avoidance: ok");
