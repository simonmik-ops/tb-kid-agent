# Zadanie: doladenie kompozície podľa Surďovej Figmy

Kompozičný model už sedí — prechod je brandový, nie čierny, a vyzerá dobre.
Ostávajú štyri rozdiely oproti referencii. Sú namerané z vrstiev, nie odhadnuté.

**Referencia:** `https://www.figma.com/design/d51uxTh8YqPdHujzi1Plt6/Untitled?node-id=0-1`
(`0:40` = 1200×1200, `0:13` = 1200×1628, `0:4` = 1080×1920)

**Náš výstup:** `https://www.figma.com/design/jpAb03NqZJ6xYHKRAIcd0p/Untitled?node-id=650-1920`

> **Dôležité:** zo Surďovej Figmy preberáme **iba vizuál a rozloženie prvkov**.
> Textácie sú u nás iné zámerne (testujú sa), takže nikdy neporovnávaj obsah
> textu ani absolútne pozície, ktoré od dĺžky textu závisia. Porovnávaj mierku
> KV, tvar a dĺžku prechodu, odsadenia, vzájomné vzťahy prvkov a pravidlá,
> podľa ktorých sa počítajú.

## 1. KV musí byť predimenzovaný

| formát | Surdo `VIZUAL-KV` | násobok | náš `Master visual` |
|---|---|---|---|
| 1200×1200 | 1628×1628 @ (−214, −314) | ×1,36 | 1200×1225 @ (0, 0) |
| 1200×1628 | 1842×1842 @ (−321, −232) | ×1,53 | 1595×1628 @ (−197, 0) |
| 1080×1920 | 1686×1686 @ (−303, −271) | ×1,56 | 1080×1103 @ (0, 0) |

Surďov KV je **vždy štvorec** a vždy väčší než frame — orezáva sa, nikdy sa
nezmestí celý. Náš sa škáluje tak, aby sa vošiel na šírku, takže postava je
menšia a pôsobí vzdialenejšie.

**Uprav:** KV škáluj tak, aby jeho kratšia strana pokryla dlhšiu stranu frameu
s rezervou — cieľ je násobok ~1,35–1,55 voči šírke frameu, ako v tabuľke.
Pozíciu odvoď z focal pointu (subjekt zostáva v hornej tretine, nie na strede).

## 2. Meta 9:16 nemá prechod vôbec

Vo frame `Meta image 9:16 — PRODUCTION` **chýba vrstva `Bottom readability
gradient`**. Fotka (`Master visual` 1080×1103) končí tvrdou hranou na 57 %
výšky a pod ňou je holé pozadie frameu. Framy 1:1 a 4:5 tú vrstvu majú.

Zisti, prečo tá vetva prechod nevykreslí — pravdepodobne `scrimTreba`
(`scrimTop < _obrazokDole - 2`) vyjde `false`, keď fotka nesiaha až pod
začiatok textu. Pri `contain` fite to nastane vždy.

**Uprav:** prechod sa musí vykresliť aj vtedy, keď fotka končí NAD textom —
vtedy má prekryť práve tú hranu, kde fotka končí, nie oblasť pod textom.

## 3. Tmavomodrý headline na 9:16

Je to dôsledok bodu 2 — bez krycej plochy prepne logika farby textu na tmavú.
Over, že po oprave prechodu je headline aj subheadline biely. Ak nie, je to
samostatná chyba vo výbere `FARBA_TEXTU` a nahlás mi ju.

## 4. Chýba plne krycí pás na konci

Surdo má na výškových formátoch samostatný **nepriehľadný** blok brandovej
farby pod prechodom:

| formát | prechod (y, h) | nepriehľadný pás (y, h) | pás začína na |
|---|---|---|---|
| 1200×1628 | 818, 496 | 1314, 314 | 81 % výšky |
| 1080×1920 | 780, 496 | 1276, 644 | 66 % výšky |
| 1200×1200 | 704, 496 | — (žiadny) | — |

My dobiehame na plnú alfu až v poslednom pixeli, takže cez korál presvitá
silueta — vidno na 4:5 pri „Investujte s nami".

**Uprav:** na formátoch s pomerom vyšším než 1:1 pridaj za prechod plne krycí
pás brandovej farby. Na štvorci ho Surdo nemá, tam stačí, aby gradient dosiahol
plné krytie skôr než na spodnej hrane.

## 5. Prechod začína neskoro

| formát | Surdo | my |
|---|---|---|
| 1200×1628 | 818 = **50 %** výšky | 1051 = 65 % |
| 1200×1200 | 704 = **59 %** | 740 = 62 % |

Na štvorci sme blízko, na 4:5 začíname o 15 percentuálnych bodov neskôr.

**Uprav:** začiatok prechodu odvoď z pomeru strán — čím vyšší formát, tým skôr
prechod začína (1:1 ≈ 59 %, 4:5 ≈ 50 %, 9:16 ≈ 41 % podľa `780/1920`).

## 6. AI disclosure nemá mať podložku

Surdo: biely text + ikonka priamo na brandovej ploche, žiadny podklad.
My: `AI generované — podložka` (tmavý rounded-rectangle) pod textom.

Navyše je to u nás nekonzistentné — 1:1 a 4:5 podložku majú, 9:16 nie.

**Uprav:** zruš podložku, text bielou priamo na ploche. Podložku ponechaj len
tam, kde AI tag padne na fotku (nie na krycej ploche) — a over, či taký prípad
po zmene vôbec ešte nastane.

## 7. Motív musí pretínať okraje

U Surďa „5" začína na ľavej hrane frameu a kruh „€" vybieha von z pravej hrany.
U nás je motív odsadený z oboch strán. Súvisí to s bodom 1 — je to dôsledok
toho, že KV nie je predimenzovaný. Over po oprave bodu 1; ak motív stále
nepretína okraje, je chyba aj v pozícii, nielen v mierke.

## 8. Vertikálny rytmus textového bloku

⚠️ **Neporovnávaj absolútne pozície** — Surdo má trojriadkový headline, my
jednoriadkový, takže „headline začína na 77 % vs 70 % výšky" je dôsledok inej
dĺžky textu, nie chyba. Porovnávaj len pravidlá:

- **Medzera headline → subheadline.** U nás **240 px** (headline končí 1221,
  subheadline začína 1380) pri veľkosti písma headlinu ~81 px — teda skoro
  3× veľkosť písma. Surdo má riadky natesno pod sebou. Náš text nepôsobí ako
  blok, ale ako tri oddelené prvky.
  **Uprav:** medzeru odvoď od veľkosti písma (0,4–0,6 × veľkosť headlinu),
  nie fixne a nie z výšky frameu.

- **AI tag od spodnej hrany.** U nás 47 px, pričom zľava má odsadenie 77 px.
  Surdo ho má opticky vyrovnaný.
  **Uprav:** rovnaké odsadenie zdola ako zľava.

- **Textový blok ako celok** má byť ukotvený zdola (od AI tagu nahor), nie
  zhora — potom dĺžka headlinu neposúva celý blok.

## Otázka mimo kódu (nerieš, len nahlás)

Surdo nemá na Meta formátoch slogan „Myslite na seba" vôbec, hoci P0-12 ho
žiada na všetkých layoutoch. Nerob s tým nič — len to napíš do odpovede,
rozhodne sa to s Surďom.

## Overenie

1. Všetky 4 sady v `tests/` prechádzajú.
2. Vygeneruj Meta 1:1, 4:5 a 9:16 a pošli screenshoty vedľa Surďových nodov
   `0:40`, `0:13`, `0:4`.
3. Na 4:5 skontroluj, že pod headlinom nie je vidieť siluetu.
4. Na 9:16 skontroluj, že headline je biely a fotka nekončí hranou.

Nekomituj, kým to nepotvrdím.
