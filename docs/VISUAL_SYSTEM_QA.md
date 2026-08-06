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
- Text blocks are measured after real Figma wrapping and then stacked from their actual height.

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
