// K8/P0-21 (26.8): validateGeneratedFrame()'s qa_unsafe_single_master_crop
// check compared protectedMaster.width against parent.width and
// protectedMaster.height against parent.height INDEPENDENTLY against a flat
// 1.7x. For a non-square zone (e.g. the wide-family 900×628 image zone),
// a square oversized master necessarily has a larger oversize ratio against
// the zone's SHORTER dimension than its longer one — purely from the zone's
// own aspect ratio, not from anything being broken. Measured on the KID
// reference wide crop (900×628 zone, WIDE_KV_ZONE_MULTIPLIER=1.23 render of
// 1107×1107, verified pixel-exact against Surďova Figma 0:21): width-oversize
// 1107/900=1.23 (fine), height-oversize 1107/628=1.763 — over the old flat
// 1.7 threshold, on a crop that is objectively correct. Fixed by comparing
// against the zone's LONGER dimension (the one that actually determines how
// big a square must be to cover a non-square zone) instead of each axis
// separately.
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync(require.resolve("../plugin/code.js"), "utf8");

function makeNode(overrides) {
  const node = Object.assign({
    name: "", x: 0, y: 0, width: 0, height: 0, fills: [], children: [],
    clipsContent: true, type: "FRAME",
    absoluteBoundingBox: { x: 0, y: 0, width: 0, height: 0 },
    resize: function (w, h) { this.width = w; this.height = h; },
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

const context = {
  __html__: "<html></html>",
  figma: {
    createRectangle: makeNode, createText: makeNode, createFrame: makeNode,
    showUI: function () {}, closePlugin: function () {},
    ui: { onmessage: null, postMessage: function () {} },
    root: { children: [] }, currentPage: { children: [] }
  },
  console: console
};
vm.createContext(context);
vm.runInContext(source + "\nthis.validateGeneratedFrame = validateGeneratedFrame;", context);

function issuesFor(zoneW, zoneH, renderW, renderH) {
  const frame = makeNode({ width: zoneW, height: zoneH });
  const holder = makeNode({ name: "Protected single master — wide image zone", width: zoneW, height: zoneH });
  frame.appendChild(holder);
  const protectedMaster = makeNode({ name: "Key visual — protected full master", width: renderW, height: renderH });
  holder.appendChild(protectedMaster);
  const format = { width: zoneW, height: zoneH };
  const layout = { asset_fallback_kind: "wide" };
  const content = {};
  context.__frame = frame; context.__format = format; context.__layout = layout; context.__content = content;
  const result = vm.runInContext(
    'validateGeneratedFrame(__frame, __format, __layout, "master_safe", __content, null);',
    context
  );
  return result.issues;
}

// KID reference wide crop: 900×628 zone, 1107×1107 render (WIDE_KV_ZONE_MULTIPLIER
// = 1.23, verified pixel-exact against Surďova Figma 0:21) must NOT be flagged.
const okIssues = issuesFor(900, 628, 1107, 1107);
assert(
  okIssues.indexOf("qa_unsafe_single_master_crop") === -1,
  "a correct, Surďo-verified wide oversize crop must not be flagged: " + JSON.stringify(okIssues)
);

// A genuinely broken case (render barely bigger than the zone's longer side,
// 1.7x is far exceeded on both axes) must still be caught.
const brokenIssues = issuesFor(900, 628, 900 * 3, 900 * 3);
assert(
  brokenIssues.indexOf("qa_unsafe_single_master_crop") !== -1,
  "a genuinely oversized crop (3x the zone) must still be flagged"
);

console.log("qa oversize threshold (zone-aspect-aware): ok");
