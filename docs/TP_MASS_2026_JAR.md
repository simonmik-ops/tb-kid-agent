# TP — TB MASS 2026 JAR (Účet #premodruplanetu) — obsah a zhoda s pluginom

> **Stav k 10. 8. 2026 — časť je už spravená v kóde.**
> Do `formats.js` je doplnená kampaň `mass` a 7 formátov, ktoré katalóg nemal:
> `mass_minuta_320x100`, `mass_dv360_companion_640x640`, `mass_valetin_preroll_video`,
> `mass_dennikn_podcast_logo`, `mass_startitup_interscroller`,
> `mass_cp_square_300x300`, `mass_cp_square_300x250`. Spolu 150 formátov, 6 kampaní.
> Všetky 4 testovacie sady prechádzajú. **Zmena je necommitnutá** v pracovnom strome,
> záloha pôvodného súboru je `formats.js.bak_pred_mass`.
> Textové výťahy z TP (po slajdoch) sú v `docs/tp-mass/*.txt`.

*Zdroj: 3 prezentácie od Illaša (SharePoint), všetky datované 7. 4. 2026. Načítané 10. 8. 2026.*
*Porovnané s `formats.js` v `~/Downloads/tb-kid-agent` (143 formátov, 5 kampaní: KID, KK Visa, Hypo, BSU, Tiger).*

| Súbor | Slajdov | Obsah |
|---|---|---|
| TP - TB MASS 2026 JAR DISPLAY.pptx | 30 | Display + DM, DDL 7. 4. |
| TP - TB MASS 2026 150EUR JAR PPC.pptx | 78 | PPC Awareness (DDL 7. 4.) + Consideration a Performance (DDL 30. 3.) |
| TP - TB MASS 2026 3 roky JAR PPC.pptx | 47 | PPC Consideration + Performance, benefit „3 roky bez poplatku" |

---

## 1. Čo je to za kampaň

**Tatra banka — MASS, Účet #premodruplanetu, jar 2026.** Nie je to žiadna z 5 kampaní, ktoré plugin dnes pozná. Je to **šiesta kampaň** a bude potrebovať vlastný `campaigns` záznam aj vlastnú vetvu formátov.

Kampaň má **dva benefitové prúdy**, ktoré bežia paralelne v tých istých formátoch:

- **150 EUR** — „až 100 EUR späť z platieb kartou + extra 50 EUR za prenos účtu"
- **3 roky bez poplatku** — „1 rok za otvorenie + ďalšie 2 roky za prenos účtu"

TP to opakovane píše ako **„2× skupina podkladov — 150 € benefit + 3 roky bez poplatkov"**. To je pre plugin podstatné: nejde o dve kampane, ale o **jednu kampaň s dvoma sadami textov a claimov nad tou istou geometriou**.

## 2. Menná konvencia kreatív (dôležité pre plugin)

TP pomenúva každý podklad podľa vzoru:

```
{benefit}-{postava}-{typ}[-{fáza}][-{dĺžka}][-rmkt]

150-muz-image            3roky-zena-muz-cons
150-zena-image-10        3roky-dievca-chalan-cons-rmkt
150-typo-modra-cons      3roky-muz-chalan-hardsell
150-image-15 / -20 / -33   (video, sekundy)
150-app-dievca-hardsell    (UAC / app install)
```

- **benefit:** `150` | `3roky`
- **postavy:** `muz`, `zena`, `dievca`, `chalan` — v PPC 3 roky vždy **v dvojiciach** (`zena-muz`, `dievca-chalan`, `muz-chalan`, `zena-dievca`)
- **typo varianty (bez postavy):** `typo-bleda`, `typo-cierna`, `typo-hneda`, `typo-modra` — v Displayi ako `150-bleda-image`, `150-cierna-image`, `150-hneda-image`
- **fáza:** `cons` (consideration) | `hardsell` (performance) | bez prípony (awareness)
- **`-rmkt`** = remarketingová obmena
- **číslo na konci** = dĺžka videa v sekundách (10, 15, 20, 33)

➡️ **Plugin dnes pozná typy `awareness | hardsell | remarketing`, ale nemá `consideration`.** V TP je consideration samostatná fáza s vlastným DDL aj vlastnými textami. Bez nej sa MASS namapovať čisto nedá.

## 3. Rozmery — čo plugin má a čo mu chýba

### Chýba úplne (nový rozmer v `formats.js`)

| Rozmer | Kde | Poznámka |
|---|---|---|
| **320×100** | Minúta po minute banner | 3× kreatíva, max 250 kB, jpg/gif — typo varianty (hnedá, čierna, bledá) |
| **640×640** | Google DV360 audio — companion banner | k 20 s audio spotu |
| **1280×720** | Valetin preroll/midroll | video HD (1920×1080 v plugine je, 1280×720 nie) |
| **63×63** | Denník N — sponsoring Hlavného podcastu | logo k 30 s spotu, k tomu krátky text |

### Rozmer existuje, ale nie pre tento kanál

| Rozmer | Existuje ako | Potrebné pre |
|---|---|---|
| **500×800** | `nmh_dm` (e-mail) | startitup.sk interscroller — iný kanál aj pravidlá (max 100 kB, gif/jpg/html5) |
| **300×300** | `tig_rtb_300x300` (len Tiger) | cp.sk square — treba aj pod MASS |

### Všetko ostatné plugin geometricky pokrýva

`2000×1400` (joj, markíza branding) · `1000×200 + 2×120×600` (markíza) · `720×1280` (markíza, aktuality/sport/azet/zive) · `750×1624` (pluska/plus7dni/cas, safe zóna 750×982, min 375×812) · `1275×250 + 2×160×600` (hnonline) · `400×600` (hnonline mobil, topky) · `1000×200 + 2×160×600` (sme) · `320×600` (sme interscroller) · `1200×400` (aktuality desktop leaderboard) · `450×800` (topky branding, 2×) · `1200×200 + 2×200×700` (pravda) · `300×600` (pravda interscroller — pozor, safe area 50 px vľavo aj vpravo) · `1000×1500` (Pinterest 2:3) · `640×500` (azet DM) · `800×600` / 4:3 (Engerio native) · `300×60` (YouTube companion) · celá PPC sada `1200×1200`, `1200×628`, `1200×1500`, `900×1600`, `960×1200`, `1200×300`, `1080×1920`.

## 4. Čo z TP plugin dnes nevie (mimo rozmerov)

1. **Dve skupiny podkladov nad jedným KV.** TP žiada v každom PPC formáte obe benefitové sady naraz. Plugin generuje jednu sadu z jedného KV.
2. **8 kreatívnych variantov — ale to nie je problém pluginu.** Logika KV (objekt v strede, dýchacia plocha okolo, focal point, safe zóny) je vlastnosť formátu, nie kampane. 4 postavy (muž, žena, dievča, chalan) sú požiadavka klienta na obsah — znamenajú 8 vstupov namiesto jedného, teda 8 spustení generátora, nie zmenu rendereru. Otvorená ostáva len ergonómia: či to obsluha spustí 8× ručne, alebo pribudne dávkový režim.
   > ⚠️ **Výnimka: `typo-bleda / cierna / hneda / modra`.** To nie sú fotky s postavou, ale typo-farebné plochy. Niet tam subjekt, okolo ktorého orezávať, a scrim nad plochou farbou je zbytočný. Overiť, či plugin na KV bez subjektu nerobí kompozičnú prácu naprázdno.
3. **Fáza `consideration`.** Chýba v `type[]`, pritom má vlastný DDL (30. 3. pri 150 EUR, 7. 4. pri 3 rokoch) a vlastné textácie.
4. **Remarketingová obmena textov.** `-rmkt` nie je iný rozmer, je to iná sada textov v tom istom formáte. Plugin má `remarketing` ako typ formátu, nie ako textovú vrstvu.
5. **Textové limity per formát.** TP ich uvádza veľmi presne (primárny text 125 zn., titulok 27 zn., popis 27/90 zn., nadpis 30/40 zn., UAC 30/90, DemandGen názov značky 25 zn., azet DM predmet 80 zn./odosielateľ 25 zn.). Plugin auto-fituje headline, ale limity počtu znakov nevynucuje.
6. **Podklady „graficky kompletné".** Pri Demand Gen TP výslovne píše: *„Podklady potrebujeme graficky dodať kompletné (headline, CTA button, logo)"* — kým pri PMax je to naopak: *„Vizuál musí obsahovať iba headline — CTA button aj logo sa doťahuje systémom."* Toto je presne ten typ pravidla, ktorý patrí do `campaign-rules.js` (`noText`, `logoOnly`, `ctaBySystem`) a je otvorený v P1-2.
7. **Váhové limity.** Display TP dáva tvrdé stropy (60 kB / 75 kB / 100 kB / 150 kB / 200 kB / 250 kB / 300 kB podľa média). V plugine `limit` v kB podľa P1-2 nie je overené, že je naplnený.
8. **Počty kreatív na obdobie.** „Interscroller max 3–4× na obdobie, Branding 1× na obdobie" — dnes v dátach nie je.

## 5. Návrh, čo s tým

**MASS je z veľkej časti dátová úloha, nie inžinierska** — geometria formátov aj logika KV ostávajú, mení sa obsah. Nezasahuje do rozrobeného P0-16:

1. Pridať `mass` do `campaigns` (`tagging: "mass-jar-2026"`, label „MASS — Účet #premodruplanetu JAR 2026").
2. Doplniť 4 chýbajúce rozmery (`320×100`, `640×640`, `1280×720`, `63×63`) a 2 preklopiť na nový kanál (`500×800` startitup, `300×300` cp.sk).
3. Založiť `mass_*` sadu formátov podľa Display TP (18 médií) + PPC TP (Meta, Google RSA, Demand Gen, UAC, PMax, TikTok, YouTube, DV360, Adform).
4. Doplniť `limit` v kB a `count` (max × na obdobie) z Display TP — sú tam explicitne.

**Vyžaduje rozhodnutie:**

- **Ako reprezentovať dva benefity?** Dve kampane (`mass150`, `mass3roky`) ako to má TP rozdelené do dvoch súborov, alebo jedna kampaň s prepínačom benefitu v UI? Odporúčam druhé — geometria je identická, líšia sa len texty a claim.
- **Dávkový režim, alebo 8× ručne?** Logika KV sa nemení, ide len o ergonómiu obsluhy. Nie je to blokujúce — 8 spustení funguje už dnes.
- **Pridať `consideration` do `type[]`?** Bez toho sa TP fázy nedajú namapovať.

**Do `Co_potrebujem_od_kolegov.md`:**

- KV / fotky pre všetkých 8 variantov (muž, žena, dievča, chalan + 4 typo varianty), surové, bez napáleného textu
- Presné znenie legalu pre MASS (RPSN / podmienky benefitu 100 + 50 EUR a 1 + 2 roky)
- Potvrdiť, či `4:5 (mobil) 1200x628` v PPC TP je preklep — 1200×628 je 1,91:1, nie 4:5. Plugin má Meta 4:5 rozhodnuté ako **1200×1628**.
- Denník N: podoba loga 63×63 (transparentné?)
- Valetin: 1280×720 aj 1920×1080, alebo stačí jedno?

---

*Textové výťahy zo všetkých troch prezentácií (kompletné, po slajdoch) sú na Macu v `~/Downloads/_tp_mass/` ako `.txt` vedľa stiahnutých `.pptx`.*
