# master_safe "portrait" — prázdna medzera nad textom (zistené 25. 8. 2026)

*Kontext: nájdené pri vizuálnej QA kontrole `~/Downloads/hotové/...` a
Figma súboru `jpAb03NqZJ6xYHKRAIcd0p` (sekcia "Vinted") — porovnanie
`vinted_300×600` (zle) vs. `vinted_970×250` (dobre). Pôvodne vyzeralo ako
Vinted-špecifický problém (chýbajúci Adform PSD alias — to je opravené,
commit `cca3f83`), ale koreň príčiny je iný a širší.*

## Čo je zle

`vinted_300×600` mal vo vygenerovanom frame-e ~228 px prázdnej brandovej
plochy medzi fotkou (končí ~y=300) a prvým textovým prvkom (headline
začínal ~y=462 z celkových 600 px výšky = 77 % dole). Vizuálne to
pôsobí ako rozbitý/nedokončený layout.

## Prečo — presný mechanizmus (nie odhad, vystopované v kóde)

`buildMasterSafeLayout` (`plugin/code.js:2580` a okolie) pre "portrait"
rodinu (pomer strán ≤ 0,8):

1. Fotka sa vyskladá hore (`fittedMasterH`), pod ňou farebný panel
   (`Adaptive portrait content panel`) — to je v poriadku, panel
   samotný je vyplnený gradientom, nie prázdny.
2. Text (CTA → medzera → subheadline → medzera → headline) sa skladá
   **zdola nahor** (`code.js:2853`: `cursorY = cb.y + cb.h - pad`), kde
   `cb` je content box z `resolveContentBox(format)`.
3. `resolveContentBox` pre formát bez špeciálnych `safeZones` (žiadny
   `top`/`bottom`/`sides`/`safeInner`/`centerWidth` — najbežnejší prípad)
   vráti **celý frame** (`{x:0,y:0,w:W,h:H}`), nie oblasť panelu.
4. Výsledok: text je ukotvený k spodku CELÉHO frame-u, nie k panelu.
   Medzera nad textom = `frame_height − pad − (výška CTA+medzery+
   subheadline+medzery+headline)` — v absolútnych pixeloch skoro
   konštantná (typicky ~140–200 px podľa dĺžky textu), takže pri
   **vysokom/úzkom** frame-e (napr. 300×600, pomer 0,5) tvorí veľkú
   časť výšky, kým pri formátoch bližších k pomeru, pre ktorý bol
   algoritmus ladený (Surďova referencia 1080×1920 / 1200×1628, komentár
   priamo v kóde na `code.js:2760`), je relatívne menšia a menej
   nápadná.

**Nie je to teda bug špecifický pre "portrait rodinu" ako celok — je to
vlastnosť zdola-nahor skladania v content-boxe, ktorý sa rovná celému
frame-u.** Prejavuje sa najviac pri úzkych/vysokých pomeroch (≤ 0,5–0,625).

## Ktoré formáty sú vystavené rovnakému mechanizmu

Prerátané cez `formats.js` (podmienky: pomer ≤ 0,8, výška > 100,
role/creativeRule vedie na `master_safe` layoutType, **nie** Adform
[tie majú presnú `adform_psd` kompozíciu, tento problém sa ich netýka],
a `safeZones` bez `top/bottom/sides/safeInner/centerWidth` → content box
= celý frame):

| formát | rozmer | pomer | rola | odhad rizika |
|---|---|---|---|---|
| `markiza_branding_side` | 120×600 | 0,20 | publisher_branding | vysoké |
| `adform_160x600`-shape (Vinted/Adform vyňaté) | — | — | — | — |
| `joj_interscroller_mobile` | 300×600 | 0,50 | publisher_branding | vysoké |
| `tig_rtb_300x600` | 300×600 | 0,50 | publisher_branding | vysoké |
| `vinted_300x600` | 300×600 | 0,50 | *(opravené aliasom, mimo rizika)* | — |
| `markiza_interscroller` | 720×1280 | 0,56 | publisher_branding | vysoké |
| `ringier_interscroller` | 720×1280 | 0,56 | publisher_branding | vysoké |
| `tig_rtb_720x1280` | 720×1280 | 0,56 | publisher_branding | vysoké |
| `meta_video_9x16` | 1080×1920 | 0,56 | publisher_branding | vysoké |
| `meta_img_9x16` (+ kkv/hyp varianty) | 1080×1920 | 0,56 | meta_full | vysoké |
| `tig_heyfomo_portrait` | 1080×1920 | 0,56 | publisher_branding | vysoké |
| `joj_interscroller_desktop` | 600×960 | 0,63 | publisher_branding | stredné |
| `meta_img_4x5` (+ kkv/hyp varianty) | 1200×1628 | 0,74 | meta_full | nízke–stredné (blízko referenčného pomeru) |
| `meta_video_4x5` | 1200×1500 | 0,80 | publisher_branding | nízke |
| `demandgen_portrait` (+ kkv/hyp/bsu/tig) | 960×1200 | 0,80 | full_creative | nízke |
| `pmax_portrait` (+ kkv) | 960×1200 | 0,80 | headline_only | nízke |

Spolu **24 katalógových záznamov** (počítajúc kampaňové varianty
osobitne). "Vysoké riziko" = pomer ≤ 0,625, kde sa problém v testovanom
prípade (Vinted 300×600) prejavil viditeľne.

**Poznámka:** 6 z formátov s "publisher_branding" rolou vyššie
(`markiza_interscroller`, `joj_interscroller_mobile/desktop`,
`ringier_interscroller`, plus ďalšie `*_interscroller` bez `zenske_`/
`topky_` prefixu) sú tie isté formáty z otvoreného odporúčania P0-26
(agent.js dead branches) — keby dostali rolu `interscroller`, ako sa tam
navrhuje, automaticky by vypadli z tohto zoznamu (smerovali by na
`interscroller_safe`, nie `master_safe`). Dve nezávislé zistenia sa tu
prekrývajú v riešení.

## Čo NEBOLO urobené

Žiadna zmena v `buildMasterSafeLayout` ani `resolveContentBox`. Zásah by
sa dotkol 24 aktívnych formátov naraz naprieč Meta/Google/publisher
kanálmi bez možnosti vizuálne overiť výsledok v Figme z tejto session —
riziko vizuálnej regresie je vysoké, rozhodnutie o rozsahu/prístupe
(napr. viazať content box na panel namiesto celého frame-u, alebo
nastaviť `safeZones.top` per formát) je pre Simonu.
