# Zadanie pre Claude Code — TB Figma Generator

**Repo:** `~/Downloads/tb-kid-agent`
**Vetva:** `fix/citatelnost-6-8` (obsahuje P0-10 až P0-22)
**Súbory, ktorých sa to týka:** `plugin/code.js`, `plugin/ui.html`

---

## Kontext v jednej vete

Plugin generuje z key visualu 138 online reklamných formátov pre Tatra banku.
Zdroje pravdy sú tri: `Adform_dievca.psd` (4 Adform formáty), TP referencia
(`docs/TP_MASTER_SAFE_REFERENCE.md`) a Surďov dotazník
(`claude/Surdo_odpovede_do_pluginu.md` v Claude projekte „Plugin").

---

## NAJDÔLEŽITEJŠIE: ako pracovať, aby sa to nerozbíjalo

Toto je poučenie z 7. 8., keď sa plugin opakovane rozbil. **Dodržuj to.**

### 1. Nikdy needituj nahradzovaním rozsahu podľa indexov

Zákaz `s[start:end] = novy`. Takto zmizla funkcia `logoLuminance`, ktorá
sedela vnútri prepisovaného rozsahu, a plugin padal u používateľa na
`logoLuminance is not defined`.

Používaj presné, jednoznačné nahradenie reťazca a **over, že zásah sedel**.

### 2. Po každej úprave spusti testy

```bash
cd ~/Downloads/tb-kid-agent
for t in tests/*.test.js; do node "$t" || echo "SPADLO: $t"; done
```

`tests/integrita.test.js` je statická kontrola, ktorá chytá:
- volanú, ale nedefinovanú funkciu v `code.js` aj `ui.html`
- syntax každého `<script>` bloku v `ui.html`
- chýbajúcu povinnú funkciu layoutu
- `figma.create*()` node, ktorý sa nikde nepripája → Figma ho položí na
  aktuálnu **stránku** (takto vznikli osirené obdĺžniky na Page 1)

### 3. Neposielaj neoverené zmeny

Dnes zlyhali dve zmeny, ktoré fungovali v simulácii a nie v ostrej Figme:

| zmena | prečo zlyhala |
|---|---|
| `scaleMode: "CROP"` + `imageTransform` na natiahnutie hrany | Figma tú maticu interpretuje inak, než dokumentuje → nesprávny výrez |
| `kvEdgeColors` — vzorkovanie farieb pozdĺž hrany cez `<canvas>` | v ostrej Figme vracalo nuly → doplnená plocha bola **čierna** |

**Pravidlo:** čokoľvek, čo sa opiera o `imageTransform`, `getImageData`
alebo iné API mimo overeného základu, sa nasadzuje až po overení na
skutočnom výstupe vo Figme — nie na základe simulácie.

Overený základ, na ktorý sa dá spoľahnúť: `figma.createRectangle/Text/Frame`,
`resize`, `x`, `y`, `fills` (SOLID, GRADIENT_LINEAR, IMAGE s FILL/FIT),
`appendChild`, `insertChild`, `remove`, `textAutoResize`, `maxLines`.

---

## Ako výstup overiť bez generovania vo Figme

V `~/harness` je headless render: mock Figma API v Chromiu, ktorý spustí
**skutočný `plugin/code.js`** a vyrenderuje všetkých 138 formátov do PNG.

```bash
cd ~/harness
node run.js                 # vyrenderuje všetko do out/
node run.js meta_img_1x1    # len vybraný formát
node audit.js               # render 2x (s textom a bez) do audit/
python3 check.py            # prekryvy, pretečenia, kontrast, min. veľkosti
python3 vizual.py           # typografia, farby, rozloženie, zarovnanie
```

**Cieľový stav:** `check.py` hlási len 3 nálezy `MALE_LOGO`
(`vinted_320x50`, `hyp_yt_companion`, `tig_yt_companion` — tam sa 50 px
logo fyzicky nezmestí). `vizual.py` hlási 13, všetky na mikroformátoch,
kde je pozícia loga daná predlohou kanála.

**Pozor na limity harnessu.** Mock nie je Figma. Rozdiely, na ktoré sa
naletelo: `findOne`/`insertChild` museli byť domockované, `maxLines`
tiež, `imageTransform` sa správa inak. Keď výsledok závisí od niečoho,
čo mock simuluje, over to na živom výstupe.

---

## Otvorené úlohy

### A. Doplnená plocha pri contain — momentálne najjednoduchšie riešenie

**Stav:** keď sa pomer strán KV a formátu líši o viac ako 1,35, KV sa
vloží celý (contain) a zvyšok plochy sa vyplní `brandColor(layout)` —
farbou odvodenou z horných rohov KV. Pri hrane fotky je krátky prechod.

**Zadanie:** TP hovorí *„(the extension zone) may contain continuing
background graphics or a smooth transition to one colour."* Robíme len
druhú polovicu. V PSD to Surďo rieši vrstvou `Generative Fill`
(artboard 300×600) — Photoshop si pozadie dogeneruje.

Možné cesty, v poradí podľa rizika:
1. **Nechať tak.** Funguje, je to v súlade so Surďom („okraje = brand farba").
2. Natiahnuť skutočný pás pixelov z hrany — **bez `imageTransform`**, čistou
   geometriou: orezávací frame + kópia obrázka zväčšená a posunutá tak, aby
   v páse bola vidieť len oblasť pri hrane. Overiť na živej Figme.
3. Generative fill na serveri (Railway) — najvernejšie PSD, najväčší zásah.

**Neopakuj:** vzorkovanie farieb cez `<canvas>` (skúšané, vracalo čierne)
ani `imageTransform` (skúšané, zlý výrez).

### B. Minimá z dotazníka vs. rozmer formátu

- `vinted_320x50`, `hyp_yt_companion`, `tig_yt_companion`: logo vychádza
  40–48 px, minimum je 50 px. Do bannera vysokého 50–60 px sa 50 px logo
  nezmestí. **Treba rozhodnutie od Surďa**, nie oprava kódu.
- Adform PSD šablóny majú legal 7 px, badge 8 px, AI tag 9 px. **Je to
  správne** — sú to hodnoty odčítané z PSD a PSD má prednosť pred
  všeobecným minimom 12 px. Je to zapísané v komentári pri
  `ADFORM_PSD_RULES`. Nemeň to.

### C. Branding a interscroller

Podľa `claude/Plugin_podla_Surdu.md`: *„bežia, ale ešte nemajú Surďov
dizajn (jeho Figma ich neobsahovala) → do demo ich zatiaľ nedávať."*
Nechaj ich, kým nepríde predloha.

### D. Čaká na podklady od Surďa

- **biela verzia loga** — plugin nemá ako prefarbiť bitmapu. Používateľ má
  v `~/Downloads` `tb_logo_white.png` aj `tb_logo_black.png`; pri tmavom
  podklade treba nahrať bielu. Ideálne by UI malo dovoliť nahrať obe a
  plugin by si vybral podľa jasu podkladu (`LOGO_LUMA` a `KV_LUMA_BOTTOM`
  už v kóde sú).
- VISA | TB lockup pri kreditkách
- promo placka („Získajte až 50 EUR") ako samostatný element
- presné znenie RPSN / disclaimeru

---

## Čo je hotové (needituj bez dôvodu)

| # | čo |
|---|---|
| P0-10 | `scrimAlphaFor` mal obrátené znamienko — svetlý KV dostával 35 % krytia namiesto 90 %, headline vychádzal na 1,8–2,9 : 1. Regresia z P0-7. |
| P0-10 | Legal text sa kreslil naslepo do 1-riadkového boxu a pri zalomení pretekal mimo frame (16 formátov). Teraz `planBottomStack()` meria dopredu. |
| P0-11 | Headline sa centruje len pri formátoch bez CTA (TP: Google 900×1600). |
| P0-13 | Obnovené Surďovo pravidlo contain (prah 1,35) — stratilo sa pri prepise na `master_safe`, v kóde ostala mŕtva premenná `KV_RATIO`. |
| P0-14 | `placeLogo` kontroloval minimum 50 px len na šírku; pri `scaleMode FIT` určuje veľkosť značky menší rozmer. |
| P0-15 | „Blurred background NIKDY" a „video formáty vynechať" — obe pravidlá boli v dokumentácii označené ako hotové, v kóde neplatili. |
| P0-16 | Nepoužitý scrim sa musí `remove()` — inak ho Figma položí na stránku. |
| P0-21 | Podnadpis blokoval pevný prah `min(šírka, výška) < 400 px`. Vypínal ho na väčšine bannerov. |
| P0-21 | Farba textu podľa podkladu (Surď, sekcia 2) — platí pre headline, podnadpis, legal aj AI tag. Rozhoduje to, čo je pod textom **naozaj**: pri scrime biela, na brand ploche podľa jej jasu. |
| P0-22 | Prázdny headline zastaví generovanie. Figma pri Reload resetuje formulár a plugin ticho generoval sadu bez textu. |

**Overené proti PSD:** pozície sloganu, headlinu, prelepky, legalu, CTA,
lockupu a AI tagu na všetkých štyroch Adform artboardoch sedia s
`Adform_dievca.psd` do 2 px. Neposúvaj ich.

---

## Prvé kroky

```bash
cd ~/Downloads/tb-kid-agent
git log --oneline -15
for t in tests/*.test.js; do node "$t"; done
cd ~/harness && node audit.js && python3 check.py && python3 vizual.py
```

Ak `check.py` hlási viac než 3 nálezy alebo `vizual.py` viac než 13,
niečo sa pokazilo — porovnaj s `git diff`.
