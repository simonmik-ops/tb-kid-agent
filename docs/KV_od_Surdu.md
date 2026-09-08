# KV od Surďa — posúdenie voči pluginu

*5 vizuálov, `~/Downloads/tb-vizualy 2`, posúdené 10. 8. 2026.*

| Súbor | Rozmer | Motív | Napálený claim |
|---|---|---|---|
| `04-kv-retargeting_04.png` | 7000×7000 | žena s mobilom, koralové pozadie | **áno — „50 €"** |
| `REM_ZENA.jpg` | 4000×4000 | žena s mobilom, béžové štúdio | **áno — „150 EUR"** |
| `VIZ_DIEVCA.png` | 4000×4000 | dievča, tmavomodré štúdio | **áno — „150 EUR"** |
| `VIZ03.png` | 4000×4000 | ruka s kartou, skalná roklina | nie |
| `VIZ03-VOLVO.png` | 4000×4000 | auto + postava, svetlé štúdio | nie |

## 1. Všetkých 5 je štvorec

Žiadny nemá 2000×1400 ani nič blízke pomerom, ktoré plugin generuje. Z 1:1 sa reže na 9:16, 970×250, 320×100, 1200×628. Pri extrémnych pomeroch (`320×100`, `970×250`) zo štvorca ostane vodorovný pásik cez stred — pri `VIZ03` je to holá skala bez karty, pri `VIZ03-VOLVO` prázdne pozadie bez auta. **Focal point (P1-6) tu prestáva byť kozmetika a stáva sa podmienkou použiteľnosti.**

## 2. Tri z piatich majú napálený claim

`04-kv-retargeting`, `REM_ZENA` a `VIZ_DIEVCA` majú v obraze vysádzané „50 €" / „150 EUR". To je priamy konflikt s dvoma vecami naraz:

- blokerom **B-5** (žiadaný surový KV bez napáleného textu),
- požiadavkou TP na Google RSA a Demand Gen — *„obrázky bez textu"* (`role: clean_image`).

Ak plugin nad to dosadí headline, výstup nesie claim dvakrát. Použiteľné sú takto len `VIZ03` a `VIZ03-VOLVO`.

## 3. Meranie jasu — potvrdzuje P0-16

Priemerná luminancia a kontrast **bieleho textu bez scrimu** (WCAG, minimum 4,5 : 1):

| KV | celok | spodných 25 % | ľavých 55 % |
|---|---|---|---|
| `VIZ03-VOLVO` | **2,4 : 1** ❌ | 7,0 : 1 | **3,2 : 1** ❌ |
| `04-kv-retargeting` | **3,3 : 1** ❌ | 8,1 : 1 | **3,5 : 1** ❌ |
| `REM_ZENA` | **3,4 : 1** ❌ | **4,4 : 1** ❌ | **3,4 : 1** ❌ |
| `VIZ_DIEVCA` | 5,1 : 1 ✅ | 9,3 : 1 | 4,6 : 1 ✅ |
| `VIZ03` | 7,4 : 1 ✅ | 12,6 : 1 | 5,5 : 1 ✅ |

**Tri z piatich neprejdú bez scrimu**, `REM_ZENA` neprejde ani v spodnej štvrtine — teda ani tam, kde plugin kotví čierny pás, logo a legal. To je presne prípad, na ktorý je P0-16 a fixný faktor stmavenia 0,64 naň nestačí.

`REM_ZENA` je zároveň ideálny testovací vstup pre harness: svetlý pastel bez tmavého miesta, kam by sa dal text schovať.

## 4. Čo z toho vyplýva

1. **Otestovať P0-16 na `REM_ZENA` a `VIZ03-VOLVO`** — sú to najhoršie prípady, aké zatiaľ máme.
2. **Vypýtať od Surďa verzie bez napáleného claimu** pre tie tri KV, inak nie sú použiteľné pre RSA/DemandGen.
3. **Focal point do UI (P1-6)** — pri štvorcových zdrojoch to nie je nice-to-have.
4. Overiť, či `VIZ03` (ruka s kartou zdola) prežije orez na výšku — subjekt je v strede, ale kompozícia visí na ruke, ktorá vchádza zľava dole.
