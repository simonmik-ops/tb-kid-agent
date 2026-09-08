# TB — Generátor online formátov

Figma plugin, ktorý z jedného key visualu vytvára digitálne reklamné formáty podľa mediálneho plánu, kanála a pravidiel Tatra banky.

## Zajtrajšie demo

1. Vo Figme otvor **Plugins → Development → Import plugin from manifest…**.
2. Vyber `plugin/manifest.json` z tohto repozitára.
3. Spusť **TB — Generátor online formátov**.
4. Nahraj hlavný KV a logo. Pre najlepší výsledok pridaj aj samostatný portrait a landscape KV.
5. Vyplň názov zákazky, headline a prípadne CTA.
6. Nechaj **Zobraziť safe zóny** vypnuté, ak ide o prezentáciu.
7. Vyber iba typy výstupov, ktoré chceš ukázať. Pri Exceli skontroluj ponúknutý kanál pri každom nejednoznačnom rozmere.
8. Klikni **Generovať vo Figme**.

Na prezentáciu odporúčame ukázať menšiu, kontrolovanú sadu: Meta 1:1, Google RSA landscape, PMax landscape, Demand Gen square a jeden Adform formát.

## Lokálny vývoj

```bash
npm ci
npm test
npm start
```

Server poskytuje:

- `GET /health` — verzia a dostupnosť,
- `GET /formats` — normalizovaný katalóg 143 formátov,
- `GET /template-groups` — skupiny univerzálnych šablón,
- `POST /analyze` — analýza KV a plánovanie layoutov.

## Dôležité pravidlá

- Statické Meta 4:5 používa `1200×1628` podľa mediálneho plánu.
- Google RSA je čistý obrázok bez textu a loga.
- PMax obsahuje iba headline; CTA a logo dopĺňa systém.
- Meta obsahuje headline a logo, bez vykresleného CTA.
- Demand Gen je kompletná kreatíva.
- Google Logo je transparentný logo-only výstup.
- Nejednoznačný rozmer z Excelu musí mať potvrdený kanál.

## Testy

`npm test` overuje pravidlá kampaní, univerzálne šablóny, správanie P0-9 a normalizáciu všetkých 143 formátov.
