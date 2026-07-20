// preview.js — vývojový nástroj (nie súčasť servera)
// Vykreslí vizuálnu galériu VŠETKÝCH formátov VŠETKÝCH kampaní z reálneho
// katalógu (formats.js) a reálneho layout enginu (agent.getLayoutStrategy).
// Ukazuje: správne proporcie, safe zóny a kam padne headline / logo / obrázok.
// Spustenie:  node preview.js   →   vytvorí preview.html
//
// Slúži ako "ukážka" a zároveň QA nástroj — je to presne to, čo plugin
// vygeneruje vo Figme (bez samotnej fotky; tú dopĺňa nahraný KV).

const fs = require("fs");
const FORMATS = require("./formats");
const CAMPAIGNS = FORMATS.campaigns;
const { getLayoutStrategy } = require("./agent");

// Neutrálna "analýza vizuálu" + default recipe (bez volania Claude)
const VA = { bg_r: 0.0, bg_g: 0.18, bg_b: 0.55, is_complex_visual: false, has_text: false,
  safe_to_crop_top: true, safe_to_crop_bottom: true, safe_to_crop_sides: true };
const RECIPE = { visualType: "centered_subject", subjectPosition: "center",
  cropMode: "protect_subject", smallFormatMode: "brand_panel", textMode: "auto", logoMode: "auto" };

const BRAND = "#002E8C";

// ── Umiestnenie prvkov ako % rámu (verné layout stratégii) ─────────────
function placements(format, layout) {
  const els = [];
  const lt = layout.layout_type;
  const showImg = layout.image_fit !== "none" && layout.photo_width_pct > 0 && lt !== "logo_only";
  const brandPanel = layout.brand_color_pct > 0 && (lt === "strip" || lt === "split");

  // obrázok / brand panel
  if (lt === "logo_only") {
    els.push({ cls: "img logoOnlyBg", label: "", style: "left:0;top:0;right:0;bottom:0" });
  } else if (brandPanel) {
    const pw = layout.photo_width_pct;
    // fotka vpravo, brand vľavo (strip) alebo fotka vľavo (split)
    if (lt === "split") {
      els.push({ cls: "img", label: "KV", style: `left:0;top:0;width:${pw}%;bottom:0` });
      els.push({ cls: "brand", label: "", style: `right:0;top:0;width:${100 - pw}%;bottom:0` });
    } else {
      els.push({ cls: "brand", label: "", style: `left:0;top:0;width:${100 - pw}%;bottom:0` });
      els.push({ cls: "img", label: "KV", style: `right:0;top:0;width:${pw}%;bottom:0` });
    }
  } else if (showImg) {
    const fit = layout.image_fit === "contain" ? " contain" : "";
    els.push({ cls: "img" + fit, label: "KV", style: "left:0;top:0;right:0;bottom:0" });
  } else {
    els.push({ cls: "brand", label: "", style: "left:0;top:0;right:0;bottom:0" });
  }

  // logo
  if (layout.show_logo) {
    const p = logoBox(layout.logo_position);
    if (p) p.forEach(s => els.push({ cls: "logo", label: "logo", style: s }));
  }
  // headline
  if (layout.show_headline) {
    const p = headlineBox(layout.headline_position);
    if (p) els.push({ cls: "hl", label: "HEADLINE", style: p });
  }
  // CTA (ak systém nedoťahuje) — len orientačne pri full/side layoutoch
  return els;
}

function logoBox(pos) {
  const W = 26, H = 12; // % veľkosť loga
  switch (pos) {
    case "top-left": return [`left:5%;top:5%;width:${W}%;height:${H}%`];
    case "top": return [`left:${(100 - W) / 2}%;top:5%;width:${W}%;height:${H}%`];
    case "top-right": return [`right:5%;top:5%;width:${W}%;height:${H}%`];
    case "safe-top": return [`left:${(100 - W) / 2}%;top:8%;width:${W}%;height:${H}%`];
    case "below-top-safe": return [`left:5%;top:14%;width:${W}%;height:${H}%`];
    case "center": return [`left:${(100 - 40) / 2}%;top:${(100 - 24) / 2}%;width:40%;height:24%`];
    case "left": return [`left:5%;top:${(100 - H) / 2}%;width:${W}%;height:${H}%`];
    case "top-sides": return [`left:4%;top:4%;width:16%;height:10%`, `right:4%;top:4%;width:16%;height:10%`];
    case "none": return null;
    default: return [`left:5%;top:5%;width:${W}%;height:${H}%`];
  }
}

function headlineBox(pos) {
  switch (pos) {
    case "bottom": return "left:6%;right:6%;bottom:6%;height:26%";
    case "safe-bottom": return "left:8%;right:8%;bottom:12%;height:22%";
    case "top": return "left:6%;right:6%;top:6%;height:24%";
    case "center": return "left:8%;right:8%;top:38%;height:24%";
    case "left": return "left:6%;top:30%;width:46%;height:40%";
    case "right": return "right:6%;top:30%;width:46%;height:40%";
    case "sides": return "left:6%;right:6%;bottom:8%;height:16%";
    case "below-image": return "left:6%;right:6%;bottom:6%;height:30%";
    default: return "left:6%;right:6%;bottom:6%;height:26%";
  }
}

// ── Safe zóny ako overlay ──────────────────────────────────────────────
function safeOverlays(format) {
  const sz = format.safeZones || {};
  const W = format.width, H = format.height;
  const out = [];
  const pct = (v, tot) => (v / tot) * 100;
  if (sz.top) out.push(`left:0;top:0;right:0;height:${pct(sz.top, H)}%`);
  if (sz.bottom) out.push(`left:0;bottom:0;right:0;height:${pct(sz.bottom, H)}%`);
  if (sz.sides) out.push(`left:0;top:0;bottom:0;width:${pct(sz.sides, W)}%`),
    out.push(`right:0;top:0;bottom:0;width:${pct(sz.sides, W)}%`);
  if (sz.left) out.push(`left:0;top:0;bottom:0;width:${pct(sz.left, W)}%`);
  if (sz.right) out.push(`right:0;top:0;bottom:0;width:${pct(sz.right, W)}%`);
  // centrovaná bezpečná plocha (branding full)
  if (sz.centerWidth) {
    const w = pct(sz.centerWidth, W);
    const top = sz.topOffset ? pct(sz.topOffset, H) : 0;
    out.push({ safe: true, style: `left:${(100 - w) / 2}%;top:${top}%;width:${w}%;bottom:0` });
  }
  // vnútorná safe zóna (branding side)
  if (sz.safeInner) {
    const w = pct(sz.safeInner.width, W), h = pct(sz.safeInner.height, H);
    out.push({ safe: true, style: `left:${(100 - w) / 2}%;top:${Math.max(0, (100 - h) / 2)}%;width:${w}%;height:${Math.min(100, h)}%` });
  }
  return out.map(o => (typeof o === "string" ? { safe: false, style: o } : o));
}

// ── Render jedného formátu ─────────────────────────────────────────────
function renderFormat(format) {
  const layout = getLayoutStrategy(format, VA, RECIPE);
  const MAX = 190; // max px strana náhľadu
  const scale = MAX / Math.max(format.width, format.height);
  const w = Math.round(format.width * scale);
  const h = Math.round(format.height * scale);

  const els = placements(format, layout).map(e =>
    `<div class="el ${e.cls}" style="${e.style}">${e.label ? `<span>${e.label}</span>` : ""}</div>`).join("");
  const safes = safeOverlays(format).map(s =>
    `<div class="${s.safe ? "safebox" : "safeband"}" style="${s.style}"></div>`).join("");

  const roleTag = format.role && format.role !== layout.layout_type ? `<span class="tag role">${format.role}</span>` : "";
  const ltTag = `<span class="tag lt">${layout.layout_type}</span>`;

  return `
  <div class="card">
    <div class="frameWrap" style="width:${w}px;height:${h}px">
      <div class="frame">${els}${safes}</div>
    </div>
    <div class="meta">
      <div class="fname">${esc(format.name)}</div>
      <div class="dims">${format.width}×${format.height}${format.count > 1 ? ` · ${format.count}×` : ""}</div>
      <div class="tags">${roleTag}${ltTag}</div>
      <div class="note">${esc(format.notes || "")}</div>
    </div>
  </div>`;
}

function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

// ── Zostavenie stránky ─────────────────────────────────────────────────
function build() {
  const campaignKeys = Object.keys(CAMPAIGNS);
  const byCampaign = {};
  for (const f of FORMATS) {
    const c = f.campaign || "kid";
    (byCampaign[c] = byCampaign[c] || []).push(f);
  }

  const tabs = campaignKeys.map((c, i) =>
    `<button class="tab${i === 0 ? " active" : ""}" data-c="${c}">${esc(CAMPAIGNS[c].label)}<span class="cnt">${(byCampaign[c] || []).length}</span></button>`).join("");

  const panels = campaignKeys.map((c, i) => {
    const list = byCampaign[c] || [];
    // zoskup podľa kanála
    const byCh = {};
    for (const f of list) (byCh[f.channel] = byCh[f.channel] || []).push(f);
    const groups = Object.keys(byCh).map(ch =>
      `<h3 class="chan">${esc(ch)} <span>${byCh[ch].length}</span></h3>
       <div class="grid">${byCh[ch].map(renderFormat).join("")}</div>`).join("");
    return `<section class="panel${i === 0 ? " active" : ""}" data-c="${c}">
      <div class="camphead"><span class="tagpill">${CAMPAIGNS[c].tagging}</span> ${list.length} formátov</div>
      ${groups}
    </section>`;
  }).join("");

  return `<!DOCTYPE html><html lang="sk"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TB — Figma Generator · prehľad formátov</title>
<style>
  :root{--brand:${BRAND};}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font:13px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;background:#f4f5f7}
  header{background:var(--brand);color:#fff;padding:18px 24px}
  header h1{font-size:18px;font-weight:700}
  header p{font-size:12px;opacity:.8;margin-top:3px}
  .tabs{display:flex;gap:6px;flex-wrap:wrap;padding:14px 24px;background:#fff;border-bottom:1px solid #e5e7eb;position:sticky;top:0;z-index:10}
  .tab{border:1px solid #d0d5dd;background:#fff;border-radius:20px;padding:6px 14px;font:inherit;font-weight:600;cursor:pointer;color:#344}
  .tab .cnt{display:inline-block;margin-left:6px;background:#eef;color:var(--brand);border-radius:10px;padding:0 7px;font-size:11px}
  .tab.active{background:var(--brand);color:#fff;border-color:var(--brand)}
  .tab.active .cnt{background:rgba(255,255,255,.25);color:#fff}
  .legend{display:flex;gap:16px;flex-wrap:wrap;padding:10px 24px;font-size:11px;color:#667;background:#fff;border-bottom:1px solid #eee}
  .legend span{display:inline-flex;align-items:center;gap:5px}
  .sw{width:12px;height:12px;border-radius:3px;display:inline-block}
  .panel{display:none;padding:8px 24px 60px}
  .panel.active{display:block}
  .camphead{margin:14px 0 4px;font-size:12px;color:#667}
  .tagpill{background:#eef;color:var(--brand);border-radius:5px;padding:2px 8px;font-weight:700;font-family:ui-monospace,monospace}
  .chan{margin:22px 0 10px;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#8a94a6;border-bottom:1px solid #e5e7eb;padding-bottom:5px}
  .chan span{color:#b4bccb}
  .grid{display:flex;flex-wrap:wrap;gap:18px}
  .card{width:210px}
  .frameWrap{display:flex;align-items:flex-end;justify-content:center;height:200px;margin-bottom:8px}
  .frame{position:relative;width:100%;height:100%;background:#fff;border:1px solid #cfd4dc;box-shadow:0 1px 4px rgba(0,0,0,.08);overflow:hidden}
  .el{position:absolute;display:flex;align-items:center;justify-content:center}
  .el span{font-size:8px;font-weight:700;letter-spacing:.04em;opacity:.85}
  .img{background:linear-gradient(135deg,#3a5bbf,#00206b);color:#fff}
  .img.contain{background:#dde3f0;color:#48c;border:1px dashed #9fb0d8}
  .logoOnlyBg{background:repeating-conic-gradient(#e9edf5 0 25%,#fff 0 50%) 0/14px 14px;color:#7a86a0}
  .brand{background:var(--brand);color:#cdd7f2}
  .logo{background:#fff;border:1px solid #cbd3e2;border-radius:3px;color:var(--brand);box-shadow:0 1px 2px rgba(0,0,0,.12)}
  .hl{background:rgba(255,255,255,.85);border:1px dashed #33415c;color:#22304a;border-radius:2px}
  .safeband{position:absolute;background:repeating-linear-gradient(45deg,rgba(255,60,60,.10) 0 5px,rgba(255,60,60,0) 5px 10px);border:1px solid rgba(255,60,60,.35)}
  .safebox{position:absolute;border:1.5px dashed rgba(255,60,60,.7)}
  .meta .fname{font-weight:700;font-size:12px}
  .meta .dims{color:#667;font-size:11px;font-family:ui-monospace,monospace}
  .tags{margin:4px 0}
  .tag{display:inline-block;font-size:9px;padding:1px 6px;border-radius:4px;margin-right:4px;font-weight:700}
  .tag.role{background:#fde8c8;color:#8a5a00}
  .tag.lt{background:#e3ebff;color:var(--brand)}
  .note{font-size:10px;color:#889;line-height:1.3;margin-top:3px}
</style></head><body>
<header>
  <h1>TB — Figma Generator · prehľad formátov</h1>
  <p>Vygenerované z reálneho katalógu (formats.js) a layout enginu (agent.js). Ukazuje proporcie, safe zóny a umiestnenie prvkov — presne to, čo plugin postaví vo Figme z nahraného KV.</p>
</header>
<div class="tabs">${tabs}</div>
<div class="legend">
  <span><i class="sw" style="background:linear-gradient(135deg,#3a5bbf,#00206b)"></i> KV / obrázok</span>
  <span><i class="sw" style="background:${BRAND}"></i> brand plocha</span>
  <span><i class="sw" style="background:#fff;border:1px solid #cbd3e2"></i> logo</span>
  <span><i class="sw" style="background:rgba(255,255,255,.85);border:1px dashed #33415c"></i> headline</span>
  <span><i class="sw" style="background:repeating-conic-gradient(#e9edf5 0 25%,#fff 0 50%) 0/8px 8px"></i> transparentné (logo-only)</span>
  <span><i class="sw" style="border:1.5px dashed rgba(255,60,60,.7)"></i> safe zóna</span>
</div>
${panels}
<script>
  document.querySelectorAll(".tab").forEach(t=>t.onclick=()=>{
    document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(x=>x.classList.remove("active"));
    t.classList.add("active");
    document.querySelector('.panel[data-c="'+t.dataset.c+'"]').classList.add("active");
    window.scrollTo(0,0);
  });
</script>
</body></html>`;
}

fs.writeFileSync(__dirname + "/preview.html", build());
console.log("preview.html vytvorený — " + FORMATS.length + " formátov, " + Object.keys(CAMPAIGNS).length + " kampaní");
