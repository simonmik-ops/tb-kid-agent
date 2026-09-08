# Zadanie: prejsť na Surďov kompozičný model (nie ladiť gradient)

Doterajšie opravy gradientov riešili nesprávny problém. Porovnanie s referenčnou
Figmou od Surďa ukazuje, že **máme obrátený model kompozície**. Kým to nezmeníme,
každé ladenie alfy bude len iná odtieň zle.

## Referencia

Figma: `https://www.figma.com/design/d51uxTh8YqPdHujzi1Plt6/Untitled?node-id=0-1`

Pozri si najmä:

- `0:40` — 1200×1200 (štvorec)
- `0:21` — 1200×628 (široký, eliptický prechod)
- `0:4` — 1080×1920 (na výšku)
- `0:152` / `0:171` — 300×600 a 970×250 (bannery)

Vytiahni si z nich cez Figma MCP skutočné fills a masky. **Nehádaj hodnoty** —
vypíš do odpovede, čo si našiel, predtým než začneš meniť kód.

## Ako to stavia Surdo

Poradie vrstiev v každom formáte:

```
VIZUAL-BACKGROUND     ← brandová plocha, cez celý frame
VIZUAL-KV             ← fotka: VŽDY ŠTVOREC, predimenzovaná, negatívny offset
VIZUAL-BACKGROUND     ← plný nepriehľadný pás (spodok alebo bok)
prechod / PRECHOD     ← rozplynutie KV do brandovej farby
LAYOUT-SQUARE|VYSKA|SIRKA  ← komponent s textom, CTA, logom, AI tagom
```

## Štyri rozdiely oproti nášmu kódu

### 1. Prechod je BRANDOVÁ FARBA, nie čierna

Surďov `prechod` obsahuje inštanciu `VIZUAL-BACKGROUND` — tú istú koralovú, ktorá
je na pozadí. My kreslíme `Bottom readability gradient` s `{r:0, g:0, b:0}` a
alfou. Čierna cez koralovú = bahnistá hnedá, čo je presne to, čo vidno na výstupe.

**Zmeň:** spodný scrim aj wide panel majú dobiehať na `brandColor(layout)` pri
plnom krytí, nie na čiernu. Farba sa nemení po ceste — mení sa len alfa.

### 2. Fotka sa ROZPLÝVA, nie je prekrytá

Surdo maskuje samotný KV — alfa fotky klesá na 0. My kladieme obdĺžnik NAD
neporušenú fotku. Rozdiel: pri maskovaní nemôže vzniknúť šev, pri prekrývaní
sa každá nespojitosť gradientu prejaví ako pás.

**Zmeň:** aplikuj prechod ako masku (alebo `FRAME` s `fills` gradientom a
`blendMode`/mask) na vrstvu KV, nie ako samostatný obdĺžnik nad ňou.

### 3. Prechod je dlhý a konštantný

Namerané v referencii:

| formát | výška prechodu | podiel |
|---|---|---|
| 1200×1200 | 496 px | 41 % výšky |
| 1200×1628 | 496 px | 30 % |
| 1080×1920 | 496 px | 26 % |
| 900×1600 | 515 px | 32 % |
| 1200×628 (bok) | 136 px | 11 % šírky |
| 970×250 (bok) | 55 px | 6 % šírky |

Teda: **~500 px na zvislých prechodoch bez ohľadu na formát**, a výrazne kratší
pás na vodorovných. Náš `rampEnd` klesá až na 6 % výšky scrimu.

**Zmeň:** zvislý prechod počítaj ako podiel výšky s dolnou hranicou okolo 25 %,
nie z `scrimHeadroom`.

### 4. Na širokých formátoch je prechod ELIPTICKÝ, nie lineárny

`PRECHOD` frame obsahuje `O maska` → `boolean-operation Subtract` dvoch elíps
(`Ellipse 1` mínus `Ellipse 2`), plus úzky rovný `prechod` pás na šve. Výsledok
je organický oblúk okolo subjektu — vidno na `0:21`, kde sa fotka vpravo
rozplýva zaobleným okrajom okolo znaku „€", nie zvislou hranou.

**Zmeň:** vo wide vetve nahraď `Wide content panel` (lineárny gradient zľava
doprava) radiálnym/eliptickým prechodom. `GRADIENT_RADIAL` s posunutým stredom
je dostatočná aproximácia — netreba boolean operácie.

## Ďalšie chyby vo výstupe

Z výstupu (Figma `jpAb03NqZJ6xYHKRAIcd0p`, stránka „Z tabuľky"):

- **`Clean image landscape` a `Google RSA story` majú biele pásy** (letterbox).
  Surďov KV je vždy predimenzovaný štvorec s negatívnym offsetom (1107×1107
  v 1200×628; 1628×1628 v 1200×1200) — orezáva sa, nikdy sa nevkladá do bielej.
  Over, prečo `contain` vetva vôbec padne na bielu namiesto `brandColor`.
- **`Meta image 9:16` má headline tmavomodrý na koralovej** namiesto bieleho,
  a fotka končí ostrým švom v ~40 % výšky. Text musí byť biely na brandovej ploche.
- **`Full creative landscape`** má KV ako úzky pásik v strede a plnú farbu po
  oboch stranách. Surdo nikdy nedáva výplň na obe strany — subjekt je pri jednej
  hrane a rozplýva sa smerom k textu.

## Dôsledok pre P0-16 (dôležité)

Surdo nerieši kontrast stmavovaním fotky. Text u neho **nikdy neleží na fotke** —
leží na nepriehľadnej brandovej ploche. Kontrast je tým zaručený farbou pozadia,
nie meraním jasu KV.

To znamená, že `ensureReadableSurface` má naďalej zmysel (brandová farba musí byť
voči bielej ≥ 4,5 : 1), ale `scrimAlphaFor` odvodené z jasu fotky stráca opodstatnenie
v momente, keď je plocha pod textom plne krycia. Nemaž to — ale over, či po zmene
ešte niečo rieši, a napíš mi záver.

## Postup

Toto je väčšia zmena než predošlé. Rob ju **po krokoch a nekomituj naraz**:

1. Najprv len bod 1 (farba prechodu na brandovú namiesto čiernej) — vygeneruj
   a pošli screenshot. Toto samo o sebe odstráni bahnistú hnedú.
2. Potom bod 3 (dĺžka prechodu).
3. Potom bod 2 (maskovanie namiesto prekrývania).
4. Nakoniec bod 4 (eliptický prechod na širokých).

Po každom kroku screenshot 1200×1200, 1200×628 a 1080×1920 a porovnanie
s referenčným nodom. Nepokračuj na ďalší krok, kým predošlý nesedí.

## Čo sa nesmie pokaziť

- Všetky 4 sady v `tests/` musia prechádzať po každom kroku.
- P0-8: plocha pod textom plne krycia v mieste, kde text začína.
- Doplnená plocha ostáva jedna farba z `brandColor(layout)`.
