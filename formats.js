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
  }
];

module.exports = FORMATS;
