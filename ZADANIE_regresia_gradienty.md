# Zadanie: regresia po commite 47f4523 (gradienty)

Commit `47f4523` „Prechody a gradienty" zaviedol tri regresie. Sú overené na
skutočnom výstupe vo Figme (`node-id=642-807`, stránka „Z tabuľky") aj v
metadátach vrstiev — nie sú hypotetické.

Vizuálny dôkaz: na `2000×1400` beží **tvrdá vodorovná čiara cez celý frame**
vo výške ~45 %, čo je presne `scrimTop` (y = 629 z 1400). Pod ňou je plochá
hnedá doska namiesto plynulého stmavenia.

## Regresia 1 (hlavná): spodný scrim je plochá doska, nie gradient

`plugin/code.js`, `buildMasterSafeLayout`, spodný `Bottom readability gradient`.

**Pôvodné stopy** (pred 47f4523):

```
0.00                          → alfa 0
rampEnd * 0.5                 → 0.34 × scrimAlpha
rampEnd                       → 0.70 × scrimAlpha
rampEnd + (1-rampEnd) * 0.35  → 0.88 × scrimAlpha
1.00                          → 1.00 × scrimAlpha
```

Nábeh sa tiahol cez **celý** scrim a plné krytie dosiahol až v spodnom rohu.
Na `rampEnd` (horná hrana headlinu) bol zámerne len na 70 % — komentár nad
premennou to hovorí doslova: *„v ňom musí krytie vyrásť z 0 na ~70 %"*.

**Teraz** je tam `easedAlphaStops({r:0,g:0,b:0}, scrimAlpha, rampEnd)`, ktorá
dosiahne **100 % už na `rampEnd`** a zvyšok drží konštantu. Keďže
`rampEnd = clamp(scrimHeadroom / scrimH, 0.06, 0.45)`, pri malom headroome
scrim stmavne naplno v horných 6 % a spodných 94 % je plochá tmavá plocha.

Parameter `rampEndFrac` v `easedAlphaStops` znamená „kde sa dosiahne cieľová
alfa". Pri paneli je to správne (P0-8 chce plné krytie presne na `textX`).
Pri scrime `rampEnd` znamenal niečo iné — „kde má byť 70 %". Zdieľaná funkcia
tie dva významy zlúčila do jedného.

**Oprav:** rozlíš tie dva prípady. Buď pridaj `easedAlphaStops` ďalší parameter
(napr. `alphaAtRampEnd`, default 1.0) a scrim volaj s `0.70`, alebo daj scrimu
vlastný tvar. Podmienka je, aby na `rampEnd` bolo ~70 % a zvyšok pokračoval
plynulo na 100 % v spodnom rohu — teda **žiadny konštantný chvost**.

Zachovaj aj pôvodnú interpoláciu RGB scrimu (0.10 → 0.08 → 0.05 → 0.03 → 0.00),
nová verzia posiela jednu čiernu na všetky stopy.

## Regresia 2: edge-fade je na malých formátoch príliš dlhý

`plugin/code.js`, `addMasterCoreImage`:

```js
const pasH = Math.max(24, Math.min(Math.round(zone[3] * 0.10), Math.round(kratsiaStrana * 0.18)));
```

To `Math.max(24, …)` prebije proporcionálny výpočet. Na 320×100 vyjde
`min(10, 18) = 10`, ale `max(24, 10) = 24` — nábeh je 24 % výšky banneru.
Na 63×63 je to 38 %. Dolná hranica 24 px bola v zadaní zle zadaná — má platiť
len tam, kde 10 % vyjde smiešne málo na **veľkom** formáte, nie na malom.

**Oprav:** dolnú hranicu zastrop podielom formátu, napr.
`Math.min(24, Math.round(kratsiaStrana * 0.10))`, takže na malých formátoch
nikdy neprekročí 10 % kratšej strany. Na 2000×1400 sa nič nemení (200 px).

## Regresia 3: strop „18 % kratšej strany" skracuje prechod na úzkych formátoch

Namerané vo Figme (`642:807`), šírky vrstvy `Prechod pri hrane` pred a po:

| formát | pred 47f4523 | teraz | |
|---|---|---|---|
| 2000×1400 | 90 px | **200 px** | ✅ o toto nám išlo |
| 720×1280 | 90 px | **128 px** | ✅ |
| 1200×400 | 90 px | **72 px** | ❌ skrátilo sa |
| 1200×200 | 90 px | **36 px** | ❌ skrátilo sa |
| 200×700 (dole) | 70 px | **36 px** | ❌ skrátilo sa |

Na úzkych a nízkych formátoch je `kratsiaStrana * 0.18` prísnejšie než pôvodný
strop 90 px, takže prechod je teraz **kratší** než pred opravou — presne opak
zámeru. Pri vodorovnom prechode (hore/dole) má rozhodovať **výška**, pri
zvislom (vľavo/vpravo) **šírka** — nie kratšia strana v oboch prípadoch.

**Oprav:** `pasH` počítaj z `zone[3]`, `pasW` z `zone[2]`, a strop kratšej
strany buď zruš, alebo ho aplikuj len na tú os, ktorá je naprieč prechodom.
Cieľ: žiadny formát nesmie mať po oprave kratší prechod než pred `47f4523`.

## Skontroluj aj toto

`let panelX = imageW - wideShift; if (textX - panelX < minRampW) panelX = textX - minRampW;`
— pri malom `textX` môže `panelX` vyjsť záporné a `panel.resize(format.width - panelX, …)`
potom spraví panel širší než frame. Pridaj `panelX = Math.max(0, …)` alebo over,
že to nemôže nastať na žiadnom zo 151 formátov, a napíš mi ktoré si preveril.

## Overenie

1. Všetky 4 sady v `tests/` musia prejsť.
2. Do `tests/contrast.test.js` pridaj test, ktorý **chytí presne túto regresiu**:
   pri `rampEndFrac < 1` musí byť alfa na `rampEnd` výrazne nižšia než cieľová
   (nie rovná jej) a musí ďalej rásť až do pozície 1.0. Test, ktorý tam pribudol
   v `47f4523`, túto chybu nechytil — over prečo a doplň ho.
3. Vygeneruj sadu na 2000×1400, 1200×400, 720×1280 a 375×250 a **pošli mi
   screenshoty** — potrebujem vidieť, že spodok nie je plochá doska.
4. Nekomituj, kým to nepotvrdím vizuálne.

## Čo sa nesmie zmeniť

- Cieľová alfa (`scrimAlphaFor`, `ensureReadableSurface`) — P0-16 platí.
- P0-8: panel plne krycí presne na `textX`.
- Doplnená plocha ostáva jedna farba z `brandColor(layout)`.
