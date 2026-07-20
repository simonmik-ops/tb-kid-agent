// demo.js — vývojový nástroj (nie súčasť servera)
// Postaví interaktívnu UKÁŽKU toho, ako plugin funguje: mock panel pluginu
// (výber kampane + typu + "nahranie" KV) → tlačidlo Generovať → zobrazia sa
// formáty presne tak, ako by ich plugin postavil vo Figme.
// Layouty sa počítajú z reálneho enginu (agent.getLayoutStrategy), takže
// ukážka je verná — nič sa nevymýšľa.
// Spustenie:  node demo.js   →   vytvorí demo.html

const fs = require("fs");
const FORMATS = require("./formats");
const CAMPAIGNS = FORMATS.campaigns;
const { getLayoutStrategy } = require("./agent");

const VA = { bg_r: 0.0, bg_g: 0.18, bg_b: 0.55, is_complex_visual: false, has_text: false,
  safe_to_crop_top: true, safe_to_crop_bottom: true, safe_to_crop_sides: true };
const RECIPE = { visualType: "centered_subject", subjectPosition: "center",
  cropMode: "protect_subject", smallFormatMode: "brand_panel", textMode: "auto", logoMode: "auto" };
const BRAND = "#002E8C";

// ── rovnaká logika umiestnenia ako v preview.js ────────────────────────
function placements(format, layout) {
  const els = [];
  const lt = layout.layout_type;
  const showImg = layout.image_fit !== "none" && layout.photo_width_pct > 0 && lt !== "logo_only";
  const brandPanel = layout.brand_color_pct > 0 && (lt === "strip" || lt === "split");
  if (lt === "logo_only") {
    els.push({ cls: "img logoOnlyBg", label: "", style: "left:0;top:0;right:0;bottom:0" });
  } else if (brandPanel) {
    const pw = layout.photo_width_pct;
    if (lt === "split") {
      els.push({ cls: "img", label: "KV", style: `left:0;top:0;width:${pw}%;bottom:0` });
      els.push({ cls: "brand", label: "", style: `right:0;top:0;width:${100 - pw}%;bottom:0` });
    } else {
      els.push({ cls: "brand", label: "", style: `left:0;top:0;width:${100 - pw}%;bottom:0` });
      els.push({ cls: "img", label: "KV", style: `right:0;top:0;width:${pw}%;bottom:0` });
    }
  } else if (showImg) {
    els.push({ cls: "img" + (layout.image_fit === "contain" ? " contain" : ""), label: "KV", style: "left:0;top:0;right:0;bottom:0" });
  } else {
    els.push({ cls: "brand", label: "", style: "left:0;top:0;right:0;bottom:0" });
  }
  if (layout.show_logo) (logoBox(layout.logo_position) || []).forEach(s => els.push({ cls: "logo", label: "logo", style: s }));
  if (layout.show_headline) { const p = headlineBox(layout.headline_position); if (p) els.push({ cls: "hl", label: "HEADLINE", style: p }); }
  return els;
}
function logoBox(pos) {
  const W = 26, H = 12;
  switch (pos) {
    case "top-left": return [`left:5%;top:5%;width:${W}%;height:${H}%`];
    case "top": return [`left:${(100 - W) / 2}%;top:5%;width:${W}%;height:${H}%`];
    case "top-right": return [`right:5%;top:5%;width:${W}%;height:${H}%`];
    case "safe-top": return [`left:${(100 - W) / 2}%;top:8%;width:${W}%;height:${H}%`];
    case "below-top-safe": return [`left:5%;top:14%;width:${W}%;height:${H}%`];
    case "center": return [`left:30%;top:38%;width:40%;height:24%`];
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
function safeOverlays(format) {
  const sz = format.safeZones || {}, W = format.width, H = format.height, out = [];
  const pct = (v, tot) => (v / tot) * 100;
  if (sz.top) out.push({ safe: false, style: `left:0;top:0;right:0;height:${pct(sz.top, H)}%` });
  if (sz.bottom) out.push({ safe: false, style: `left:0;bottom:0;right:0;height:${pct(sz.bottom, H)}%` });
  if (sz.sides) { out.push({ safe: false, style: `left:0;top:0;bottom:0;width:${pct(sz.sides, W)}%` }); out.push({ safe: false, style: `right:0;top:0;bottom:0;width:${pct(sz.sides, W)}%` }); }
  if (sz.left) out.push({ safe: false, style: `left:0;top:0;bottom:0;width:${pct(sz.left, W)}%` });
  if (sz.right) out.push({ safe: false, style: `right:0;top:0;bottom:0;width:${pct(sz.right, W)}%` });
  if (sz.centerWidth) { const w = pct(sz.centerWidth, W), top = sz.topOffset ? pct(sz.topOffset, H) : 0; out.push({ safe: true, style: `left:${(100 - w) / 2}%;top:${top}%;width:${w}%;bottom:0` }); }
  if (sz.safeInner) { const w = pct(sz.safeInner.width, W), h = pct(sz.safeInner.height, H); out.push({ safe: true, style: `left:${(100 - w) / 2}%;top:${Math.max(0, (100 - h) / 2)}%;width:${w}%;height:${Math.min(100, h)}%` }); }
  return out;
}

// ── dáta pre klienta ───────────────────────────────────────────────────
const DATA = FORMATS.map(f => {
  const layout = getLayoutStrategy(f, VA, RECIPE);
  return {
    c: f.campaign || "kid", type: f.type, channel: f.channel, name: f.name,
    w: f.width, h: f.height, count: f.count || 1, role: f.role || null,
    lt: layout.layout_type, note: f.notes || "",
    els: placements(f, layout), safes: safeOverlays(f)
  };
});

const CAMP_LIST = Object.keys(CAMPAIGNS).map(k => ({ id: k, label: CAMPAIGNS[k].label, tagging: CAMPAIGNS[k].tagging }));

const html = `<!DOCTYPE html><html lang="sk"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TB — Figma Generator · ukážka pluginu</title>
<style>
  :root{--brand:${BRAND};}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font:13px/1.45 -apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;background:#eef0f4;display:flex;min-height:100vh}
  /* ── panel pluginu (ľavá strana, ako vo Figme) ── */
  .plugin{width:340px;min-width:340px;background:#fff;border-right:1px solid #dfe3ea;padding:18px 18px 24px;position:sticky;top:0;height:100vh;overflow:auto}
  .plugin h1{font-size:15px;font-weight:800;color:var(--brand)}
  .plugin .sub{font-size:11px;color:#8a94a6;margin:2px 0 16px}
  label{display:block;font-size:11px;font-weight:700;color:#556;margin:14px 0 5px}
  select{width:100%;padding:8px 10px;border:1px solid #d7dce4;border-radius:7px;font:inherit;background:#fff}
  .kv{margin-top:6px;border:2px dashed #d0d5dd;border-radius:9px;padding:18px;text-align:center;background:#fafbfc;cursor:pointer}
  .kv.set{border-color:var(--brand);background:#f0f4ff}
  .kv .ic{font-size:22px}.kv .t{font-size:11px;color:#667;margin-top:4px}
  .kvthumb{width:100%;height:80px;border-radius:6px;margin-top:8px;background:linear-gradient(135deg,#3a5bbf,#00206b);display:none;align-items:center;justify-content:center;color:#fff;font-weight:700;letter-spacing:.05em}
  button.gen{width:100%;margin-top:18px;padding:11px;border:0;border-radius:9px;background:var(--brand);color:#fff;font:inherit;font-weight:800;cursor:pointer}
  button.gen:disabled{background:#b6bfd6;cursor:default}
  .prog{margin-top:12px;display:none}
  .bar{height:6px;background:#e6e9f0;border-radius:4px;overflow:hidden}.bar>i{display:block;height:100%;width:0;background:var(--brand);transition:width .25s}
  .pstat{font-size:11px;color:#667;margin-top:6px;min-height:15px}
  .flowbox{margin-top:18px;padding:11px;border:1px solid #e7eaf0;border-radius:9px;background:#f7f9fc;font-size:11px;color:#5a6472;line-height:1.5}
  .flowbox b{color:var(--brand)}
  /* ── výsledná plocha (pravá strana = Figma canvas) ── */
  .canvas{flex:1;padding:22px 26px 70px}
  .chead{font-size:16px;font-weight:800;color:#1a2233}
  .csub{font-size:12px;color:#8a94a6;margin:2px 0 4px}
  .tagpill{display:inline-block;background:#eef;color:var(--brand);border-radius:5px;padding:2px 8px;font-weight:800;font-family:ui-monospace,monospace;font-size:11px}
  .empty{margin-top:80px;text-align:center;color:#9aa3b2}
  .empty .big{font-size:40px}
  .chan{margin:24px 0 10px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#8a94a6;border-bottom:1px solid #e1e5ec;padding-bottom:5px}
  .chan span{color:#b6bdca}
  .grid{display:flex;flex-wrap:wrap;gap:18px}
  .card{width:200px;opacity:0;transform:translateY(8px);animation:pop .35s forwards}
  @keyframes pop{to{opacity:1;transform:none}}
  .frameWrap{display:flex;align-items:flex-end;justify-content:center;height:190px;margin-bottom:7px}
  .frame{position:relative;background:#fff;border:1px solid #cfd4dc;box-shadow:0 1px 5px rgba(0,0,0,.09);overflow:hidden}
  .el{position:absolute;display:flex;align-items:center;justify-content:center}
  .el span{font-size:8px;font-weight:800;letter-spacing:.04em;opacity:.85}
  .img{background:linear-gradient(135deg,#3a5bbf,#00206b);color:#fff}
  .img.contain{background:#dde3f0;color:#48c;border:1px dashed #9fb0d8}
  .logoOnlyBg{background:repeating-conic-gradient(#e9edf5 0 25%,#fff 0 50%) 0/14px 14px;color:#7a86a0}
  .brand{background:var(--brand);color:#cdd7f2}
  .logo{background:#fff;border:1px solid #cbd3e2;border-radius:3px;color:var(--brand);box-shadow:0 1px 2px rgba(0,0,0,.12)}
  .hl{background:rgba(255,255,255,.85);border:1px dashed #33415c;color:#22304a;border-radius:2px}
  .safeband{position:absolute;background:repeating-linear-gradient(45deg,rgba(255,60,60,.10) 0 5px,rgba(255,60,60,0) 5px 10px);border:1px solid rgba(255,60,60,.35)}
  .safebox{position:absolute;border:1.5px dashed rgba(255,60,60,.7)}
  .fname{font-weight:700;font-size:12px}
  .dims{color:#667;font-size:11px;font-family:ui-monospace,monospace}
  .tag{display:inline-block;font-size:9px;padding:1px 6px;border-radius:4px;margin:4px 4px 0 0;font-weight:800}
  .tag.role{background:#fde8c8;color:#8a5a00}.tag.lt{background:#e3ebff;color:var(--brand)}
  .note{font-size:10px;color:#889;margin-top:3px;line-height:1.3}
</style></head><body>
<aside class="plugin">
  <h1>TB — Figma Generator</h1>
  <div class="sub">Ukážka · takto by plugin fungoval vo Figme</div>

  <label>Kampaň</label>
  <select id="campaign"></select>

  <label>Typ / fáza</label>
  <select id="adType">
    <option value="awareness">Awareness</option>
    <option value="hardsell">Hardsell / Performance</option>
    <option value="remarketing">Remarketing</option>
  </select>

  <label>Key vizuál (KV)</label>
  <div class="kv" id="kv"><div class="ic">📁</div><div class="t">Klikni — použije sa ukážkový KV</div>
    <div class="kvthumb" id="kvthumb">KV</div></div>

  <button class="gen" id="gen">Generovať formáty</button>
  <div class="prog" id="prog"><div class="bar"><i id="barfill"></i></div><div class="pstat" id="pstat"></div></div>

  <div class="flowbox">
    <b>Ako to funguje:</b><br>
    1. Nahráš 1 KV a vyberieš kampaň + typ.<br>
    2. Plugin pošle KV na server (Railway + Claude), ktorý analyzuje vizuál a <b>deterministicky</b> rozhodne layout každého formátu.<br>
    3. Plugin postaví frames vo Figme — správne rozmery, safe zóny, umiestnené logo/headline. Nič sa nevymýšľa.
  </div>
</aside>

<main class="canvas">
  <div id="head"></div>
  <div id="out"><div class="empty"><div class="big">🎨</div><div>Vyber kampaň a typ, klikni <b>Generovať</b>.</div></div></div>
</main>

<script>
const DATA = ${JSON.stringify(DATA)};
const CAMPS = ${JSON.stringify(CAMP_LIST)};
const $ = id => document.getElementById(id);

const csel = $("campaign");
CAMPS.forEach(c => { const o = document.createElement("option"); o.value = c.id; o.textContent = c.label + " · " + c.tagging; csel.appendChild(o); });

let kvSet = false;
$("kv").onclick = () => { kvSet = true; $("kv").classList.add("set"); $("kvthumb").style.display = "flex"; $("kv").querySelector(".t").textContent = "Ukážkový KV nahraný ✔"; };

function cardHTML(f) {
  const MAX = 180, scale = MAX / Math.max(f.w, f.h);
  const w = Math.round(f.w * scale), h = Math.round(f.h * scale);
  const els = f.els.map(e => '<div class="el ' + e.cls + '" style="' + e.style + '">' + (e.label ? '<span>' + e.label + '</span>' : '') + '</div>').join("");
  const safes = f.safes.map(s => '<div class="' + (s.safe ? "safebox" : "safeband") + '" style="' + s.style + '"></div>').join("");
  const roleTag = (f.role && f.role !== f.lt) ? '<span class="tag role">' + f.role + '</span>' : '';
  return '<div class="card"><div class="frameWrap"><div class="frame" style="width:' + w + 'px;height:' + h + 'px">' + els + safes +
    '</div></div><div class="fname">' + f.name + '</div><div class="dims">' + f.w + '×' + f.h + (f.count > 1 ? ' · ' + f.count + '×' : '') +
    '</div><div>' + roleTag + '<span class="tag lt">' + f.lt + '</span></div><div class="note">' + f.note + '</div></div>';
}

$("gen").onclick = () => {
  if (!kvSet) { kvSet = true; $("kv").click(); }
  const c = csel.value, t = $("adType").value;
  const list = DATA.filter(f => f.c === c && f.type.includes(t));
  const camp = CAMPS.find(x => x.id === c);
  $("gen").disabled = true;
  $("prog").style.display = "block";
  $("out").innerHTML = "";
  $("head").innerHTML = "";

  if (!list.length) {
    $("barfill").style.width = "100%";
    $("pstat").textContent = 'Táto kampaň nemá formáty pre typ „' + t + '".';
    $("out").innerHTML = '<div class="empty"><div class="big">∅</div><div>Pre <b>' + camp.label + '</b> / ' + t + ' nie sú v TP žiadne statické formáty. Skús iný typ.</div></div>';
    $("gen").disabled = false;
    return;
  }

  // simulácia priebehu ako v reálnom plugine
  let step = 0; const steps = ["Analyzujem KV cez Claude…", "Plánujem layouty (" + list.length + " formátov)…", "Staviam frames vo Figme…"];
  $("pstat").textContent = steps[0]; $("barfill").style.width = "12%";
  const t1 = setTimeout(() => { $("pstat").textContent = steps[1]; $("barfill").style.width = "45%"; }, 500);
  const t2 = setTimeout(() => { $("pstat").textContent = steps[2]; $("barfill").style.width = "72%"; }, 1000);
  const t3 = setTimeout(() => {
    // hlavička
    $("head").innerHTML = '<div class="chead">' + camp.label + '</div><div class="csub"><span class="tagpill">' + camp.tagging + '</span> &nbsp;' + list.length + ' formátov · typ: ' + t + '</div>';
    // zoskup podľa kanála
    const byCh = {}; list.forEach(f => (byCh[f.channel] = byCh[f.channel] || []).push(f));
    let html = "";
    let idx = 0;
    Object.keys(byCh).forEach(ch => {
      html += '<h3 class="chan">' + ch + ' <span>' + byCh[ch].length + '</span></h3><div class="grid">';
      byCh[ch].forEach(f => { html += cardHTML(f).replace('class="card"', 'class="card" style="animation-delay:' + (idx * 25) + 'ms"'); idx++; });
      html += '</div>';
    });
    $("out").innerHTML = html;
    $("barfill").style.width = "100%";
    $("pstat").textContent = "Hotovo — " + list.length + " frameov vytvorených ✔";
    $("gen").disabled = false;
  }, 1450);
};
</script>
</body></html>`;

fs.writeFileSync(__dirname + "/demo.html", html);
console.log("demo.html vytvorený — interaktívna ukážka pluginu (" + DATA.length + " formátov)");
