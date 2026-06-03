// server.js
require("dotenv").config();
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const { processAllFormats } = require("./agent");

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(express.json());

// CORS — plugin beží na figma.com doméne, potrebuje prístup k serveru
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// Hlavný endpoint — Claude analýza a plánovanie layoutov
app.post("/analyze", upload.single("visual"), async (req, res) => {
  try {
    const { headline, adType } = req.body;
    const file = req.file;

    if (!file) return res.status(400).json({ error: "Chýba vizuál" });

    const imageData = fs.readFileSync(file.path);
    const base64 = imageData.toString("base64");
    const mediaType = file.mimetype;

    console.log(`Analyzujem: "${headline}" | Typ: ${adType}`);

    const formatResults = await processAllFormats(base64, mediaType, headline, adType);

    fs.unlinkSync(file.path);

    console.log(`Hotovo — ${formatResults.length} formátov naplánovaných`);

    // Vráť dáta plugin-u — ten vytvorí frames priamo vo Figme
    res.json({
      headline,
      adType,
      formats: formatResults.map(({ format, layout }) => ({ format, layout }))
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`TB KID Agent beží na porte ${PORT}`));
