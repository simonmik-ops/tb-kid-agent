# Pracovný režim — ladenie vzhľadu generátora

Krátke pravidlá pre prácu na plugine. Cituj tento súbor v každom zadaní
namiesto opakovania pravidiel.

## Kolo

1. **Jedna zmena na jedno kolo.** Nie tri body naraz, nie „a pri tom aj…".
2. Spusti testy: `node tests/*.test.js` (všetky 4 sady).
3. **Commitni** — aj keď to ešte nie je overené okom. Commit nie je schválenie,
   je to bod návratu.
4. Až potom generuj vo Figme a pozeraj.
5. Dobré → `git push`. Zlé → `git revert HEAD` a si presne tam, kde si bol.

**Nepushuj, kým to Simona nepotvrdí. Ale commituj vždy.**

Pracovný strom musí byť **čistý na začiatku každého kola**. Ak nie je,
najprv doriešiť predošlé kolo.

## Zákazy počas opravy

- **Žiadny refaktor.** Nezlučuj kód, nevyťahuj zdieľané funkcie, nepremenúvaj.
  Ak sa dve miesta správajú podobne, ešte to neznamená, že majú rovnakú
  sémantiku — takto vznikla regresia v `47f4523` (`easedAlphaStops` zlúčila
  dva rôzne významy toho istého parametra).
  Refaktor je samostatný commit, ktorý nemení správanie.
- **Nemeň nič mimo zadania.** Keď pri práci narazíš na inú chybu, **nahlás ju**,
  neopravuj.

## Zadanie musí obsahovať

- čo sa má zmeniť — konkrétne, s riadkami alebo názvami funkcií
- **čo musí zostať bitovo rovnaké** — konkrétne framy, vrstvy a hodnoty,
  nie „nepokaziť P0-8"
- akceptačné kritérium **napísané dopredu**, overiteľné diffom metadát,
  nie okom

## Referenčný vstup

Vzhľad sa ladí vždy na **tom istom KV a tej istej textácii**. Keď sa mení
vstup aj kód naraz, nedá sa rozlíšiť, čo spôsobilo zmenu vo výstupe.

Referenčný beh: jeden KV, jeden headline, sada Meta 1:1 / 4:5 / 9:16.

## Overenie po zmene

1. Testy prechádzajú.
2. Porovnaj **metadáta** framov pred a po (`get_metadata` cez Figma MCP) —
   pozície a rozmery vrstiev. Vizuálny dojem klame, čísla nie.
3. Napíš, čo sa zmenilo a čo zostalo rovnaké.
4. Ak zadanie malo viac bodov, prejdi ich **po jednom** a ku každému napíš:
   spravené / nespravené a prečo / rozhodol som sa inak a prečo.

## Referencia vzhľadu

Surďova Figma: `d51uxTh8YqPdHujzi1Plt6` — `0:40` (1200×1200), `0:13` (1200×1628),
`0:4` (1080×1920), `0:21` (1200×628).

Preberá sa **iba vizuál a rozloženie prvkov**. Textácie sú v plugine iné
zámerne (testujú sa) — neporovnávaj obsah textu ani absolútne pozície,
ktoré od dĺžky textu závisia.
