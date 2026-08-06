// Universal production templates.
// Historical campaigns in formats.js remain reference material only.

const TEMPLATE_GROUPS = [
  {
    id: "meta_full",
    label: "Meta – hotová kreatíva",
    description: "Headline, subheadline a logo. CTA doplní platforma.",
    formats: [
      { id: "tpl_meta_1x1", name: "Meta image 1:1", channel: "Meta", width: 1200, height: 1200, ratio: "1:1" },
      { id: "tpl_meta_4x5", name: "Meta image 4:5", channel: "Meta", width: 1200, height: 1628, ratio: "4:5" },
      { id: "tpl_meta_9x16", name: "Meta image 9:16", channel: "Meta", width: 1080, height: 1920, ratio: "9:16" }
    ]
  },
  {
    id: "clean_image",
    label: "Čisté image assets",
    description: "Bez textu, CTA a loga – napr. Google responsive assets.",
    formats: [
      { id: "tpl_clean_landscape", name: "Clean image landscape", channel: "Clean assets", width: 1200, height: 628, ratio: "1.91:1" },
      { id: "tpl_clean_square", name: "Clean image square", channel: "Clean assets", width: 1200, height: 1200, ratio: "1:1" },
      { id: "tpl_clean_portrait", name: "Google RSA story", channel: "Clean assets", width: 900, height: 1600, ratio: "9:16" }
    ]
  },
  {
    id: "full_creative",
    label: "Kompletná performance kreatíva",
    description: "Headline, subheadline, CTA a logo.",
    formats: [
      { id: "tpl_full_landscape", name: "Full creative landscape", channel: "Performance", width: 1200, height: 628, ratio: "1.91:1" },
      { id: "tpl_full_square", name: "Full creative square", channel: "Performance", width: 1200, height: 1200, ratio: "1:1" },
      { id: "tpl_full_portrait", name: "Full creative portrait", channel: "Performance", width: 960, height: 1200, ratio: "4:5" }
    ]
  },
  {
    id: "headline_only",
    label: "Headline-only assets",
    description: "Headline je súčasťou obrázka; CTA a logo doplní platforma.",
    formats: [
      { id: "tpl_headline_landscape", name: "Headline-only landscape", channel: "Headline assets", width: 1200, height: 628, ratio: "1.91:1" },
      { id: "tpl_headline_square", name: "Headline-only square", channel: "Headline assets", width: 1200, height: 1200, ratio: "1:1" },
      { id: "tpl_headline_portrait", name: "Headline-only portrait", channel: "Headline assets", width: 960, height: 1200, ratio: "4:5" }
    ]
  },
  {
    id: "native_clean",
    label: "Native – čistý vizuál",
    description: "Centrovaný obrázok bez textu a loga.",
    formats: [
      { id: "tpl_native_3x2", name: "Native image 3:2", channel: "Native", width: 600, height: 400, ratio: "3:2", noLogo: true }
    ]
  }
];

const TEMPLATE_FORMATS = TEMPLATE_GROUPS.flatMap(group =>
  group.formats.map(format => ({
    ...format,
    templateGroup: group.id,
    creativeProfile: group.id,
    type: ["production"],
    count: 1,
    safeZones: { top: 0, bottom: 0 },
    notes: group.description
  }))
);

function getRequestedFormats(groupIds) {
  const requested = new Set(Array.isArray(groupIds) ? groupIds : []);
  return TEMPLATE_FORMATS.filter(format => requested.has(format.templateGroup));
}

module.exports = { TEMPLATE_GROUPS, TEMPLATE_FORMATS, getRequestedFormats };
