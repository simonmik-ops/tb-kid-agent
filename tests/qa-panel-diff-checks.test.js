// Zadanie 31.8, blok D / P2-32: three new checks in validateGeneratedFrame()
// close a real gap — the live Validation report caught none of blocks A/B/C
// because qaOutside/qaOverlap/qaNear only ever compare node-to-node, and
// none of those bugs are a node-to-node overlap (block A: node vs. the
// material behind it; block B: a gap BETWEEN two nodes; block C: a share of
// area with no image at all).
//
// This test verifies the acceptance condition literally: qa_panel_gap and
// qa_text_over_photo_alpha must fire on the PRE-FIX geometry (hand-built
// from the exact numbers measured in the assignment) and stay silent on the
// POST-FIX geometry produced by the real, current builders.
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync(require.resolve("../plugin/code.js"), "utf8");

function makeNode(overrides) {
  const node = Object.assign({
    name: "", type: "RECTANGLE", x: 0, y: 0, width: 0, height: 0, fills: [], children: [],
    visible: true, clipsContent: true,
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
      let out = [];
      for (const c of this.children) {
        if (pred(c)) out.push(c);
        if (c.findAll) out = out.concat(c.findAll(pred));
      }
      return out;
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
vm.runInContext(
  source +
  "\nthis.validateGeneratedFrame = validateGeneratedFrame;" +
  "\nthis.buildMasterSafeLayout = buildMasterSafeLayout;" +
  "\nthis.addAdformBackgroundTreatment = addAdformBackgroundTreatment;" +
  "\nthis.ADFORM_970X250_PHOTO_EDGE_X = ADFORM_970X250_PHOTO_EDGE_X;",
  context
);

function runValidate(frame, format, layout, layoutType, content) {
  context.__frame = frame; context.__format = format; context.__layout = layout;
  context.__layoutType = layoutType; context.__content = content;
  return vm.runInContext(
    "validateGeneratedFrame(__frame, __format, __layout, __layoutType, __content, null);",
    context
  );
}

// --- qa_panel_gap: pre-fix (1080×1920, photo 0..1080, panel from y=1137,
// exact numbers from the assignment) must fire; post-fix (real
// buildMasterSafeLayout output) must be silent.
{
  const brokenFrame = makeNode({ width: 1080, height: 1920 });
  const photo = makeNode({ name: "Protected single master — portrait image zone", width: 1080, height: 1080, fills: [{ type: "IMAGE" }] });
  brokenFrame.appendChild(photo);
  const panel = makeNode({ name: "Adaptive portrait content panel", y: 1137, width: 1080, height: 783 });
  brokenFrame.appendChild(panel);
  const format = { width: 1080, height: 1920 };
  const result = runValidate(brokenFrame, format, { asset_fallback_kind: "portrait" }, "master_safe", {});
  assert(result.issues.indexOf("qa_panel_gap") !== -1, "pre-fix 1080×1920 geometry (57px gap) must be flagged");
}
{
  const frame = makeNode({ width: 1080, height: 1920 });
  frame.width = 1080; frame.height = 1920;
  const format = { width: 1080, height: 1920, safeBox: null, deadZones: [] };
  const layout = { show_headline: true, show_logo: false, show_cta: false, show_subheadline: false, show_ai_disclosure: false };
  const content = { headline: "Investujte", subheadline: null, ctaText: null, showGuides: false };
  context.__frame = frame; context.__format = format; context.__layout = layout; context.__content = content;
  vm.runInContext("buildMasterSafeLayout(__frame, __format, __layout, __content, null, null, null, null);", context);
  const result = runValidate(frame, format, layout, "master_safe", content);
  assert(result.issues.indexOf("qa_panel_gap") === -1,
    "post-fix real buildMasterSafeLayout output must not be flagged, got: " + JSON.stringify(result.issues));
}

// --- qa_text_over_photo_alpha: pre-fix ramp (full opacity at 45% of panel
// width, x=684 on a 450..970 panel) must fire for a headline at x=460
// (inside the photo zone, alpha there is ~0.2-0.4); post-fix (real
// addAdformBackgroundTreatment ramp) must be silent for the same headline.
{
  const brokenFrame = makeNode({ width: 970, height: 250 });
  const photo = makeNode({ name: "Key visual crop — left zone", width: 549, height: 250, fills: [{ type: "IMAGE" }] });
  brokenFrame.appendChild(photo);
  const panel = makeNode({
    name: "Brand panel", x: 450, y: 0, width: 520, height: 250,
    fills: [{
      type: "GRADIENT_LINEAR",
      gradientTransform: [[1, 0, 0], [0, 1, 0]],
      gradientStops: [
        { position: 0.00, color: { a: 0.20 } },
        { position: 0.45, color: { a: 0.70 } },
        { position: 1.00, color: { a: 1.00 } }
      ]
    }]
  });
  brokenFrame.appendChild(panel);
  const headline = makeNode({ name: "Headline", type: "TEXT", x: 460, y: 55, width: 363, height: 105 });
  brokenFrame.appendChild(headline);
  const result = runValidate(brokenFrame, { width: 970, height: 250 }, {}, "adform_psd", { headline: "x" });
  assert(result.issues.indexOf("qa_text_over_photo_alpha") !== -1,
    "pre-fix 970×250 ramp (45% of panel width) must be flagged — headline at x=460 sits under ~20-40% alpha over the photo");
}
{
  const frame = makeNode({ width: 970, height: 250 });
  const photo = makeNode({ name: "Key visual crop — left zone", width: 549, height: 250, fills: [{ type: "IMAGE" }] });
  frame.appendChild(photo);
  const rules = { panel: [450, 0, 520, 250] };
  context.__frame = frame; context.__rules = rules; context.__layout = {};
  vm.runInContext('addAdformBackgroundTreatment(__frame, {width:970,height:250}, __rules, "adform_970x250", __layout);', context);
  const headline = makeNode({ name: "Headline", type: "TEXT", x: 460, y: 55, width: 363, height: 105 });
  frame.appendChild(headline);
  const result = runValidate(frame, { width: 970, height: 250 }, {}, "adform_psd", { headline: "x" });
  assert(result.issues.indexOf("qa_text_over_photo_alpha") === -1,
    "post-fix real addAdformBackgroundTreatment ramp must not be flagged, got: " + JSON.stringify(result.issues));
}

// --- qa_empty_surface_ratio: 48% flat colour (block C's own measured RSA
// number) must fire; Adform must never fire regardless of ratio; a normal
// high-coverage master_safe frame must stay silent.
{
  const frame = makeNode({ width: 1200, height: 628 });
  frame.appendChild(makeNode({ name: "Key visual — protected full master", width: 628, height: 628, fills: [{ type: "IMAGE" }] }));
  const result = runValidate(frame, { width: 1200, height: 628 }, {}, "master_safe", {});
  assert(result.issues.indexOf("qa_empty_surface_ratio") !== -1, "48% flat-colour coverage (RSA wide) must be flagged");
}
{
  // Same low coverage, but Adform PSD compositions are legitimately panel-heavy.
  const frame = makeNode({ width: 160, height: 600 });
  frame.appendChild(makeNode({ name: "Key visual crop — top zone", width: 160, height: 160, fills: [{ type: "IMAGE" }] }));
  const result = runValidate(frame, { width: 160, height: 600 }, {}, "adform_psd", {});
  assert(result.issues.indexOf("qa_empty_surface_ratio") === -1, "Adform must be exempt from this check regardless of ratio");
}
{
  const frame = makeNode({ width: 1200, height: 1200 });
  frame.appendChild(makeNode({ name: "Master visual — 2000×2000 core", width: 1628, height: 1628, x: -214, y: -314, fills: [{ type: "IMAGE" }] }));
  const result = runValidate(frame, { width: 1200, height: 1200 }, {}, "master_safe", {});
  assert(result.issues.indexOf("qa_empty_surface_ratio") === -1, "a normal full-bleed master_safe frame must not be flagged");
}

console.log("qa panel/alpha/surface diff checks: ok");
