const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync(require.resolve("../plugin/code.js"), "utf8");
const start = source.indexOf("function qaOutside");
const end = source.indexOf("function validateGeneratedFrame");
assert(start >= 0 && end > start, "pure visual QA geometry helpers must exist");

const context = {};
vm.createContext(context);
vm.runInContext(source.slice(start, end), context);

assert.strictEqual(context.qaOutside({ x: 0, y: 0, w: 300, h: 250 }, { width: 300, height: 250 }, 2), false);
assert.strictEqual(context.qaOutside({ x: -4, y: 0, w: 300, h: 250 }, { width: 300, height: 250 }, 2), true);
assert.strictEqual(context.qaOverlap({ x: 10, y: 10, w: 80, h: 30 }, { x: 70, y: 20, w: 60, h: 30 }, 2), true);
assert.strictEqual(context.qaOverlap({ x: 10, y: 10, w: 40, h: 30 }, { x: 60, y: 10, w: 40, h: 30 }, 2), false);
assert.strictEqual(context.qaNear(425.8, 425, 2), true);
assert.strictEqual(context.qaNear(429, 425, 2), false);

assert(source.includes('frame.setPluginData("tbQaStatus"'), "every rendered frame must persist its QA result");
assert(source.includes('qaFailedCount'), "generation summary must expose QA failures");
assert(source.includes('qa_psd_geometry'), "Adform outputs must be checked against PSD geometry");
assert(source.includes('FONT.family !== STYLE.fontFamily'), "font fallback must fail visual QA");
assert(source.includes('qa_content_overlap'), "content collisions must fail visual QA");

console.log("frame visual QA: ok");
