// Explicit creative rules. Media-plan counts and dimensions stay in formats.js;
// this file defines what is actually baked into each generated image.

const BRAND_PROFILES = {
  tb_campaign: {
    fontFamily: "Tatra banka Sans",
    masterWidth: 4000,
    masterHeight: 4000,
    protectedCorePct: 0.5,
    logoMinPx: 50,
    aiDisclosureOpacity: 0.8
  }
};

const CREATIVE_PROFILES = {
  clean_image: {
    layoutType: "clean_image",
    elements: {
      headline: false, subheadline: false, cta: false,
      logo: false, legal: false, badge: false, aiDisclosure: false
    }
  },
  meta_full: {
    layoutType: "master_safe",
    elements: {
      headline: true, subheadline: true, cta: false,
      logo: true, legal: false, badge: false, aiDisclosure: true
    }
  },
  full_creative: {
    layoutType: "master_safe",
    elements: {
      headline: true, subheadline: true, cta: true,
      logo: true, legal: true, badge: true, aiDisclosure: true
    }
  },
  headline_only: {
    layoutType: "master_safe",
    elements: {
      headline: true, subheadline: false, cta: false,
      logo: false, legal: false, badge: false, aiDisclosure: true
    }
  },
  logo_only: {
    layoutType: "logo_only",
    elements: {
      headline: false, subheadline: false, cta: false,
      logo: true, legal: false, badge: false, aiDisclosure: false
    }
  },
  publisher_branding: {
    layoutType: null,
    elements: {
      headline: true, subheadline: false, cta: true,
      logo: true, legal: false, badge: false, aiDisclosure: true
    }
  },
  native_clean: {
    layoutType: "native_center",
    elements: {
      headline: false, subheadline: false, cta: false,
      logo: false, legal: false, badge: false, aiDisclosure: false
    }
  }
};

function kkVisaProfile(format) {
  const id = format.id || "";
  if (id.indexOf("kkv_google_rsa_") === 0) return "clean_image";
  if (id.indexOf("kkv_google_logo_") === 0) return "logo_only";
  if (id.indexOf("kkv_meta_") === 0) return "meta_full";
  if (id.indexOf("kkv_demandgen_") === 0) return "full_creative";
  if (id.indexOf("kkv_pmax_") === 0) return "headline_only";
  if (id === "kkv_engerio_native") return "native_clean";
  return "publisher_branding";
}

function getCreativeRule(format) {
  if (!format) return null;
  const profileId = format.creativeProfile ||
    (format.campaign === "kkvisa" ? kkVisaProfile(format) : null);
  if (!profileId || !CREATIVE_PROFILES[profileId]) return null;
  return {
    id: profileId,
    brand: BRAND_PROFILES.tb_campaign,
    ...CREATIVE_PROFILES[profileId]
  };
}

module.exports = {
  BRAND_PROFILES,
  CREATIVE_PROFILES,
  getCreativeRule
};
