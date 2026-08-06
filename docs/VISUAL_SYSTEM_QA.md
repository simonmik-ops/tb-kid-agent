# Visual system QA — v1.6.0

Sources checked:

- `Adform_dievca.psd` — native layer geometry and Photoshop text engine values;
- generated Figma pages `Meta`, `Clean assets`, and `Performance` in file `jpAb03NqZJ6xYHKRAIcd0p`;
- the InvestQ master-safe measurements recorded in the project.

## Typography

- Family: Tatra banka Sans; Bold for headline/CTA, Regular for subheadline and disclosure.
- Headline line height: 100%; tracking: -2.5% (PSD uses tracking -25).
- Subheadline line height: 110%; tracking: -1.5%.
- Optical headline scale: 51 px at 1200×628, 67 px at 1200×1200, 65 px at 1080×1920, and 89 px at 1920×1080. Wide formats keep the same 8.2% height ratio instead of stopping at the old 52 px cap.
- Subheadline scale: 52% of headline.
- Text block spacing is derived from text size, not a percentage of the canvas height.

## Colour and readability

- CTA: `#0047F8` with white Bold label.
- Image-derived brand panel colour is retained.
- Readability scrim is luminance-aware but limited to 46–64%; default 58%.
- AI disclosure is white Regular text at 80% opacity, without a black backing pill.
- A square master reused in a wide output is anchored to the left image zone;
  its continuation uses five measured colour stops from the master's left edge.
  This replaces the old centred image with two unrelated colour bars.
- A square master reused in a portrait/4:5 output remains full-width at the top.
  The lower content panel starts as a transparent overlay inside the bottom of
  the image and is fully opaque by the image boundary, avoiding both a face-only
  cover crop and a hard horizontal band.
- Figma-export padding and selection outlines are removed before colour sampling
  and layout adaptation.

## Brand geometry

- Logo is capped optically by format family. In 1080×1920 it is 151 px high (previously 216 px).
- In master-safe landscape formats, the sampled visual colour becomes fully opaque exactly at the image boundary, preventing a vertical seam between the KV and its colour extension.
- A one-line headline is bottom-anchored to the subheadline; unused multi-line reserve no longer becomes a large visual gap.
- CTA height is capped at 64 px in master-safe output.
- Exact Adform sizes use the format-specific PSD coordinate tables, not the universal scale.

## Known source constraint

The PSD contains separate masked subject smart objects. A single flat KV can match crop,
typography and composition, but cannot reproduce those non-rectangular subject masks pixel
for pixel. Exact reproduction requires a transparent subject asset or segmentation.

## Mandatory post-render QA

Every newly generated Figma frame is checked after all production layers are
created. The result is saved as `tbQaStatus` and `tbQaIssues` plugin metadata.
The generation summary reports runtime PASS/FAIL frames; failed frames are also
listed on the `Validation report` page. Runtime PASS is not campaign-specific
visual approval: every new campaign is marked `REQUIRED_FOR_NEW_CAMPAIGN` and
must still pass a native-size PNG comparison.

The runtime audit checks:

- required headline, subheadline, CTA, and logo presence;
- Tatra banka Sans availability (Inter fallback is a QA failure);
- content overflow and collisions;
- typography scale tolerance;
- effects/shadows and frame clipping;
- exact Adform headline, CTA, and logo geometry against the PSD tables.
- protected-master usage whenever the requested orientation asset is missing;
- sampled multi-stop colour continuation on wide formats;
- explicit campaign/version/QA metadata on every generated frame.

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
