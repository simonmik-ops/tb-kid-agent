// K8/P2-21 (26.8): createValidationReport()'s "Warning row" background had a
// fixed 58px height and a fixed 72px advance to the next row, regardless of
// content. Long channel names (e.g. "casprezeny.sk + dobrejedlo.sk + ... /
// Ženské weby interscroller 750×1624") wrap into ~4 lines — the text node
// itself grows (textAutoResize: HEIGHT), but the fixed-height background and
// fixed row spacing did not, so the text spilled into the next row.
//
// This test runs the real createValidationReport() via vm with a mock where
// text nodes simulate word-wrap height growth for a long "tall" name, and
// verifies the row background grows to match and the next row does not
// overlap it.
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync(require.resolve("../plugin/code.js"), "utf8");

// Source-presence regression: the old fixed-increment loop must be gone.
assert(!/y \+= 72;/.test(source), "the old fixed 72px row advance must be removed");
assert(!/,\s*58,\s*\{ r: 1, g: 1, b: 1 \}, 1\);/.test(source), "the old fixed 58px row background must be removed");

function makeNode(overrides) {
  const node = Object.assign({
    name: "", x: 0, y: 0, width: 0, height: 0, fills: [], children: [],
    characters: "", textAutoResize: "NONE",
    resize: function (w, h) {
      this.width = w;
      // Simulate word-wrap: a "TALL:" marker in the text means this line
      // wraps into several lines, growing height well past what was asked.
      this.height = /TALL:/.test(this.characters) ? h * 4 : h;
    },
    appendChild: function (child) { child.parent = this; this.children.push(child); },
    findOne: function (pred) {
      for (const c of this.children) {
        if (pred(c)) return c;
        const found = c.findOne ? c.findOne(pred) : null;
        if (found) return found;
      }
      return null;
    }
  }, overrides || {});
  return node;
}

const rootChildren = [];
const context = {
  __html__: "<html></html>",
  figma: {
    createRectangle: makeNode, createText: makeNode, createFrame: makeNode,
    createPage: function () { const p = makeNode({ type: "PAGE" }); rootChildren.push(p); return p; },
    showUI: function () {}, closePlugin: function () {},
    ui: { onmessage: null, postMessage: function () {} },
    root: { children: rootChildren }, currentPage: { children: [] }
  },
  console: console
};
vm.createContext(context);
vm.runInContext(source + "\nthis.createValidationReport = createValidationReport;", context);

const formats = [
  { format: { name: "Short format", channel: "topky.sk" }, layout: { validation_warnings: ["qa_content_overlap"] } },
  {
    format: { name: "TALL: Ženské weby interscroller 750×1624", channel: "casprezeny.sk + dobrejedlo.sk + emma.sk + eva.sk + izdravie.sk + sarm.sk + zena.sk" },
    layout: { validation_warnings: ["qa_content_overlap"] }
  },
  { format: { name: "Another format", channel: "joj.sk" }, layout: { validation_warnings: ["qa_typography_scale"] } }
];

context.__formats = formats;
context.__headline = "Test headline";
vm.runInContext('createValidationReport(__formats, __headline, "awareness", []);', context);

const page = rootChildren[0];
const reportFrame = page.findOne((n) => n.name === "Validation report - AWARENESS");
assert(reportFrame, "report frame must be created");
const rows = reportFrame.children.filter((n) => n.name === "Warning row");
assert.strictEqual(rows.length, 3, "must have one background row per warning row");

// The tall row (index 1) must be clearly taller than a normal row (0 or 2),
// since its content actually wraps into more lines.
assert(rows[1].height > rows[0].height,
  "the row with wrapped long content (h=" + rows[1].height + ") must be taller than a normal row (h=" + rows[0].height + ")");
assert.strictEqual(rows[0].height, rows[2].height, "two equally short rows must get the same height");

// No row overlaps the next one vertically.
for (let i = 0; i < rows.length - 1; i++) {
  assert(
    rows[i].y + rows[i].height <= rows[i + 1].y,
    "row " + i + " (y=" + rows[i].y + ", h=" + rows[i].height + ") must not overlap row " + (i + 1) + " (y=" + rows[i + 1].y + ")"
  );
}

console.log("validation report dynamic row height: ok");
