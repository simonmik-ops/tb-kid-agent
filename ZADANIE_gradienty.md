# Zadanie: prechody a gradienty podľa PSD a Figmy

## Cieľ

Výstup pluginu má mať **mäkké prechody** medzi fotkou KV a doplnenou plochou / panelom.
Teraz je medzi nimi na väčších formátoch viditeľná hrana a pás (banding).
Geometria aj layouty sú v poriadku — mení sa **iba tvar a dĺžka gradientov**.

## Zdroj pravdy

- Figma: `https://www.figma.com/design/jpAb03NqZJ6xYHKRAIcd0p/Untitled?node-id=642-2`
  (stránka „Z tabuľky", frames `… — PRODUCTION [investovanie]`)
- PSD referencia v repe (`uploads/`), tá istá, z ktorej vychádza `buildAdformPsdLayout`

**Najprv si cez Figma MCP vytiahni skutočné hodnoty** — `get_design_context` na
`642:3` (2000×1400), `642:76` (1200×400) a `642:128` (375×250). Zaujímajú ma presné
`gradientStops` (pozície + alfy) vrstiev `Prechod pri hrane — *`,
`Bottom readability gradient` a `Wide content panel`. Nehádaj ich — porovnaj
s tým, čo generuje kód, a rozdiel vypíš do odpovede predtým, než začneš meniť kód.

## Tri konkrétne chyby

### 1. Strop 90 px na šírke prechodu — `plugin/code.js:1762`

```js
const pasH = Math.round(Math.min(zone[3] * 0.10, 90));
const pasW = Math.round(Math.min(zone[2] * 0.10, 90));
```

Na 2000×1400 vyjde 10 % = 200 px, ale strop to zreže na 90 px → prechod je
4,5 % šírky a hrana je vidieť. Na malých formátoch je 10 % v poriadku.

**Uprav:** strop nahraď dolnou hranicou, nie hornou — prechod nesmie byť kratší
ako ~24 px, hore ho nechaj rásť s formátom (10 % rozmeru). Ak sa ukáže, že
10 % je pri extrémnych pomeroch (320×100, 970×250) veľa, obmedz to podielom
kratšej strany, nie konštantou v px.

### 2. Prechod má len 2 stopy s lineárnou alfou — `plugin/code.js:1749–1756`

```js
gradientStops: [
  { position: 0.00, color: { …, a: 0.00 } },
  { position: 1.00, color: { …, a: 1.00 } }
]
```

Lineárny nábeh alfy sa vizuálne javí ako pás. `Bottom readability gradient`
(`code.js:2075–2082`) má na to isté **5 stopov s krivkou** — a vyzerá dobre.

**Uprav:** daj `prechod()` rovnaký tvar krivky ako spodnému scrimu, teda
aspoň 4–5 stopov s easingom (pomalý štart, rýchly stred, doceluje na 1.0).
Použi ten istý pomocný tvar pre obe miesta, nech sa to nerozíde — ideálne
vytvor jednu funkciu (napr. `easedAlphaStops(color, alphaMax, stops)`)
a volaj ju z `prechod()` aj zo scrimu.

### 3. Panel nabieha príliš rýchlo — `plugin/code.js:1914–1923`

`Wide content panel` ide z α=0 na plné `panelAlpha` už na pozícii `textX`,
lebo P0-8 vynucuje, aby text nikdy neležal nad priesvitným panelom.
Na 375×250 to znamená nábeh za 35 px z 207 → prakticky hrana.

**Uprav:** neskracuj nábeh — **predĺž priestor**. Panel začni vľavo skôr
(posuň `panelX` doľava o dĺžku nábehu), aby medzi začiatkom panelu a `textX`
bolo aspoň 12 % šírky formátu na prechod. `textX` nechaj tam, kde je.

## Čo sa nesmie pokaziť

- **P0-8**: v mieste `textX` a ďalej musí byť panel plne krycí. Ramp sa
  predlžuje doľava, nie doprava.
- **P0-16 / kontrast**: `ensureReadableSurface` a `scrimAlphaFor` ostávajú.
  Cieľová alfa sa nemení, mení sa len cesta k nej.
- Doplnená plocha ostáva **jedna farba** z `brandColor(layout)`. Nevracaj sa
  k vzorkovaniu hrán KV ani k `CROP` transformácii — komentár na `code.js:1735`
  hovorí, prečo obe zlyhali.

## Overenie

1. `node tests/contrast.test.js` a zvyšné 3 sady v `tests/` musia prejsť.
2. Vygeneruj sadu na KV `~/Downloads/tb-vizualy 2/REM_ZENA.jpg` (svetlý pastel,
   najhorší prípad — biely text na ňom má bez scrimu 3,4 : 1) a na
   `VIZ03-VOLVO.png` (2,4 : 1).
3. Skontroluj na 2000×1400, 1200×400 a 375×250, že medzi fotkou a plochou
   nie je viditeľná hrana ani pás.
4. Porovnaj so screenshotom z Figmy — prechod má byť rovnako dlhý a rovnako
   mäkký ako v referencii.

Do odpovede napíš, čo si zmenil a aké hodnoty gradientov si našiel vo Figme
oproti tým, ktoré generoval kód.
