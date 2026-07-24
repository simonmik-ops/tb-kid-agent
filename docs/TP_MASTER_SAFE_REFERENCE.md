# TP master-safe reference

Source: internal presentation `TB_priklady-vizualov-do-TP`.

## Master construction

- Prepare one square master visual at 4000 × 4000 px.
- Keep every important subject, product and key graphic inside the centered
  2000 × 2000 px core.
- The outer 1000 px on every side is an extension zone. It may contain
  continuing background graphics or a smooth transition to one colour, but no
  indispensable content.

## Format families

The generator adapts that master into three composition families:

- `square`: full-bleed central core, copy and CTA in the lower part;
- `portrait`: protected central subject, copy and CTA below the focal area;
- `wide`: master visual on the left, copy, CTA and bank lockup on the right.

Publisher-specific safe zones and campaign rules are applied after the master
composition. PSD files remain the reference for brand assets, masks, typography
and exact component styling.

## Prototype behaviour

The plugin UI enables `masterSafeMode` by default. When guides are enabled, the
mapped 2000 × 2000 source core is shown as a green dashed guide. It is a review
aid and must not be exported.

The mode can be disabled temporarily to compare the older PSD-coordinate
prototype, but it is not the recommended production workflow.
