# Adform PSD reference

Source: `Adform_dievca.psd` (1614 × 600 px, four artboards).

This document records the design decisions extracted from the PSD so that the
Figma generator can reproduce them consistently without requiring colleagues
to rebuild each banner manually.

## Shared layer model

Each artboard contains:

- a key visual/background composite;
- a separate subject smart object in three of the four artboards;
- a masked colour or gradient treatment for text readability;
- the `Myslite na seba` slogan mark;
- a mixed-weight headline;
- an optional alternate hidden headline;
- a legal disclaimer;
- a CTA smart object;
- a promotional badge smart object;
- a square Tatra banka lockup;
- an `AI generované` disclosure at 80% opacity.

The source typography uses Tatrabanka Sans Light, Regular and Bold. Headline
tracking is `-25` in Photoshop and the leading is approximately equal to the
font size.

## Per-format composition

### 300 × 600

- full-bleed image;
- dark readability gradient in the lower half;
- slogan top-left;
- badge around the middle-left;
- headline and legal copy in the lower third;
- CTA bottom-left;
- square bank lockup bottom-right.

### 160 × 600

- image-led upper section;
- solid dark lower panel;
- centered slogan near the top;
- badge top-right;
- narrow multiline headline through the middle;
- CTA above the bank lockup;
- AI disclosure and legal copy at the bottom.

### 300 × 250

- full-bleed image with a dark left-side readability treatment;
- slogan top-left;
- headline and legal copy left;
- badge right-center;
- CTA bottom-left;
- square bank lockup bottom-right.

### 970 × 250

- key visual restricted to the left 425 px;
- solid blue-grey brand panel on the right;
- badge top-left over the image;
- headline in the right panel;
- slogan top-right;
- CTA, legal copy and square lockup along the bottom;
- AI disclosure bottom-left.

## Masking constraints

The PSD uses a separate `VIZ_DIEVCA.png` smart object and masks for subject
placement in the 160 × 600, 300 × 250 and 970 × 250 artboards. The 300 × 600
artboard also uses a generative-fill smart object to extend the background.

A flat JPEG/PNG cannot reproduce those non-rectangular masks exactly. The
current prototype therefore uses protected rectangular crops and format-
specific panels. Exact subject cut-outs will require either:

1. an optional transparent subject PNG input; or
2. a server-side segmentation/background-removal step.

Anthropic image analysis can identify a focal point but does not return a
pixel-level subject mask.

## Automation rule

Users provide master content once. Each format template decides which elements
are enabled and where they are placed. Empty optional fields are not rendered.
Brand positioning, CTA styling, legal-copy placement and disclosure placement
are owned by the template rather than by the user.
