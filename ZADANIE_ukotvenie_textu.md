# Zadanie: ukotvenie textu a farba textu na brandovej ploche

**Referencia:** `d51uxTh8YqPdHujzi1Plt6` — `0:4` (1080×1920), `0:13` (1200×1628), `0:40` (1200×1200)
**Náš výstup:** `c74JV8O3qpXbFEBM7f2DPP` — `56:2`

> Zo Surďovej Figmy preberáme **iba vizuál a rozloženie**. Textácie sú u nás iné
> zámerne — neporovnávaj obsah, porovnávaj ukotvenie, mierku a farby.

---

## 0. Najprv over, čo z predošlého zadania naozaj prebehlo

Metadáta framov `Meta image 1:1` a `Meta image 4:5` sú **identické** s behom spred
`ZADANIE_dolad_kompoziciu.md`:

| | vtedy | teraz |
|---|---|---|
| 1:1 `Master visual` | 1200×1225 @ (0,0) | 1200×1225 @ (0,0) |
| 4:5 `Master visual` | 1594,73×1628 @ (−197,0) | 1594,73×1628 @ (−197,0) |
| 1:1 gradient | y = 740, h = 460 | y = 740, h = 460 |
| 4:5 gradient | y = 1051, h = 577 | y = 1051, h = 577 |
| `AI generované — podložka` | je | je |

Pribudla jediná vrstva: `Prechod pri hrane — dole` (192 px) na 9:16.

**Prejdi `ZADANIE_dolad_kompoziciu.md` znovu a napíš ku každému bodu, či je
spravený, prečo nie, alebo prečo si sa rozhodol inak.** Nepokračuj, kým to
nenapíšeš — ide o to, aby sa body nestrácali.

---

## 1. Text je ukotvený na spodnú hranu, má byť na prechod

Namerané na 1080×1920:

| | Surdo `0:4` | my `56:35` |
|---|---|---|
| fotka siaha po | 74 % výšky | 57 % |
| prechod | 41 % → 66 % | 57 % → 67 % |
| **textový blok** | **36 % → 64 %** | **71 % → 98 %** |
| AI tag | pod headlinom, ~64 % | 98 % (na spodnej hrane) |

Surdo umiestňuje `LAYOUT-VYSKA` (x=71, y=688, 938×539) doprostred — headline mu
leží **cez rozplývajúcu sa fotku**, cez hruď a telefón. Plocha pod textom je
vzduch. My text lepíme na spodnú hranu a medzi koncom fotky (57 %) a headlinom
(71 %) necháme prázdny pás — to je tá „diera na vypĺňanie".

**Uprav:** textový blok kotvi na **koniec prechodu**, nie na spodnú hranu frameu.
Blok (headline + subheadline + CTA + logo + AI tag) drž pohromade a umiestni ho
tak, aby jeho horná hrana padla do hornej tretiny prechodu. Pod blokom nech
ostane súvislá voľná plocha — to je zámer, nie chyba.

Dôsledok: AI tag prestane byť na spodnej hrane. To je správne — Surdo ho má
priamo pod headlinom, nie v rohu.

---

## 2. Farba textu na brandovej ploche musí byť biela, nie „najkontrastnejšia"

`plugin/code.js:2206`:

```js
FARBA_TEXTU = scrimTreba ? { r:1,g:1,b:1 } : textNaPodklade(brandColor(layout), 3.0);
```

Keď fotka končí nad textom, `scrimTreba` je `false` a farba sa vyberá
maximalizáciou kontrastu (`pickTextColor`, `code.js:303` — vracia bielu alebo
čiernu podľa toho, ktorá má vyšší pomer). Na koralovej má čierna ~6 : 1,
biela ~3,4 : 1, takže vyhrá tmavá → **tmavomodrý headline na 9:16**.

Surdo používa **bielu vždy**, aj keď má „len" 3,4 : 1.

**Uprav:** na brandovej ploche je biela **brandové pravidlo**, nie výsledok
optimalizácie. Text na `brandColor(layout)` je vždy biely. Ak biela na danej
brandovej farbe nedosiahne 3 : 1 pre veľký text, riešením je **stmaviť plochu**
(`ensureReadableSurface`, ktorý už existuje), nie preklopiť text na tmavý.

`pickTextColor` nechaj — ale používaj ho len tam, kde podklad NIE je brandová
farba (napr. text priamo na fotke bez krycej plochy).

### Pozor na malý text

Biela na koralovej má 3,4 : 1 — prejde pre veľký text (3 : 1), ale **neprejde
pre malý** (4,5 : 1). Týka sa to AI tagu a legalu. Máš tri možnosti; vyber
jednu a zdôvodni:

1. malý text tiež biely a plochu pod ním stmaviť cez `ensureReadableSurface`,
2. malý text biely s vlastnou podložkou (ale Surdo podložku nemá),
3. malý text biely a prijať 3,4 : 1 ako vedomú brandovú výnimku so záznamom
   do `validation_warnings`.

Napíš, ktorú si zvolil a prečo — toto je rozhodnutie, nie detail.

---

## Overenie

1. Všetky 4 sady v `tests/` prechádzajú.
2. Doplň test, ktorý overí, že text na brandovej ploche je biely bez ohľadu
   na to, či je brandová farba svetlá alebo tmavá.
3. Vygeneruj Meta 1:1, 4:5 a 9:16 a pošli screenshoty vedľa `0:40`, `0:13`, `0:4`.
   Na 9:16 musí byť headline biely a nesmie tam byť prázdny pás medzi fotkou
   a textom.
4. Nekomituj, kým to nepotvrdím.
