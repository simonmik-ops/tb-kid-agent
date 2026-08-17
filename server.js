// server.js
require("dotenv").config();
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const { processAllFormats } = require("./agent");
const FORMATS = require("./formats");
const CAMPAIGNS = FORMATS.campaigns || {};
const { TEMPLATE_GROUPS } = require("./template-library");

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(express.json());

// CORS musí byť pred endpointmi; inak /formats a /health síce odpovedajú,
// ale Figma UI ich v prehliadačovom sandboxe nesmie prečítať.
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.get("/template-groups", (req, res) => {
  res.json({ groups: TEMPLATE_GROUPS.map(({ formats, ...group }) => ({
    ...group,
    formatCount: formats.length
  })) });
});

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "tb-kid-agent", version: require("./package.json").version });
});

app.get("/formats", (req, res) => {
  res.json({ formats: FORMATS });
});

// Hlavný endpoint — Claude analýza a plánovanie layoutov
app.post("/analyze", upload.single("visual"), async (req, res) => {
  try {
    const { headline, adType } = req.body;
    const projectName = (req.body.projectName || "Nová kampaň").trim();
    const campaign = req.body.campaign || "kid"; // spätná kompatibilita
    const templateGroupIds = parseJsonArray(req.body.templateGroupIds);
    const visualRecipe = parseVisualRecipe(req.body.visualRecipe);
    const file = req.file;

    if (!file) return res.status(400).json({ error: "Chýba vizuál" });

    const imageData = fs.readFileSync(file.path);
    const base64 = imageData.toString("base64");
    const mediaType = file.mimetype;

    console.log(`Analyzujem: "${headline}" | Kampaň: ${campaign} | Typ: ${adType} | Recipe: ${visualRecipe.visualType}`);

    const formatResults = await processAllFormats(
      base64, mediaType, headline, adType, visualRecipe, campaign, templateGroupIds
    );

    fs.unlinkSync(file.path);

    const tagging = (CAMPAIGNS[campaign] && CAMPAIGNS[campaign].tagging) || "kid-062026";
    console.log(`Hotovo — ${formatResults.length} formátov naplánovaných (${tagging})`);

    // Vráť dáta plugin-u — ten vytvorí frames priamo vo Figme
    res.json({
      headline,
      projectName,
      adType,
      campaign,
      tagging: slugify(projectName) || tagging,
      visualRecipe,
      formats: formatResults.map(({ format, layout }) => ({ format, layout }))
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

function parseJsonArray(raw) {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.filter(item => typeof item === "string") : [];
  } catch (err) {
    return [];
  }
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    .slice(0, 48);
}

function parseVisualRecipe(raw) {
  const fallback = {
    visualType: "centered_subject",
    subjectPosition: "center",
    cropMode: "protect_subject",
    smallFormatMode: "brand_panel",
    textMode: "auto",
    logoMode: "auto"
  };

  if (!raw) return fallback;

  try {
    return { ...fallback, ...JSON.parse(raw) };
  } catch (err) {
    return fallback;
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`TB KID Agent beží na porte ${PORT}`));
