# Zadanie pre Claude Code — opravy generátora (5. 8. 2026)

Východisko: revízia z 5. 8. 2026. Merané na vetve `master @ 0c2a0ec` + necommitnutých
zmenách v `plugin/code.js`, na Figma stránke „Z tabuľky" (22 frameov, tagging `investovanie`)
a proti `Adform_dievca.psd`.

Rob to v poradí nižšie. **P0-9 sprav hneď po P0-2** — týka sa toho, ktoré prvky sa vôbec majú kresliť. Každý bod má súbor, riadok, aktuálny stav a kritérium hotového.
Po každom bode P0 spusť `node tests/universal-templates.test.js` a `node tests/campaign-rules.test.js`.

---

## P0-1 · Commitnúť opravu vAlign

`plugin/code.js:1050–1057` — už je opravené v pracovnom strome, ale necommitnuté.
`git add plugin/code.js && git commit`.

Kritérium: `git status` čistý, `textAutoResize = "NONE"` sa nastaví PRED `resize()` vo vetve `vAlign === "CENTER"`.

---

## P0-2 · Šablóna vyhráva nad master_safe

`plugin/code.js:336–338`. Teraz:

```js
const layoutType = hasLocalAdformTemplate
  ? (useMasterSafe ? "master_safe" : "adform_psd")
  : (useMasterSafe && masterEligible ? "master_safe" : backendLayoutType);
```

`useMasterSafe` je defaultne `true` (`plugin/ui.html:139`), takže `adform_psd` sa nikdy nespustí.
Súradnice v `ADFORM_PSD_RULES` (`plugin/code.js:943–989`) sú overené proti PSD — všetkých 28 boxov
sedí na pixel. Sú to mŕtve dáta.

Zmeň na:

```js
const layoutType = hasLocalAdformTemplate
  ? "adform_psd"
  : (useMasterSafe && masterEligible ? "master_safe" : backendLayoutType);
```

A v `plugin/ui.html:139` prepíš label checkboxu `masterSafeMode` na
„Použiť univerzálny layout aj tam, kde existuje šablóna" a zmeň default na **unchecked**.

Kritérium: `adform_300x250`, `adform_300x600`, `adform_160x600`, `adform_970x250`
vygenerujú framy s prelepkou, legal textom, sloganom a bankovým lockupom na PSD pozíciách.

---

## P0-3 · contentBox do layout engine

`buildMasterSafeLayout` (`plugin/code.js:1203`) nikdy nečíta `format.safeZones`.
`addSafeZones` (`1855`) ich len nakreslí ako vodiace obdĺžniky.

Urob:

1. Nová funkcia `resolveContentBox(format)` → `{x, y, w, h}`:
   - `safeZones.top/bottom/sides` → odsadenie od hrán
   - `safeZones.safeInner: {width, height}` → vycentrovaný obdĺžnik tejto veľkosti
   - `safeZones.left/right` → odsadenie zľava/sprava
   - `safeZones.centerWidth + topOffset` → **toto je DEAD zóna, nie safe.**
     Content box = najväčší voľný obdĺžnik mimo nej. Prakticky ľavý pás
     `[0, 0, (W-centerWidth)/2, H]` alebo pravý; vyber širší.
   - nič z toho → celý frame
2. `buildMasterSafeLayout` prijme `contentBox` ako parameter a všetky
   `pad`, `cursorY`, `textX`, `textW`, pozíciu loga aj AI tagu počíta od neho, nie od `[0,0,W,H]`.
   Obrázok (`addMasterCoreImage`) ostáva na celom frame — obmedzuje sa iba obsah.
3. To isté pre `buildAdformPsdLayout` netreba — má vlastné súradnice.

Kritérium (namerané, musí platiť po pregenerovaní):

| Formát | Podmienka |
|---|---|
| `markiza_branding_leader` 1000×200 | žiadny textový/logo prvok mimo x 140–860 |
| `joj_branding` 2000×1400 | žiadny prvok neprotína obdĺžnik x 500–1500, y 200–1400 |
| `zenske_interscroller` 750×1624 | všetko v x 50–700, y 321–1303 |
| `topky_branding` 450×800 | všetko v x 145–305, y 100–700 |
| `zenske_branding_side` 160×600 | všetko v x 20–140 |

---

## P0-4 · Micro layout pre h ≤ 120

`plugin/code.js:644–646` posiela všetko s `height <= 120` do `logo_only`,
takže `728×90` a `320×50` (reálne Vinted deliverables) sú tmavomodrá plocha s logom.

Nový `buildMicroLayout(frame, format, layout, headline, figmaImage, figmaLogo)`:
- KV na celý frame, `addFocalImageFrame` s `desired = {x: 0.5, y: 0.35}`
- ľavý scrim (lineárny horizontálny, 0 → 0,75 krytia) na 55 % šírky
- logo vľavo, výška `min(H - 2*pad, 0.6*H)`, minimálne 50 px šírky
- headline vpravo od loga, jeden riadok, `textAlignVertical = "CENTER"`
- bez CTA, bez subheadlinu, bez prelepky

`logo_only` nechaj len keď `format.id` obsahuje `google_logo` alebo `format.rules?.logoOnly`.

Kritérium: `728×90` aj `320×50` majú KV, logo aj headline; `google_logo_square` ostáva logo-only.

---

## P0-5 · AI disclosure čitateľná

`addAiNote` (`plugin/code.js:167`) a `buildAdformPsdLayout` (`1498`).

- `t.opacity` z `0.55` na `0.85`
- `aiNoteFontSize` (`160`): dolná hranica z 11 na **12**
- pridaj tmavú podložku: rect za textom, `rgba(0,0,0,0.45)`, radius 3, padding 4 px —
  alebo `effects: [{type:"DROP_SHADOW", color:{r:0,g:0,b:0,a:0.6}, offset:{x:0,y:1}, radius:3}]`
- ikonu `✧ ` pridaj aj do `addAiNote`, nielen do `adform_psd` vetvy
- do kolíznej kontroly (`plugin/code.js:205`) pridaj `"Legal text"`

**Veľkosť tagu sa neškáluje.** `aiNoteFontSize` (`code.js:160`) je
`clamp(min(W,H) * 0.024, 11, 18)`. Zámer je 2,4 % z kratšej strany, ale horný clamp 18 px
ho na veľkých formátoch zruší:

| Formát | 2,4 % z kratšej strany | Čo sa vykreslí | Podiel na frame |
|---|---|---|---|
| 300×250 | 6 px → clamp 11 | 11 px | 4,4 % |
| 1200×628 | 15 px | 15 px | 2,4 % |
| 1200×1200 | 29 px | **18 px** | 1,5 % |
| 2000×1400 | 34 px | **18 px** | 1,3 % |

Na `1200×1200` a `2000×1400` je tag opticky polovičný oproti tomu, čo je na malých bannerch.
Zvýš horný clamp na `min(0.024 * minSide, 0.6 * TB.legal(W,H) + 14)` alebo jednoducho na 32 px —
dolnú hranicu nechaj 12 px.

**Tag je na frame osamotený.** Vo Figme je pod CTA prázdny tmavý pás a v ňom samotný tag.
V PSD je `✧ AI generované` v jednom rytme s legal riadkom („Marketingové oznámenie…").
Kresli ich ako jeden blok — legal nad tagom, rovnaká ľavá os, medzera `0,5 × výška tagu` —
a ukotvi ho na spodok obsahového boxu, nie na spodok frameu. Súvisí to s P0-7:
ten prázdny pás je príliš vysoký a príliš tmavý scrim.

Kritérium: kontrast textu voči podkladu ≥ 4,5 : 1 na svetlom aj tmavom KV.
Namerané teraz: 2,90 : 1 naprieč všetkými formátmi.

---

## P0-6 · Rezerva na logo z výšky textu, nie z výšky boxu

`plugin/code.js:1301–1304` (`widthFor`) a `1246–1248` (`wideWidth`).

Rezerva sa zapne, keď `y + h > logoTop`, kde `h` je výška **boxu**. Na `750×1624` je
subheadline box 146 px vysoký, ale text má 40 px — box do rezervy zasiahne, text nie.
Výsledok: headline box 628 px a subheadline box 380 px, oba centrované → stredy sa líšia o 124 px.

Oprav tak, že text vysadíš na plnú šírku, odmeriaš jeho skutočnú výšku
(`node.height` po `addTemplateText`) a rezervu aplikuješ až potom — ak reálne koliduje.

Kritérium: na `750×1624`, `1080×1920`, `900×1600` a `1200×1200` majú headline aj subheadline
zhodný stred (rozdiel < 2 px).

---

## P0-7 · Krytie scrimu podľa jasu KV

`plugin/code.js:1329–1350`. Posledná zastávka je `rgba(0,0,0,0.90)` natvrdo.
Na svetlom koralovom KV to spodnú tretinu prepáli do hneda, kým wide vetva
(bočný gradient panelu) ostane svetlá — sada nevyzerá ako jedna rodina.

- Spočítaj priemernú luminanciu dolných 40 % KV. Vo Figma plugine sa pixely priamo čítať nedajú —
  pošli hodnotu z UI (`ui.html` už obrázok načítava; sprav `<canvas>` a `getImageData`),
  alebo ju vypočítaj v `agent.js` a pošli v `layout.kv_luma_bottom`.
- `scrimAlpha = clamp(0.35 + (1 - luma) * 0.55, 0.35, 0.90)` — svetlý KV 35–45 %, tmavý 70–90 %.
- Ten istý výpočet použi aj na krytie „Wide content panel" gradientu, nech sa vetvy stretnú.

Kritérium: `1200×628` a `1200×1200` z rovnakého KV majú porovnateľnú tonalitu.

---

## P0-8 · Text vo wide vetve až tam, kde je panel krycí

`plugin/code.js:1216–1238`. Panel začína na `0,45·W`, plne krycí je od `0,75·W`,
ale `textX = round(W * 0.54)`. Na `1200×628` je headline box 648–1152 a panel
nepriehľadný až od 900 → **252 z 504 px headline boxu leží nad fotkou**.

Buď `textX = round(W * 0.75)`, alebo skráť gradient tak, aby bol plný už od `0,54·W`
(`stop = min(0.98, (textX - panelX) / (W - panelX))`). Druhá možnosť je lepšia — text ostane
na tej istej pozícii a panel len rýchlejšie dobehne.

Kritérium: ľavá hrana headline boxu leží v plne krycej časti panelu na všetkých wide formátoch
(`1000×200`, `1200×200`, `1240×200`, `1275×250`, `1200×300`, `1200×628`, `375×250`).

---

## P0-9 · Pravidlá per formát: kde headline / subheadline / CTA NEMAJÚ byť

**Toto dnes nefunguje pre žiadnu kampaň okrem `kkvisa`.**

Stav v kóde:

- `layout.show_headline` / `show_subheadline` / `show_cta` / `show_logo` sa nastavujú
  **iba** v `plugin/code.js:321–325`, a to z `localKkVisaRule` (`code.js:73`), ktorá hneď
  na prvom riadku vráti `null`, ak `format.campaign !== "kkvisa"`.
  Pre `investovanie`, `kid`, `hyp`, `bsu` aj `tiger` teda nevráti nič.
- `resolveLayoutLocal` (Excel cesta, `code.js:636`) nastaví len
  `show_headline: true, show_logo: true`. `show_subheadline` ani `show_cta` nikdy.
- Všetky kontroly v `buildMasterSafeLayout` sú tvaru `layout.show_X !== false`,
  takže pri `undefined` sa prvok **vždy vykreslí**.
- `hasRoomForSubhead` (`code.js:665`) existuje, ale volá sa iba na riadku 1573
  v `buildFullBleedLayout` — v produkčnej vetve `master_safe` je to mŕtvy kód.
  Jediná poistka v `master_safe` je `format.height >= 260` (iba wide vetva, `code.js:1252`);
  štvorec a portrét nemajú žiadnu.

Dôsledok vo Figme: `1200×628`, `1200×1200`, `1080×1080`, `900×1600`, `960×1200`, `1200×300`
a `375×250` dostali headline + subheadline + CTA + logo. Podľa TP:

| Formát / kanál | Čo tam patrí | Čo tam je |
|---|---|---|
| Google RSA `1200×628`, `1200×1200` | obrázok **bez textu** | headline + sub + CTA + logo |
| Google PMax `1200×628`, `1200×1200`, `960×1200` | **iba headline**, CTA a logo dopĺňa systém | headline + sub + CTA + logo |
| Meta image `1200×1200`, `1200×1628` | headline + logo, **CTA dopĺňa systém** | + CTA |
| Google logo `1200×300`, `1200×1200` | **transparentné logo**, nič iné | plný banner |
| Engerio `375×250` (deliverable je 1200×900) | **bez loga, bez textu** | headline + CTA + logo |
| Demand Gen `1200×628`, `1200×1200` | graficky kompletné — headline + CTA + logo | OK |

**Čo urob:**

1. Zovšeobecni `localKkVisaRule` na `resolveCreativeRule(format)` — nech nefiltruje podľa
   `campaign`, ale podľa **role formátu**. Rolu odvoď z `format.id` a `format.channel`:
   `google_rsa*` → `clean_image`, `google_logo*` → `logo_only`, `pmax*` → `headline_only`,
   `meta_*` → `meta_full` (bez CTA), `demandgen*` → `full_creative`,
   `*engerio*` → `native_clean`, inak `publisher_branding`.
   Profily už v tej funkcii sú (`code.js:84–92`) — stačí ich prestať viazať na `kkvisa`.
2. Rolu ulož do `format.rules` pri normalizácii katalógu (P1-9). `resolveCreativeRule`
   nech potom číta `format.rules` a odvodzovanie z `id` nechaj len ako fallback.
3. Do `buildMasterSafeLayout` pridaj poistku na veľkosť: subheadline sa nekreslí,
   ak `min(W, H) < 400` alebo ak by mu po odpočítaní CTA, loga a AI tagu ostalo menej
   ako `1,6 × subheadlineSize` výšky. Dnes sa vykreslí aj na `200×700`, kde má 15 px
   a je nečitateľný.
4. `hasRoomForSubhead` buď zapoj do `master_safe`, alebo zmaž — nech nie je mŕtvy kód,
   ktorý budí dojem, že to je ošetrené.

**Kritérium:**

- `google_rsa_landscape` a `google_rsa_square` → frame obsahuje **len** obrázok, žiadna textová vrstva
- `pmax_landscape`, `pmax_square`, `pmax` 960×1200 → **len** headline, žiadne CTA ani logo
- `meta_img_1x1`, `meta_img_4x5` → headline + logo, **žiadne CTA button**
- `google_logo_square`, `1200×300` → len logo na transparentnom pozadí
- `engerio` → čistý obrázok
- žiadny formát s `min(W, H) < 400` nemá subheadline

Toto sprav **pred** P0-3, inak budeš riešiť safe zóny pre prvky, ktoré tam vôbec nemajú byť.

---

## P1-9 · Normalizovať formats.js

143 formátov. Dnes: `noLogo` má 4, `noText` / `headlineOnly` / `logoOnly` / `logoTop` /
`ctaBySystem` / `limit` / `deadZones` má **0**. `safeZones` majú päť nezlučiteľných tvarov
(`{top,bottom}` 123×, z toho 119× `{top:0,bottom:0}` = žiadna informácia).

`frame.setPluginData("tbLimit", …)` (`plugin/code.js:~370`) preto zapisuje vždy prázdny reťazec.

Cieľový tvar:

```js
{
  id, name, channel, width, height,
  limit: 60,                                 // kB z TP
  safeBox:   { top, right, bottom, left },   // px, jeden tvar pre všetko
  deadZones: [{ x, y, w, h }],
  rules: { headlineOnly, noText, noLogo, logoOnly, logoTop, ctaBySystem },
  template: "adform_300x250" | null
}
```

Napíš migračný skript, ktorý `safeInner` aj `centerWidth/topOffset` prepočíta — nie ručne.
`resolveContentBox` z P0-3 potom číta `safeBox` a `deadZones`.

Chyby v dátach, ktoré treba opraviť pri tom:
- `meta_img_4x5` = 1200×1628, ale `kkv_meta_img_4x5` aj `hyp_meta_img_4x5` = 1200×1500.
  TP uvádza 1200×1628. **Rozhodnutie čaká na Simonu.**
- `topky_branding` sa volá „Topky branding 120×600", ale má `width: 450, height: 800`.
  Framy sa pomenúvajú z `format.name` → vo Figme vzniká nesprávny rozmer v názve.

---

## P1-10 · Excel cesta

`plugin/ui.html:246–270`.

- `DIM_BLOCK` má `"480x600"` dvakrát a blokuje `1920x1080` aj `300x60` — oboje sú reálne
  deliverables Tiger kampane. Zmaž ich z blacklistu.
- Regex berie každé „číslo × číslo" z každej bunky. Pridaj kontextový filter: ignoruj rozmer,
  ak je v tej istej bunke `min`, `max`, `safe`, `video`, `rozlíšenie`, `density`.
- Whitelist proti `formats.js`: rozmer, ktorý v katalógu nie je, sa nevygeneruje —
  len sa ponúkne na potvrdenie.
- **12 rozmerov v katalógu má viac ako jeden kanál** (`300×600` šesť, `160×600` päť,
  `2000×1400` dva s rôznymi pravidlami). Keď rozmer koliduje, UI musí pýtať kanál.
  Bez toho sa pravidlá nedajú priradiť.

---

## P1-11 · Kanál a rola do názvu framu

`plugin/code.js:~365`. Teraz: `2000×1400 — PRODUCTION [investovanie]`.
Chcem: `2000×1400 · JOJ branding — PRODUCTION [investovanie]`.

---

## P2 · Vizuálna vernosť voči PSD

Farby odčítané z `Adform_dievca.psd`:

| Prvok | PSD | Kód teraz | Kde |
|---|---|---|---|
| CTA modrá | `#0047F8` | `#0047F8` | `code.js:1196`, `1488` — sedí |
| Prelepka | `#DB7B67` | `#DC5C4A` | `code.js:1441` — opraviť |
| Panel 970×250 | `#30435C` | `#30455E` | `code.js:1083` |
| Spodný panel 160×600 | `#2E2828` | `#1F1A1A` @ 94 % | `code.js:1090` |
| Pozadie logo-only | nie je v PSD | `#002E8C` | `code.js:65` — **overiť, či je vôbec brandová** |

12. Zaveď farebné tokeny do objektu `TB` (`code.js:7`): `ctaFill`, `brandFill`, `badgeFill`,
    `panelFill`, `scrimBase`. Zruš hardcode na šiestich miestach.
13. Headline zmiešaným rezom — v PSD je „Investičné" Bold + „stratégie" Light, plus horný index „TB".
    Vo Figme cez `setRangeFontName` a `setRangeFontSize` + `setRangeTextCase`.
14. Prelepka natočená o −8° (`rotation`) a s mäkkým tieňom.
15. Slogan dvojriadkovo. `addSloganLogo` (`code.js:1065`) posiela „Myslite na seba" ako jeden
    reťazec do boxu 73 px pri 9 px písme → na 970×250 vznikne jeden nečitateľný riadok.
    Má to byť „Myslite\nna seba" vedľa lomky.
16. Mäkký prechod panelu na 970×250 namiesto hrany na `x = 425` (`code.js:1083`).
    V PSD je to gradient s krytím 0,8 začínajúci okolo `x = 371`.

---

## Čo NEROBIŤ

- Neopravuj terajšie framy vo Figme ručne. Po P0-2 až P0-8 sa pregenerujú správne.
- Nepridávaj nové formáty do `formats.js`, kým nie je hotové P1-9 — pribudli by v starom tvare.
