# Prompt pre Claude Code

> Skopíruj celý text nižšie (od čiary) a vlož ho do Claude Code
> spusteného v priečinku `~/Downloads/tb-kid-agent`.

---

Pracuješ na Figma plugine „TB — Generátor online formátov" v tomto repe.
Plugin z jedného key visualu generuje 138 online reklamných formátov pre
Tatra banku. Som grafička, nie vývojárka — potrebujem, aby výstup bol
vizuálne bezchybný a aby sedel s našimi predlohami.

## Tvoja úloha

Odstrániť všetky vizuálne chyby vo výstupe: **typografia, farby a ich
generovanie, gradienty, doplňovanie plochy, logo a AI disclosure** — tak,
aby sa plugin správal podľa PSD a Figma predlôh naprieč všetkými formátmi.

## Zdroje pravdy — v tomto poradí

1. **`~/Downloads/Adform_dievca.psd`** (1614×600, 4 artboardy, 66 vrstiev).
   Záväzný pre `adform_300x250`, `adform_300x600`, `adform_160x600`,
   `adform_970x250`. Súradnice v `ADFORM_PSD_RULES` v `plugin/code.js` sú
   z neho odčítané a **overené do 2 px — neposúvaj ich**.
   Zhrnutie: `docs/PSD_ADFORM_REFERENCE.md`.
2. **`docs/TP_MASTER_SAFE_REFERENCE.md`** — TP pravidlá pre master 4000×4000
   s chráneným jadrom 2000×2000 a pre rodiny square / portrait / wide.
3. **Surďov dotazník** — pravidlá pre typografiu, logo, crop, CTA, AI tag.
   Je v Claude projekte „Plugin" ako `claude/Surdo_odpovede_do_pluginu.md`
   a `claude/Plugin_podla_Surdu.md`. Ak k nim nemáš prístup, vypýtaj si ich
   odo mňa skôr, než začneš meniť pravidlá.

Keď sa zdroje rozchádzajú, platí PSD pred dotazníkom a dotazník pred tvojím
úsudkom. Ak nájdeš rozpor, **napíš mi ho — nerozhoduj ho sám.**

## Ako overuješ výsledok — POVINNÉ

V `~/harness` je headless render: mock Figma API v Chromiu, ktorý spustí
skutočný `plugin/code.js` a vyrenderuje všetkých 138 formátov do PNG.

```bash
cd ~/harness
node audit.js        # vyrenderuje každý formát 2x (s textom a bez)
python3 check.py     # prekryvy, pretečenia, kontrast, minimá
python3 vizual.py    # typografia, farby, rozloženie, zarovnanie
```

**Východiskový stav, ktorý nesmieš zhoršiť:**
`check.py` = 3 nálezy (logo pod 50 px na 320×50 a dvoch YouTube companion —
tam sa 50 px logo fyzicky nezmestí)
`vizual.py` = 13 nálezov (pozícia loga na mikroformátoch a e-maile, kde ju
určuje predloha kanála)

Po **každej** zmene spusti aj testy:

```bash
cd ~/Downloads/tb-kid-agent
for t in tests/*.test.js; do node "$t" || echo "SPADLO: $t"; done
```

Okrem toho sa vždy pozri na render vlastnými očami — `~/harness/out/*.png`.
Čísla z auditu nestačia; polovica dnešných chýb bola vidieť až na obrázku.

## Pravidlá práce — vznikli z konkrétnych zlyhaní, dodrž ich

1. **Nikdy needituj nahradzovaním rozsahu podľa indexov** (`s[start:end]`).
   Takto zmizla funkcia `logoLuminance` a plugin padal na
   `logoLuminance is not defined`. Používaj presné nahradenie reťazca
   a over, že zásah sedel.

2. **`tests/integrita.test.js` musí prejsť.** Chytá volanú-ale-nedefinovanú
   funkciu, syntax `<script>` blokov v `ui.html`, chýbajúce povinné funkcie
   a `figma.create*()` node, ktorý sa nikde nepripája — taký node Figma
   položí na aktuálnu **stránku** (takto vznikli osirené obdĺžniky na Page 1).

3. **Nenasadzuj nič, čo si neoveril na skutočnom výstupe.** Dve zmeny dnes
   fungovali v simulácii a zlyhali v ostrej Figme:
   - `scaleMode: "CROP"` + `imageTransform` → Figma tú maticu interpretuje
     inak, než dokumentuje, výsledkom bol nesprávny výrez
   - vzorkovanie farieb pozdĺž hrany KV cez `<canvas>` + `getImageData` →
     v ostrej Figme vracalo nuly, doplnená plocha vyšla **čierna**

   Overený základ: `createRectangle/Text/Frame`, `resize`, `x`, `y`,
   `fills` (SOLID, GRADIENT_LINEAR, IMAGE s FILL/FIT), `appendChild`,
   `insertChild`, `remove`, `textAutoResize`, `maxLines`.

4. **Rob malé kroky a commituj po každom.** Keď niečo pokazíš, chcem to vedieť
   vrátiť jedným `git revert`, nie hľadať v jednom veľkom commite.

5. Ak si niečím nie si istý, **spýtaj sa ma** namiesto experimentovania.
   Radšej otázka než ďalšie kolo opráv.

## Čo konkrétne prejsť

### Typografia
- Tatra banka Sans (Bold headline, Regular/Light podnadpis a CTA),
  fallback Inter, keď font nie je vo Figme.
- Minimum 12 px pre generované layouty. **Výnimka:** Adform PSD šablóny
  majú legal 7 px, badge 8 px, AI tag 9 px — sú to hodnoty z PSD a PSD má
  prednosť. Je to zapísané v komentári pri `ADFORM_PSD_RULES`. Nemeň to.
- Max riadkov: 300×250 → 2, 9:16 → 4.
- Dlhý headline sa zmenšuje, neskracuje. Používaj `addTemplateText()`
  (vie zmenšiť font), nie `addText()`.
- Hierarchia: podnadpis musí byť zreteľne menší než headline (~60 %).
- Skontroluj zarovnanie ľavého okraja headline / podnadpis / CTA / legal.

### Farby a ich generovanie
- **Farba textu podľa pozadia** (Surď, sekcia 2) — nie natvrdo biela.
  Rozhoduje to, čo je pod textom **naozaj**: keď je pod ním tmavý scrim →
  biela; keď sedí na plnej brand ploche → podľa jej jasu. Funkcia
  `textNaPodklade()` v `code.js`. Platí pre headline, podnadpis, legal
  aj AI tag.
- Brand modrá CTA `#0047F8`.
- Skontroluj, či niekde nevzniká vymyslená farba, ktorá nie je ani z KV,
  ani z brand palety.

### Gradienty a doplňovaná plocha
- `scrimAlphaFor()` — pozor na SMER. Text je biely, takže **svetlý KV
  potrebuje VIAC krytia**, nie menej. Raz to už bolo obrátene a headline
  vychádzal na 1,8 : 1.
- Scrim musí byť krycí už na hornej hrane headlinu, nie až pod ním.
- Keď je vizuál vložený cez contain a text sedí na plnej brand ploche,
  scrim sa **nekreslí** — inak zbytočne špiní čistú farbu.
- Doplnená plocha pri contain: teraz `brandColor(layout)` + krátky prechod
  pri hrane. TP hovorí *„continuing background graphics or a smooth
  transition to one colour"*; robíme druhú polovicu. V PSD to Surďo rieši
  vrstvou `Generative Fill`, čo plugin bez servera nevie.
  **Ak to chceš zlepšiť, over to najprv na jednom formáte v ostrej Figme.**

### Logo
- Pozícia vpravo dole (výnimky: logo-only formáty, publisher branding,
  mikroformáty a e-mail — tam ju určuje predloha kanála).
- Minimum 50 px na **menší** rozmer, nie na šírku (pri `scaleMode FIT`
  určuje veľkosť značky menší rozmer).
- Logo NEJDE na Google PMax a Google Responsive — systém ho dopĺňa.
- **Žiadna žiara ani plná podložka pod logom.** Radiálny gradient tam bol
  a vyzeral ako reflektor; dodávaný lockup má vlastný biely rám.
  Čitateľnosť sa rieši správnou VERZIOU loga (biela/tmavá podľa podkladu) —
  premenné `LOGO_LUMA` a `KV_LUMA_BOTTOM` v kóde už sú.
  Ak vieš, navrhni v UI dva sloty (biele + tmavé logo) a automatickú voľbu.

### AI disclosure
- Text „AI generované", pozícia **vľavo dole**.
- Krytie **80 %** — v PSD má vrstva `AI GENEROVANE` hodnotu 204/255.
- Farba podľa podkladu, rovnako ako ostatná typografia.
- Tmavá podložka len vtedy, keď je text biely; pri tmavom texte na svetlom
  podklade je zbytočná.
- Na `adform_970x250` je podľa PSD vľavo dole cez fotku, aj keď headline
  sedí v pravom paneli — to je správne, nezarovnávaj ho k headlinu.

## Čo nemeniť

- Súradnice v `ADFORM_PSD_RULES` — overené proti PSD do 2 px.
- Branding a interscroller formáty — podľa našej dokumentácie ešte nemajú
  Surďov dizajn, do dema nejdú.
- Video formáty sa negenerujú (Surď: „úplne vynechať").
- Blurred background sa nepoužíva nikdy (Surď).

## Ako mi to odovzdaj

1. Zhrnutie: čo si našiel, čo si opravil, čo si zámerne nechal a prečo.
2. Čísla z `check.py` a `vizual.py` pred a po.
3. Zoznam vecí, ktoré potrebujú rozhodnutie odo mňa alebo od Surďa.
4. Ak si niečo neoveril na živej Figme, **napíš to výslovne.**

Nezačínaj tým, že prepíšeš veľkú časť `code.js`. Najprv si spusti audit,
pozri render, a povedz mi, čo vidíš a čo navrhuješ.
