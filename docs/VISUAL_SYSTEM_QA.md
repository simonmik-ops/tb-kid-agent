# Visual system QA — v1.5.1

Sources checked:

- `Adform_dievca.psd` — native layer geometry and Photoshop text engine values;
- generated Figma pages `Meta`, `Clean assets`, and `Performance` in file `jpAb03NqZJ6xYHKRAIcd0p`;
- the InvestQ master-safe measurements recorded in the project.

## Typography

- Family: Tatra banka Sans; Bold for headline/CTA, Regular for subheadline and disclosure.
- Headline line height: 100%; tracking: -2.5% (PSD uses tracking -25).
- Subheadline line height: 110%; tracking: -1.5%.
- Optical headline scale: 51 px at 1200×628, 67 px at 1200×1200, 65 px at 1080×1920.
- Subheadline scale: 52% of headline.
- Text block spacing is derived from text size, not a percentage of the canvas height.

## Colour and readability

- CTA: `#0047F8` with white Bold label.
- Image-derived brand panel colour is retained.
- Readability scrim is luminance-aware but limited to 46–64%; default 58%.
- AI disclosure is white Regular text at 80% opacity, without a black backing pill.

## Brand geometry

- Logo is capped optically by format family. In 1080×1920 it is 151 px high (previously 216 px).
- CTA height is capped at 64 px in master-safe output.
- Exact Adform sizes use the format-specific PSD coordinate tables, not the universal scale.

## Known source constraint

The PSD contains separate masked subject smart objects. A single flat KV can match crop,
typography and composition, but cannot reproduce those non-rectangular subject masks pixel
for pixel. Exact reproduction requires a transparent subject asset or segmentation.

## Mandatory post-render QA

Every newly generated Figma frame is checked after all production layers are
created. The result is saved as `tbQaStatus` and `tbQaIssues` plugin metadata.
The generation summary reports the number of PASS/FAIL frames; failed frames
are also listed on the `Validation report` page.

The runtime audit checks:

- required headline, subheadline, CTA, and logo presence;
- Tatra banka Sans availability (Inter fallback is a QA failure);
- content overflow and collisions;
- typography scale tolerance;
- effects/shadows and frame clipping;
- exact Adform headline, CTA, and logo geometry against the PSD tables.

## Golden-image pixel comparison

Canonical QA renders are compared with approved PNG baselines using
`pixelmatch`. A changed frame fails when its dimensions differ or more than
1.5% of pixels exceed the configured per-pixel threshold.

1. Export the canonical test frames from Figma as PNG at 1× into
   `tests/visual-actual/`.
2. Run `npm run visual:compare`.
3. Inspect failed overlays in `artifacts/visual-diff/`.

The repository contains four native Adform baselines extracted directly from
`Adform_dievca.psd`. Surď master baselines must be added only from approved
reference frames; the comparator intentionally fails when a listed baseline or
actual render is missing.
