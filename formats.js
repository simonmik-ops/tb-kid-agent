// formats.js
// Každý formát má: id, name, channel, width, height, type[], safeZones, notes

const FORMATS = [

  // ─── SOCIAL VIDEO ───────────────────────────────────────────
  {
    id: "tiktok_video",
    name: "TikTok video",
    channel: "Social",
    width: 1080,
    height: 1920,
    ratio: "9:16",
    type: ["awareness"],
    count: 3,
    safeZones: { top: 270, bottom: 270 },
    notes: "Iba video placeholder. App name 4–40 zn., brand name 2–20 zn., description 12–100 zn."
  },
  {
    id: "ig_reels",
    name: "Instagram Reels",
    channel: "Social",
    width: 1080,
    height: 1920,
    ratio: "9:16",
    type: ["awareness"],
    count: 3,
    noLogo: true,
    safeZones: { top: 269, bottom: 269 },
    notes: "Vizuál bez loga, iba headline. Voľná zóna ~14% hore aj dole."
  },
  {
    id: "meta_video_1x1",
    name: "Meta video 1:1",
    channel: "Social",
    width: 1200,
    height: 1200,
    ratio: "1:1",
    type: ["awareness", "hardsell"],
    count: 3,
    safeZones: { top: 0, bottom: 0 },
    notes: "Thumbnail v rozmere videa. Titulky odporúčané."
  },
  {
    id: "meta_video_4x5",
    name: "Meta video 4:5",
    channel: "Social",
    width: 1200,
    height: 1500,
    ratio: "4:5",
    type: ["awareness", "hardsell"],
    count: 3,
    safeZones: { top: 0, bottom: 0 },
    notes: "Iba mobil."
  },
  {
    id: "meta_video_9x16",
    name: "Meta video 9:16",
    channel: "Social",
    width: 1080,
    height: 1920,
    ratio: "9:16",
    type: ["awareness", "hardsell"],
    count: 3,
    safeZones: { top: 0, bottom: 0 },
    notes: "Stories + Reels placement."
  },

  // ─── META IMAGE ──────────────────────────────────────────────
  {
    id: "meta_img_1x1",
    name: "Meta image 1:1",
    channel: "Meta",
    width: 1200,
    height: 1200,
    ratio: "1:1",
    type: ["awareness", "hardsell", "remarketing"],
    count: 5,
    safeZones: { top: 0, bottom: 0 },
    notes: "Vizuál s headlineom a logom. CTA doťahuje systém."
  },
  {
    id: "meta_img_4x5",
    name: "Meta image 4:5",
    channel: "Meta",
    width: 1200,
    height: 1628,
    ratio: "4:5",
    type: ["awareness", "hardsell", "remarketing"],
    count: 5,
    safeZones: { top: 0, bottom: 0 },
    notes: "Iba mobil."
  },
  {
    id: "meta_img_9x16",
    name: "Meta image 9:16",
    channel: "Meta",
    width: 1080,
    height: 1920,
    ratio: "9:16",
    type: ["awareness", "hardsell", "remarketing"],
    count: 5,
    safeZones: { top: 0, bottom: 0 },
    notes: "Stories placement."
  },

  // ─── PINTEREST ───────────────────────────────────────────────
  {
    id: "pinterest_pin",
    name: "Pinterest Pin Ads",
    channel: "Pinterest",
    width: 1000,
    height: 1500,
    ratio: "2:3",
    type: ["awareness"],
    count: 3,
    logoPosition: "top",
    safeZones: { top: 80, bottom: 80 },
    notes: "Logo viditeľné v hornej časti (nie spodný roh). Text overlay max 5 slov / 30% plochy. Cielenie: Ženy 30–50."
  },

  // ─── GOOGLE RESPONSIVE ADS ──────────────────────────────────
  {
    id: "google_rsa_landscape",
    name: "Google RSA 1200×628",
    channel: "Google",
    width: 1200,
    height: 628,
    ratio: "1.91:1",
    type: ["awareness", "hardsell", "remarketing"],
    count: 2,
    safeZones: { top: 0, bottom: 0 },
    notes: "Landscape. Min 1 podklad."
  },
  {
    id: "google_rsa_square",
    name: "Google RSA 1200×1200",
    channel: "Google",
    width: 1200,
    height: 1200,
    ratio: "1:1",
    type: ["awareness", "hardsell", "remarketing"],
    count: 2,
    safeZones: { top: 0, bottom: 0 },
    notes: "Square. Min 1 podklad."
  },
  {
    id: "google_rsa_story",
    name: "Google RSA 900×1600 (story)",
    channel: "Google",
    width: 900,
    height: 1600,
    ratio: "9:16",
    type: ["awareness", "hardsell", "remarketing"],
    count: 2,
    safeZones: { top: 0, bottom: 0 },
    notes: "Story/portrait. Nepovinné ale odporúčané."
  },
  {
    id: "google_logo_square",
    name: "Google Logo 1200×1200",
    channel: "Google",
    width: 1200,
    height: 1200,
    ratio: "1:1",
    type: ["awareness", "hardsell", "remarketing"],
    count: 1,
    safeZones: { top: 0, bottom: 0 },
    notes: "Transparentné pozadie. Min 128×128."
  },
  {
    id: "google_logo_wide",
    name: "Google Logo 1200×300",
    channel: "Google",
    width: 1200,
    height: 300,
    ratio: "4:1",
    type: ["awareness", "hardsell", "remarketing"],
    count: 1,
    safeZones: { top: 0, bottom: 0 },
    notes: "Transparentné pozadie. Min 512×128."
  },

  // ─── GOOGLE DEMAND GEN ───────────────────────────────────────
  {
    id: "demandgen_landscape",
    name: "Demand Gen 1200×628",
    channel: "Google DemandGen",
    width: 1200,
    height: 628,
    ratio: "1.91:1",
    type: ["awareness", "hardsell"],
    count: 2,
    safeZones: { top: 0, bottom: 0 },
    notes: "YouTube, Discover, Gmail."
  },
  {
    id: "demandgen_square",
    name: "Demand Gen 1200×1200",
    channel: "Google DemandGen",
    width: 1200,
    height: 1200,
    ratio: "1:1",
    type: ["awareness", "hardsell"],
    count: 2,
    safeZones: { top: 0, bottom: 0 },
    notes: "YouTube, Discover, Gmail."
  },
  {
    id: "demandgen_portrait",
    name: "Demand Gen 960×1200",
    channel: "Google DemandGen",
    width: 960,
    height: 1200,
    ratio: "4:5",
    type: ["awareness", "hardsell"],
    count: 2,
    safeZones: { top: 0, bottom: 0 },
    notes: "Portrait. YouTube, Discover, Gmail."
  },

  // ─── GOOGLE PERFORMANCE MAX ──────────────────────────────────
  {
    id: "pmax_landscape",
    name: "PMax 1200×628",
    channel: "Google PMax",
    width: 1200,
    height: 628,
    ratio: "1.91:1",
    type: ["awareness", "hardsell"],
    count: 2,
    safeZones: { top: 0, bottom: 0 },
    notes: "Iba headline — CTA a logo doťahuje systém."
  },
  {
    id: "pmax_square",
    name: "PMax 1200×1200",
    channel: "Google PMax",
    width: 1200,
    height: 1200,
    ratio: "1:1",
    type: ["awareness", "hardsell"],
    count: 2,
    safeZones: { top: 0, bottom: 0 },
    notes: "Iba headline."
  },
  {
    id: "pmax_portrait",
    name: "PMax 960×1200",
    channel: "Google PMax",
    width: 960,
    height: 1200,
    ratio: "4:5",
    type: ["awareness", "hardsell"],
    count: 2,
    safeZones: { top: 0, bottom: 0 },
    notes: "Iba headline."
  },

  // ─── ADFORM IAB ──────────────────────────────────────────────
  {
    id: "adform_300x250",
    name: "Adform 300×250",
    channel: "Adform",
    template: "adform_psd_reference",
    width: 300,
    height: 250,
    ratio: "6:5",
    type: ["awareness"],
    count: 2,
    safeZones: { top: 0, bottom: 0 },
    notes: "Medium Rectangle. Max 300 kB."
  },
  {
    id: "adform_300x600",
    name: "Adform 300×600",
    channel: "Adform",
    template: "adform_psd_reference",
    width: 300,
    height: 600,
    ratio: "1:2",
    type: ["awareness"],
    count: 2,
    safeZones: { top: 0, bottom: 0 },
    notes: "Half Page. Max 300 kB."
  },
  {
    id: "adform_160x600",
    name: "Adform 160×600",
    channel: "Adform",
    template: "adform_psd_reference",
    width: 160,
    height: 600,
    ratio: "4:15",
    type: ["awareness"],
    count: 2,
    safeZones: { top: 0, bottom: 0 },
    notes: "Wide Skyscraper. Max 300 kB."
  },
  {
    id: "adform_970x250",
    name: "Adform 970×250",
    channel: "Adform",
    template: "adform_psd_reference",
    width: 970,
    height: 250,
    ratio: "97:25",
    type: ["awareness"],
    count: 2,
    safeZones: { top: 0, bottom: 0 },
    notes: "Billboard. Max 300 kB."
  },

  // ─── MARKÍZA ─────────────────────────────────────────────────
  {
    id: "markiza_branding_full",
    name: "Markíza branding 2000×1400",
    channel: "Markíza",
    width: 2000,
    height: 1400,
    ratio: "10:7",
    type: ["awareness"],
    count: 1,
    safeZones: { centerWidth: 1000, topOffset: 200 },
    notes: "Full page branding. Safe zóna: 1000px stred, 200px od vrchu. Hlavný odkaz max 140px od okraja."
  },
  {
    id: "markiza_branding_leader",
    name: "Markíza branding 1000×200",
    channel: "Markíza",
    width: 1000,
    height: 200,
    ratio: "5:1",
    type: ["awareness"],
    count: 1,
    safeZones: { left: 0, right: 0 },
    notes: "Hlavný odkaz max 140px od okraja. Časť brandingu."
  },
  {
    id: "markiza_branding_side",
    name: "Markíza branding 120×600",
    channel: "Markíza",
    width: 120,
    height: 600,
    ratio: "1:5",
    type: ["awareness"],
    count: 2,
    safeZones: { top: 0, bottom: 0 },
    notes: "2× bočné bannery (ľavý + pravý)."
  },
  {
    id: "markiza_interscroller",
    name: "Markíza interscroller 720×1280",
    channel: "Markíza",
    width: 720,
    height: 1280,
    ratio: "9:16",
    type: ["awareness", "hardsell"],
    count: 1,
    safeZones: { top: 0, bottom: 0 },
    notes: "Max 300 kB jpg."
  },

  // ─── JOJ ─────────────────────────────────────────────────────
  {
    id: "joj_branding",
    name: "JOJ branding 2000×1400",
    channel: "JOJ",
    width: 2000,
    height: 1400,
    ratio: "10:7",
    type: ["awareness"],
    count: 1,
    safeZones: { centerWidth: 1000, topOffset: 200 },
    notes: "Biela plocha pod obsahom. 1000px v strede pod leaderboardom, 200px od vrchu. HTML5 vopred schváliť."
  },
  {
    id: "joj_interscroller_mobile",
    name: "JOJ interscroller 300×600",
    channel: "JOJ",
    width: 300,
    height: 600,
    ratio: "1:2",
    type: ["awareness", "hardsell"],
    count: 1,
    safeZones: { top: 0, bottom: 0 },
    notes: "Mobile."
  },
  {
    id: "joj_interscroller_desktop",
    name: "JOJ interscroller 600×960",
    channel: "JOJ",
    width: 600,
    height: 960,
    ratio: "5:8",
    type: ["awareness", "hardsell"],
    count: 1,
    safeZones: { top: 0, bottom: 0 },
    notes: "Desktop."
  },

  // ─── RINGIER ─────────────────────────────────────────────────
  {
    id: "ringier_leaderboard",
    name: "Ringier leaderboard 1200×400",
    channel: "Ringier",
    width: 1200,
    height: 400,
    ratio: "3:1",
    type: ["awareness"],
    count: 1,
    safeZones: { top: 0, bottom: 0 },
    notes: "Cielenie: návštevníci najmama.sk. Max 150 kB."
  },
  {
    id: "ringier_interscroller",
    name: "Ringier interscroller 720×1280",
    channel: "Ringier",
    width: 720,
    height: 1280,
    ratio: "9:16",
    type: ["awareness", "hardsell"],
    count: 1,
    safeZones: { top: 0, bottom: 0 },
    notes: "Max 250 kB. Cielenie: najmama.sk."
  },

  // ─── ŽENSKÉ WEBY ─────────────────────────────────────────────
  {
    id: "zenske_branding_top",
    name: "Ženské weby TOP 1200×200",
    channel: "Ženské weby",
    width: 1200,
    height: 200,
    ratio: "6:1",
    type: ["awareness"],
    count: 1,
    safeZones: { top: 0, bottom: 0 },
    notes: "casprezeny, dobrejedlo, emma, eva, izdravie, sarm, zena."
  },
  {
    id: "zenske_branding_side",
    name: "Ženské weby SIDE 160×600",
    channel: "Ženské weby",
    width: 160,
    height: 600,
    ratio: "4:15",
    type: ["awareness"],
    count: 2,
    safeZones: { top: 0, bottom: 0 },
    notes: "Message, logo a text v 120×600. Zvyšok — pozadie."
  },
  {
    id: "zenske_interscroller",
    name: "Ženské weby interscroller 750×1624",
    channel: "Ženské weby",
    width: 750,
    height: 1624,
    ratio: "~9:16",
    type: ["awareness", "hardsell"],
    count: 1,
    safeZones: { top: 321, bottom: 321, sides: 50 },
    notes: "Safe zóna 750×982 (stred). Ochranná zóna na krajoch 50px."
  },

  // ─── TOPKY ───────────────────────────────────────────────────
  {
    id: "topky_branding",
    name: "Topky branding 120×600",
    channel: "Topky",
    width: 450,
    height: 800,
    ratio: "~9:16",
    type: ["awareness"],
    count: 2,
    safeZones: { safeInner: { width: 160, height: 600 } },
    notes: "Rozsah 120×600 až 450×800. Hlavný odkaz v safe zóne 160×600. 2× boky."
  },
  {
    id: "topky_interscroller",
    name: "Topky interscroller 400×600",
    channel: "Topky",
    width: 400,
    height: 600,
    ratio: "2:3",
    type: ["awareness", "hardsell"],
    count: 1,
    safeZones: { top: 30 },
    notes: "Bez textu/dôležitých prvkov v horných 30px. HTML5 musí byť responzívne."
  },

  // ─── ENGERIO NATIVE ──────────────────────────────────────────
  {
    id: "engerio_native",
    name: "Engerio native 4:3",
    channel: "Native",
    width: 800,
    height: 600,
    ratio: "4:3",
    type: ["awareness", "hardsell"],
    count: 3,
    noLogo: true,
    safeZones: { top: 0, bottom: 0 },
    notes: "Bez loga, centrovaný objekt. Min 375×250. Viac variantov pre A/B test."
  },

  // ─── E-MAIL & DM ─────────────────────────────────────────────
  {
    id: "modrykonik_email",
    name: "Modrý koník e-mail 730×1000",
    channel: "E-mail",
    width: 730,
    height: 1000,
    ratio: "~3:4",
    type: ["awareness"],
    count: 1,
    safeZones: { top: 0, bottom: 0 },
    notes: "Fixná šírka 730px. Cielenie: maminy s deťmi 7–15r. Odosielateľ 32zn., predmet 32zn."
  },
  {
    id: "azet_dm",
    name: "Azet DM 640×500",
    channel: "E-mail",
    width: 640,
    height: 500,
    ratio: "~4:3",
    type: ["awareness"],
    count: 1,
    safeZones: { top: 0, bottom: 0 },
    notes: "Max šírka 640px, min výška 500px. Cielenie: ženy 30–50r. Predmet 80zn., odosielateľ 25zn."
  },
  {
    id: "nmh_dm",
    name: "NMH DM 500×800",
    channel: "E-mail",
    width: 500,
    height: 800,
    ratio: "5:8",
    type: ["awareness"],
    count: 1,
    safeZones: { top: 0, bottom: 0 },
    notes: "Max šírka 500px, max výška 800px. Predmet 45zn. bez diakritiky. Cielenie: ženy 30–50r."
  },

  // ─── VINTED ──────────────────────────────────────────────────
  {
    id: "vinted_300x250",
    name: "Vinted 300×250",
    channel: "Vinted",
    width: 300,
    height: 250,
    ratio: "6:5",
    type: ["awareness", "hardsell"],
    count: 1,
    safeZones: { top: 0, bottom: 0 },
    notes: "App banner. Cielenie: 25–54r., rodičia s deťmi do 15r."
  },
  {
    id: "vinted_320x50",
    name: "Vinted 320×50",
    channel: "Vinted",
    width: 320,
    height: 50,
    ratio: "32:5",
    type: ["awareness", "hardsell"],
    count: 1,
    safeZones: { top: 0, bottom: 0 },
    notes: "App mobile banner."
  },
  {
    id: "vinted_300x600",
    name: "Vinted 300×600",
    channel: "Vinted",
    width: 300,
    height: 600,
    ratio: "1:2",
    type: ["awareness", "hardsell"],
    count: 1,
    safeZones: { top: 0, bottom: 0 },
    notes: "Desktop half page."
  },
  {
    id: "vinted_970x250",
    name: "Vinted 970×250",
    channel: "Vinted",
    width: 970,
    height: 250,
    ratio: "97:25",
    type: ["awareness", "hardsell"],
    count: 1,
    safeZones: { top: 0, bottom: 0 },
    notes: "Desktop billboard."
  },
  {
    id: "vinted_728x90",
    name: "Vinted 728×90",
    channel: "Vinted",
    width: 728,
    height: 90,
    ratio: "~8:1",
    type: ["awareness", "hardsell"],
    count: 1,
    safeZones: { top: 0, bottom: 0 },
    notes: "Leaderboard."
  },

  // ═══════════════════════════════════════════════════════════════
  //  KK VISA — kreditné karty (kk-visa-072026)
  //  Zdroj: TP_TB_kkvisa072026.pdf + TP_MP_TABA_KK_78_v1_final.xlsx
  //  Varianty kariet (standard/zlatá/platinum/all) = ktorý KV nahráš.
  // ═══════════════════════════════════════════════════════════════
  { id: "kkv_meta_img_1x1", name: "Meta image 1:1", channel: "Meta", campaign: "kkvisa", width: 1200, height: 1200, ratio: "1:1", type: ["hardsell","remarketing"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "S logom a HDL, CTA doťahuje systém." },
  { id: "kkv_meta_img_4x5", name: "Meta image 4:5", channel: "Meta", campaign: "kkvisa", width: 1200, height: 1500, ratio: "4:5", type: ["hardsell","remarketing"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Iba mobil." },
  { id: "kkv_meta_img_9x16", name: "Meta image 9:16", channel: "Meta", campaign: "kkvisa", width: 1080, height: 1920, ratio: "9:16", type: ["hardsell","remarketing"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Stories placement." },
  { id: "kkv_meta_pplad", name: "Meta page post link ad 1:1", channel: "Meta", campaign: "kkvisa", width: 1200, height: 1200, ratio: "1:1", type: ["remarketing"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "RMK single image, s headlineom a logom." },
  { id: "kkv_google_rsa_landscape", name: "Google RSA 1200×628", channel: "Google", campaign: "kkvisa", role: "clean_image", width: 1200, height: 628, ratio: "1.91:1", type: ["hardsell","remarketing"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Obrázky BEZ textu." },
  { id: "kkv_google_rsa_square", name: "Google RSA 1200×1200", channel: "Google", campaign: "kkvisa", role: "clean_image", width: 1200, height: 1200, ratio: "1:1", type: ["hardsell","remarketing"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Obrázky BEZ textu." },
  { id: "kkv_google_rsa_story", name: "Google RSA 900×1600", channel: "Google", campaign: "kkvisa", role: "clean_image", width: 900, height: 1600, ratio: "9:16", type: ["hardsell","remarketing"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Story, nepovinné. BEZ textu." },
  { id: "kkv_google_logo_square", name: "Google Logo 1200×1200", channel: "Google", campaign: "kkvisa", role: "logo_only", width: 1200, height: 1200, ratio: "1:1", type: ["hardsell"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Transparentné pozadie." },
  { id: "kkv_google_logo_wide", name: "Google Logo 1200×300", channel: "Google", campaign: "kkvisa", role: "logo_only", width: 1200, height: 300, ratio: "4:1", type: ["hardsell"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Transparentné pozadie." },
  { id: "kkv_demandgen_landscape", name: "Demand Gen 1200×628", channel: "Google DemandGen", campaign: "kkvisa", width: 1200, height: 628, ratio: "1.91:1", type: ["hardsell"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Graficky kompletné: headline + CTA + logo." },
  { id: "kkv_demandgen_square", name: "Demand Gen 1200×1200", channel: "Google DemandGen", campaign: "kkvisa", width: 1200, height: 1200, ratio: "1:1", type: ["hardsell"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Graficky kompletné: headline + CTA + logo." },
  { id: "kkv_demandgen_portrait", name: "Demand Gen 960×1200", channel: "Google DemandGen", campaign: "kkvisa", width: 960, height: 1200, ratio: "4:5", type: ["hardsell"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Graficky kompletné." },
  { id: "kkv_pmax_landscape", name: "PMax 1200×628", channel: "Google PMax", campaign: "kkvisa", role: "headline_only", width: 1200, height: 628, ratio: "1.91:1", type: ["hardsell"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Iba headline — CTA a logo doťahuje systém." },
  { id: "kkv_pmax_square", name: "PMax 1200×1200", channel: "Google PMax", campaign: "kkvisa", role: "headline_only", width: 1200, height: 1200, ratio: "1:1", type: ["hardsell"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Iba headline." },
  { id: "kkv_pmax_portrait", name: "PMax 960×1200", channel: "Google PMax", campaign: "kkvisa", role: "headline_only", width: 960, height: 1200, ratio: "4:5", type: ["hardsell"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Iba headline." },
  { id: "kkv_markiza_branding_full", name: "Markíza branding 2000×1400", channel: "Markíza", campaign: "kkvisa", role: "branding_full", width: 2000, height: 1400, ratio: "10:7", type: ["hardsell"], count: 1, safeZones: { centerWidth: 1000, topOffset: 200 }, notes: "1 vizuál pre všetky karty. PSD template publishera." },
  { id: "kkv_markiza_branding_leader", name: "Markíza branding 1000×200", channel: "Markíza", campaign: "kkvisa", width: 1000, height: 200, ratio: "5:1", type: ["hardsell"], count: 1, safeZones: { left: 140, right: 140 }, notes: "Odkaz max 140px od okraja." },
  { id: "kkv_markiza_branding_side", name: "Markíza branding 120×600", channel: "Markíza", campaign: "kkvisa", role: "branding_side", width: 120, height: 600, ratio: "1:5", type: ["hardsell"], count: 2, safeZones: { safeInner: { width: 120, height: 600 } }, notes: "2× boky." },
  { id: "kkv_joj_branding", name: "JOJ branding 2000×1400", channel: "JOJ", campaign: "kkvisa", role: "branding_full", width: 2000, height: 1400, ratio: "10:7", type: ["hardsell"], count: 1, safeZones: { centerWidth: 1000, topOffset: 200 }, notes: "Biela plocha v strede, 200px od vrchu." },
  { id: "kkv_nmh_branding_leader", name: "NMH branding 1240×200", channel: "NMH", campaign: "kkvisa", width: 1240, height: 200, ratio: "6.2:1", type: ["hardsell"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "cas/plus7dni/pluska/zivot." },
  { id: "kkv_nmh_branding_side", name: "NMH branding 160×600", channel: "NMH", campaign: "kkvisa", role: "branding_side", width: 160, height: 600, ratio: "4:15", type: ["hardsell"], count: 2, safeZones: { safeInner: { width: 120, height: 600 } }, notes: "Safe zóna 120×600. 2× boky." },
  { id: "kkv_hnonline_branding_leader", name: "hnonline branding 1275×250", channel: "hnonline", campaign: "kkvisa", width: 1275, height: 250, ratio: "5.1:1", type: ["hardsell"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "K HTML5 dodať .jpg backup." },
  { id: "kkv_hnonline_branding_side", name: "hnonline branding 160×600", channel: "hnonline", campaign: "kkvisa", role: "branding_side", width: 160, height: 600, ratio: "4:15", type: ["hardsell"], count: 2, safeZones: { safeInner: { width: 120, height: 600 } }, notes: "2× boky." },
  { id: "kkv_sme_branding_leader_a", name: "sme branding 1000×200", channel: "sme", campaign: "kkvisa", width: 1000, height: 200, ratio: "5:1", type: ["hardsell"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Top A — dodať oba topy." },
  { id: "kkv_sme_branding_leader_b", name: "sme branding 1200×200", channel: "sme", campaign: "kkvisa", width: 1200, height: 200, ratio: "6:1", type: ["hardsell"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Top B — dodať oba topy." },
  { id: "kkv_sme_branding_side", name: "sme branding 160×600", channel: "sme", campaign: "kkvisa", role: "branding_side", width: 160, height: 600, ratio: "4:15", type: ["hardsell"], count: 2, safeZones: { safeInner: { width: 120, height: 600 } }, notes: "Iba statika. 2× boky." },
  { id: "kkv_pravda_branding_leader", name: "pravda branding 1200×200", channel: "pravda", campaign: "kkvisa", width: 1200, height: 200, ratio: "6:1", type: ["hardsell"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Top." },
  { id: "kkv_pravda_branding_side", name: "pravda branding 200×700", channel: "pravda", campaign: "kkvisa", role: "branding_side", width: 200, height: 700, ratio: "2:7", type: ["hardsell"], count: 2, safeZones: { safeInner: { width: 120, height: 600 } }, notes: "2× boky." },
  { id: "kkv_int_markiza", name: "Markíza interscroller 720×1280", channel: "Markíza", campaign: "kkvisa", role: "interscroller", width: 720, height: 1280, ratio: "9:16", type: ["hardsell"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "3 vizuály — každá karta zvlášť." },
  { id: "kkv_int_joj_mobile", name: "JOJ interscroller 300×600", channel: "JOJ", campaign: "kkvisa", role: "interscroller", width: 300, height: 600, ratio: "1:2", type: ["hardsell"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Mobile. Adform template." },
  { id: "kkv_int_joj_desktop", name: "JOJ interscroller 600×960", channel: "JOJ", campaign: "kkvisa", role: "interscroller", width: 600, height: 960, ratio: "5:8", type: ["hardsell"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Desktop." },
  { id: "kkv_int_nmh", name: "NMH interscroller 750×1624", channel: "NMH", campaign: "kkvisa", role: "interscroller", width: 750, height: 1624, ratio: "~9:16", type: ["hardsell"], count: 1, safeZones: { top: 321, bottom: 321 }, notes: "Safe zóna 750×982 v strede." },
  { id: "kkv_int_hnonline", name: "hnonline interscroller 400×600", channel: "hnonline", campaign: "kkvisa", role: "interscroller", width: 400, height: 600, ratio: "2:3", type: ["hardsell"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Responsive to all mobile." },
  { id: "kkv_int_sme", name: "sme interscroller 320×600", channel: "sme", campaign: "kkvisa", role: "interscroller", width: 320, height: 600, ratio: "8:15", type: ["hardsell"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Max 50 kB jpg." },
  { id: "kkv_int_pravda", name: "pravda interscroller 300×600", channel: "pravda", campaign: "kkvisa", role: "interscroller", width: 300, height: 600, ratio: "1:2", type: ["hardsell"], count: 1, safeZones: { sides: 50 }, notes: "Ochranná zóna 50px z bokov." },
  { id: "kkv_int_refresher", name: "Refresher double square 300×600", channel: "Refresher", campaign: "kkvisa", role: "interscroller", width: 300, height: 600, ratio: "1:2", type: ["hardsell"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "3 vizuály — každá karta zvlášť." },
  { id: "kkv_engerio_native", name: "Engerio native 4:3", channel: "Native", campaign: "kkvisa", role: "native", width: 1200, height: 900, ratio: "4:3", type: ["hardsell"], count: 1, noLogo: true, safeZones: { top: 0, bottom: 0 }, notes: "Bez loga, bez textu, centrovaný. Min 375×250." },

  // ═══════════════════════════════════════════════════════════════
  //  DIGITÁLNA HYPOTÉKA (hypo-052025)
  //  Zdroj: TP_PPC_TB_INT_Digitálna hypotéka_57_2025_v3.xlsx
  // ═══════════════════════════════════════════════════════════════
  { id: "hyp_adform_300x250", name: "Adform 300×250", channel: "Adform", campaign: "hypo", width: 300, height: 250, ratio: "6:5", type: ["awareness"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Max 150 kB. Dodať aj hardsell varianty." },
  { id: "hyp_adform_300x600", name: "Adform 300×600", channel: "Adform", campaign: "hypo", width: 300, height: 600, ratio: "1:2", type: ["awareness"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Max 150 kB." },
  { id: "hyp_adform_160x600", name: "Adform 160×600", channel: "Adform", campaign: "hypo", width: 160, height: 600, ratio: "4:15", type: ["awareness"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Max 150 kB." },
  { id: "hyp_adform_970x250", name: "Adform 970×250", channel: "Adform", campaign: "hypo", width: 970, height: 250, ratio: "97:25", type: ["awareness"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Max 150 kB." },
  { id: "hyp_yt_companion", name: "YouTube companion 300×60", channel: "YouTube", campaign: "hypo", width: 300, height: 60, ratio: "5:1", type: ["awareness"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Sprievodný banner k video reklame. 150 kB." },
  { id: "hyp_meta_img_1x1", name: "Meta image 1:1", channel: "Meta", campaign: "hypo", width: 1200, height: 1200, ratio: "1:1", type: ["hardsell"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Automatic placements. S headlineom a logom." },
  { id: "hyp_meta_img_4x5", name: "Meta image 4:5", channel: "Meta", campaign: "hypo", width: 1200, height: 1500, ratio: "4:5", type: ["hardsell"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "POZOR: TP uvádza 1200×628 pri 4:5 — pravdepodobne preklep, over s kolegyňami (štandard 1200×1500)." },
  { id: "hyp_meta_img_9x16", name: "Meta image 9:16", channel: "Meta", campaign: "hypo", width: 1080, height: 1920, ratio: "9:16", type: ["hardsell"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Automatic placements." },
  { id: "hyp_meta_carousel", name: "Meta carousel karta 1:1", channel: "Meta", campaign: "hypo", width: 1200, height: 1200, ratio: "1:1", type: ["awareness"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "2–10 kariet. Headline 22 zn., description 12 zn." },
  { id: "hyp_google_rsa_landscape", name: "Google RSA 1200×628", channel: "Google", campaign: "hypo", role: "clean_image", width: 1200, height: 628, ratio: "1.91:1", type: ["hardsell","remarketing"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Obrázky BEZ textu." },
  { id: "hyp_google_rsa_square", name: "Google RSA 1200×1200", channel: "Google", campaign: "hypo", role: "clean_image", width: 1200, height: 1200, ratio: "1:1", type: ["hardsell","remarketing"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "BEZ textu." },
  { id: "hyp_google_rsa_story", name: "Google RSA 900×1600", channel: "Google", campaign: "hypo", role: "clean_image", width: 900, height: 1600, ratio: "9:16", type: ["hardsell","remarketing"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Story, nepovinné." },
  { id: "hyp_google_logo_square", name: "Google Logo 1200×1200", channel: "Google", campaign: "hypo", role: "logo_only", width: 1200, height: 1200, ratio: "1:1", type: ["hardsell","remarketing"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Transparentné pozadie." },
  { id: "hyp_google_logo_wide", name: "Google Logo 1200×300", channel: "Google", campaign: "hypo", role: "logo_only", width: 1200, height: 300, ratio: "4:1", type: ["hardsell","remarketing"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Transparentné pozadie." },
  { id: "hyp_demandgen_landscape", name: "Demand Gen 1200×628", channel: "Google DemandGen", campaign: "hypo", width: 1200, height: 628, ratio: "1.91:1", type: ["hardsell"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Graficky kompletné: headline + CTA + logo." },
  { id: "hyp_demandgen_square", name: "Demand Gen 1200×1200", channel: "Google DemandGen", campaign: "hypo", width: 1200, height: 1200, ratio: "1:1", type: ["hardsell"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Graficky kompletné." },
  { id: "hyp_demandgen_portrait", name: "Demand Gen 960×1200", channel: "Google DemandGen", campaign: "hypo", width: 960, height: 1200, ratio: "4:5", type: ["hardsell"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Graficky kompletné." },

  // ═══════════════════════════════════════════════════════════════
  //  BSU — Bezúčelový úver (bsu-082025)
  //  Zdroj: TP_PPC_BSU892025.xlsx + TP_Direct_INT_BSU89_2025_v1.xlsx
  //  „Nové úvery" / „Refinancovanie" = ktorý KV nahráš.
  // ═══════════════════════════════════════════════════════════════
  { id: "bsu_adform_300x250", name: "Adform 300×250", channel: "Adform", campaign: "bsu", width: 300, height: 250, ratio: "6:5", type: ["awareness"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Max 100 kB." },
  { id: "bsu_adform_300x600", name: "Adform 300×600", channel: "Adform", campaign: "bsu", width: 300, height: 600, ratio: "1:2", type: ["awareness"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Max 100 kB." },
  { id: "bsu_adform_160x600", name: "Adform 160×600", channel: "Adform", campaign: "bsu", width: 160, height: 600, ratio: "4:15", type: ["awareness"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Max 100 kB." },
  { id: "bsu_adform_970x250", name: "Adform 970×250", channel: "Adform", campaign: "bsu", width: 970, height: 250, ratio: "97:25", type: ["awareness"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Max 100 kB." },
  { id: "bsu_google_rsa_landscape", name: "Google RSA 1200×628", channel: "Google", campaign: "bsu", role: "clean_image", width: 1200, height: 628, ratio: "1.91:1", type: ["hardsell","remarketing"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Obrázky BEZ textu." },
  { id: "bsu_google_rsa_square", name: "Google RSA 1200×1200", channel: "Google", campaign: "bsu", role: "clean_image", width: 1200, height: 1200, ratio: "1:1", type: ["hardsell","remarketing"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "BEZ textu." },
  { id: "bsu_google_rsa_story", name: "Google RSA 900×1600", channel: "Google", campaign: "bsu", role: "clean_image", width: 900, height: 1600, ratio: "9:16", type: ["hardsell","remarketing"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Story, nepovinné." },
  { id: "bsu_google_logo_square", name: "Google Logo 1200×1200", channel: "Google", campaign: "bsu", role: "logo_only", width: 1200, height: 1200, ratio: "1:1", type: ["hardsell","remarketing"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Transparentné pozadie." },
  { id: "bsu_google_logo_wide", name: "Google Logo 1200×300", channel: "Google", campaign: "bsu", role: "logo_only", width: 1200, height: 300, ratio: "4:1", type: ["hardsell","remarketing"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Transparentné pozadie." },
  { id: "bsu_demandgen_landscape", name: "Demand Gen 1200×628", channel: "Google DemandGen", campaign: "bsu", width: 1200, height: 628, ratio: "1.91:1", type: ["hardsell"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Graficky kompletné: headline + CTA + logo." },
  { id: "bsu_demandgen_square", name: "Demand Gen 1200×1200", channel: "Google DemandGen", campaign: "bsu", width: 1200, height: 1200, ratio: "1:1", type: ["hardsell"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Graficky kompletné." },
  { id: "bsu_demandgen_portrait", name: "Demand Gen 960×1200", channel: "Google DemandGen", campaign: "bsu", width: 960, height: 1200, ratio: "4:5", type: ["hardsell"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Graficky kompletné." },
  { id: "bsu_meta_pplad", name: "Meta page post link ad 1:1", channel: "Meta", campaign: "bsu", width: 1200, height: 1200, ratio: "1:1", type: ["hardsell","remarketing"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Single image, s headlineom a logom." },
  { id: "bsu_joj_branding", name: "JOJ branding 2000×1400", channel: "JOJ", campaign: "bsu", role: "branding_full", width: 2000, height: 1400, ratio: "10:7", type: ["awareness"], count: 1, safeZones: { centerWidth: 1000, topOffset: 200 }, notes: "Biela plocha v strede, 200px od vrchu." },
  { id: "bsu_int_joj_mobile", name: "JOJ interscroller 300×600", channel: "JOJ", campaign: "bsu", role: "interscroller", width: 300, height: 600, ratio: "1:2", type: ["awareness"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Iba mobile v tomto TP. Adform template." },
  { id: "bsu_pravda_branding_leader", name: "pravda branding 1200×200", channel: "pravda", campaign: "bsu", width: 1200, height: 200, ratio: "6:1", type: ["awareness"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Top." },
  { id: "bsu_pravda_branding_side", name: "pravda branding 200×700", channel: "pravda", campaign: "bsu", role: "branding_side", width: 200, height: 700, ratio: "2:7", type: ["awareness"], count: 2, safeZones: { safeInner: { width: 120, height: 600 } }, notes: "2× boky." },
  { id: "bsu_int_pravda", name: "pravda interscroller 300×600", channel: "pravda", campaign: "bsu", role: "interscroller", width: 300, height: 600, ratio: "1:2", type: ["awareness"], count: 1, safeZones: { sides: 50 }, notes: "Ochranná zóna 50px z bokov." },
  { id: "bsu_ringier_leaderboard", name: "Ringier leaderboard 1200×400", channel: "Ringier", campaign: "bsu", width: 1200, height: 400, ratio: "3:1", type: ["awareness"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "aktuality/sport/azet/diva. Max 150 kB." },
  { id: "bsu_ringier_interscroller", name: "Ringier interscroller 720×1280", channel: "Ringier", campaign: "bsu", role: "interscroller", width: 720, height: 1280, ratio: "9:16", type: ["awareness"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Max 250 kB." },
  { id: "bsu_hnonline_megasticker", name: "hnonline mobile mega sticker 300×250", channel: "hnonline", campaign: "bsu", width: 300, height: 250, ratio: "6:5", type: ["awareness"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Max 100 kB jpg." },
  { id: "bsu_azet_dm", name: "Azet DM 640×500", channel: "E-mail", campaign: "bsu", role: "email", width: 640, height: 500, ratio: "~4:3", type: ["awareness"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Predmet 80 zn., odosielateľ 25 zn. HTML bez externého CSS." },
  { id: "bsu_engerio_native", name: "Engerio native 4:3", channel: "Native", campaign: "bsu", role: "native", width: 1200, height: 900, ratio: "4:3", type: ["awareness","hardsell"], count: 1, noLogo: true, safeZones: { top: 0, bottom: 0 }, notes: "Bez loga, bez textu, centrovaný. Viac variant pre A/B." },

  // ═══════════════════════════════════════════════════════════════
  //  TIGER — Aura 2026 (tiger-aura-2026), CZ + SK
  //  Zdroj: TP Tiger kampaň Aura media.pptx. Varianty Tigris/Gula = KV.
  //  Kampaň nemá awareness/hardsell delenie → typy zahŕňajú oba.
  // ═══════════════════════════════════════════════════════════════
  { id: "tig_rtb_480x480", name: "RTB 480×480", channel: "RTB", campaign: "tiger", width: 480, height: 480, ratio: "1:1", type: ["awareness","hardsell"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Statické 100 kB / HTML5 150 kB." },
  { id: "tig_rtb_300x250", name: "RTB 300×250", channel: "RTB", campaign: "tiger", width: 300, height: 250, ratio: "6:5", type: ["awareness","hardsell"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Statické 100 kB." },
  { id: "tig_rtb_300x300", name: "RTB 300×300", channel: "RTB", campaign: "tiger", width: 300, height: 300, ratio: "1:1", type: ["awareness","hardsell"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Statické 100 kB." },
  { id: "tig_rtb_300x600", name: "RTB 300×600", channel: "RTB", campaign: "tiger", width: 300, height: 600, ratio: "1:2", type: ["awareness","hardsell"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Statické 100 kB." },
  { id: "tig_rtb_480x300", name: "RTB 480×300", channel: "RTB", campaign: "tiger", width: 480, height: 300, ratio: "8:5", type: ["awareness","hardsell"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Statické 100 kB." },
  { id: "tig_rtb_970x310", name: "RTB 970×310", channel: "RTB", campaign: "tiger", width: 970, height: 310, ratio: "97:31", type: ["awareness","hardsell"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Statické 100 kB." },
  { id: "tig_rtb_970x210", name: "RTB 970×210", channel: "RTB", campaign: "tiger", width: 970, height: 210, ratio: "~4.6:1", type: ["awareness","hardsell"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Statické 100 kB." },
  { id: "tig_rtb_720x1280", name: "RTB 720×1280", channel: "RTB", campaign: "tiger", width: 720, height: 1280, ratio: "9:16", type: ["awareness","hardsell"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "* doplnkový rozmer." },
  { id: "tig_rtb_500x200", name: "RTB 500×200", channel: "RTB", campaign: "tiger", width: 500, height: 200, ratio: "5:2", type: ["awareness","hardsell"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "* doplnkový rozmer." },
  { id: "tig_demandgen_square", name: "Demand Gen 1200×1200", channel: "Google DemandGen", campaign: "tiger", width: 1200, height: 1200, ratio: "1:1", type: ["awareness","hardsell"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Nadpis 40 zn. ×5, popis 90 zn. ×5." },
  { id: "tig_demandgen_landscape", name: "Demand Gen 1200×628", channel: "Google DemandGen", campaign: "tiger", width: 1200, height: 628, ratio: "1.91:1", type: ["awareness","hardsell"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "1,91:1, min. 600×314." },
  { id: "tig_demandgen_portrait", name: "Demand Gen 960×1200", channel: "Google DemandGen", campaign: "tiger", width: 960, height: 1200, ratio: "4:5", type: ["awareness","hardsell"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "4:5, min. 480×600." },
  { id: "tig_demandgen_logo", name: "Demand Gen logo 1200×1200", channel: "Google DemandGen", campaign: "tiger", role: "logo_only", width: 1200, height: 1200, ratio: "1:1", type: ["awareness","hardsell"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "Max 150 kB, min. 144×144." },
  { id: "tig_seznam_wallpaper", name: "Seznam wallpaper 480×300", channel: "Seznam", campaign: "tiger", width: 480, height: 300, ratio: "8:5", type: ["awareness","hardsell"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "250 kB. Tigris + Gula." },
  { id: "tig_novinky_square", name: "Novinky mobile premium square 480×480", channel: "Novinky", campaign: "tiger", width: 480, height: 480, ratio: "1:1", type: ["awareness","hardsell"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "250 kB. Tigris + Gula." },
  { id: "tig_games_branding", name: "Games branding 1920×1080", channel: "Games", campaign: "tiger", role: "branding_full", width: 1920, height: 1080, ratio: "16:9", type: ["awareness","hardsell"], count: 1, safeZones: { centerWidth: 1000, topOffset: 100 }, notes: "200 kB. Stred = plocha hry." },
  { id: "tig_yt_companion", name: "YouTube companion 300×60", channel: "YouTube", campaign: "tiger", width: 300, height: 60, ratio: "5:1", type: ["awareness","hardsell"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "150 kB. HDL 15 zn., CTA 10 zn." },
  { id: "tig_heyfomo_landscape", name: "Hey FOMO 16:9", channel: "Hey FOMO", campaign: "tiger", width: 1920, height: 1080, ratio: "16:9", type: ["awareness","hardsell"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "TP uvádza len pomer 16:9 — px odvodené." },
  { id: "tig_heyfomo_portrait", name: "Hey FOMO 9:16", channel: "Hey FOMO", campaign: "tiger", width: 1080, height: 1920, ratio: "9:16", type: ["awareness","hardsell"], count: 1, safeZones: { top: 0, bottom: 0 }, notes: "TP uvádza len pomer 9:16 — px odvodené." }
];

// Metadáta kampaní — tagging pre pomenovanie frameov + label do UI
const CAMPAIGNS = {
  kid:    { tagging: "kid-062026",      label: "TB KID 2026" },
  kkvisa: { tagging: "kk-visa-072026",  label: "KK Visa — kreditné karty" },
  hypo:   { tagging: "hypo-052025",     label: "Digitálna hypotéka" },
  bsu:    { tagging: "bsu-082025",      label: "BSU — Bezúčelový úver" },
  tiger:  { tagging: "tiger-aura-2026", label: "Tiger — Aura 2026" }
};

module.exports = FORMATS;
module.exports.campaigns = CAMPAIGNS;
