# Doplnok: odchýlky na stránkach „Clean assets" a „Performance"

Nadväzuje na `ZADANIE_dolad_kompoziciu.md` (tá riešila stránku „Meta").
Platí z nej aj úvodná poznámka: **zo Surďovej Figmy preberáme iba vizuál
a rozloženie prvkov, textácie sú u nás iné zámerne.**

**Náš výstup:** `jpAb03NqZJ6xYHKRAIcd0p` — stránky `650:1968` (Clean assets)
a `650:1975` (Performance).
**Referencia:** `d51uxTh8YqPdHujzi1Plt6` — `0:21` (1200×628), `0:48` (900×1600).

---

## A. Clean assets — biele pásy okolo obrázka (chyba)

Všetky tri framy na stránke `650:1968` majú **biely rám**:

| frame | prejav |
|---|---|
| `Clean image landscape` 1200×628 | biely pás vľavo aj vpravo |
| `Clean image square` 1200×1200 | biely rám dookola (~15 px) |
| `Google RSA story` 900×1600 | biely pás dole, tenký po bokoch |

Vrstva `Image asset - no text / no logo` má pritom rozmer celého frameu, takže
biela nie je z nej — presvitá **pozadie frameu** cez obrázok vložený režimom
„contain".

Surdo `clean` assety nemá ako samostatnú vrstvu, ale jeho KV je vždy
predimenzovaný štvorec s negatívnym offsetom (napr. 1107×1107 v 1200×628) —
teda **orezáva sa, nikdy sa nevkladá do plochy**.

**Uprav:** clean assety generuj ako full-bleed výrez KV. Žiadne „contain",
žiadne pozadie frameu. Ak KV nepokryje formát, doplň `brandColor(layout)`,
nikdy nie bielu.

---

## B. Full creative landscape — AI tag pretŕča z frameu (chyba)

Frame `650:1976` (1200×628):

```
AI generované — podložka:  y = 612, výška 24  →  spodok 636
AI generované (text):      y = 616, výška 16  →  spodok 632
frame:                     výška 628
```

Podložka aj text **prečnievajú cez spodnú hranu** o 8, resp. 4 px a sú
orezané. Na štvorcových formátoch sa to nedeje (Meta 1:1: 1155 + 27 = 1182
< 1200), takže je to špecifické pre nízke široké formáty.

**Uprav:** AI tag kotvi od spodnej hrany (`frame.height − odsadenie − výška`),
nie výpočtom, ktorý môže pretiecť. Over na 1200×628, 970×250, 1200×200
a 320×100.

---

## C. Slogan „Myslite na seba" je neviditeľný

Na `650:1976` je slogan na súradniciach (48, 48) — teda **nad fotkou**, ktorá
je v tom mieste svetlá koralová. V renderi ho nevidno.

Je to ten istý problém ako P0-16, len na novom mieste: text leží na fotke bez
krycej plochy.

**Uprav:** slogan buď umiestni na krycí panel, alebo mu daj vlastnú krycí
podklad — rovnakým pravidlom, aké platí pre headline.

---

## D. KV je na širokých formátoch príliš úzky

| | Surdo `0:21` | my `650:1976` |
|---|---|---|
| formát | 1200×628 | 1200×628 |
| šírka KV | 898 px (**75 %**) | 615 px (**51 %**) |
| prechod | eliptický oblúk | zvislý lineárny |

Rozdiel je vidieť na prvý pohľad: u Surďa je postava veľká a orezaná v páse,
motív „5 €" vybieha z hrán. U nás je postava malá, celá v zábere, motív
odsadený.

**Uprav:** to isté pravidlo ako v bode 1 predošlého zadania — KV predimenzovať.
Na širokých formátoch musí pokryť aspoň 70 % šírky, kým sa začne prechod.

---

## E. Prechod na širokých formátoch je stále lineárny

`Wide content panel` na `650:1976` je obyčajný zvislý gradient (x = 348,
šírka 852). Surdo má `PRECHOD` → `O maska` → boolean Subtract dvoch elíps,
plus úzky rovný pás na šve.

**Uprav:** nahraď `GRADIENT_RADIAL` s posunutým stredom (nie je nutné robiť
boolean operácie). Toto bolo v predošlom zadaní ako bod 4 pre výškové formáty —
platí rovnako, možno viac, pre široké.

---

## F. Nekonzistencie medzi stránkami (nahlás, nemeň sám)

1. **Slogan „Myslite na seba"** je na stránke „Performance" na všetkých troch
   frameoch, ale na stránke „Meta" nie je nikde. Surdo ho nemá ani na jednom
   Meta formáte. Napíš, z čoho tá podmienka vychádza — rozhodne sa to
   s Surďom, nemeň to sám.
2. **Podložka pod AI tagom** je na Performance aj na Meta 1:1 a 4:5, ale na
   Meta 9:16 chýba. Po oprave podľa predošlého zadania (podložka sa má zrušiť)
   to bude jedno — over, že po zmene je to všade rovnaké.
3. **`Bottom readability gradient` pri rovnakom rozmere začína inde:**
   Meta 1:1 na y = 740 (62 %), Full creative square na y = 594 (49,5 %).
   Oba sú 1200×1200. Predpokladám, že je to legitímne (Full creative má
   navyše CTA button, ktorý tlačí text hore) — potvrď, že je to zámer.

---

## Overenie

1. Všetky 4 sady v `tests/` prechádzajú.
2. Pošli screenshoty `Clean image square`, `Google RSA story`
   a `Full creative landscape` — pri poslednom priblíž spodnú hranu,
   nech je vidieť, že AI tag nie je orezaný.
3. Nekomituj, kým to nepotvrdím.
