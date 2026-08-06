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

function inferProfile(format) {
  const id = String(format.id || "").toLowerCase();
  const role = String(format.role || "").toLowerCase();
  const channel = String(format.channel || "").toLowerCase();
  if (format.rules && format.rules.logoOnly) return "logo_only";
  if (format.rules && format.rules.noText) return role === "native" ? "native_clean" : "clean_image";
  if (format.rules && format.rules.headlineOnly) return "headline_only";
  if (role === "clean_image") return "clean_image";
  if (role === "logo_only") return "logo_only";
  if (role === "meta_full") return "meta_full";
  if (role === "full_creative") return "full_creative";
  if (role === "headline_only") return "headline_only";
  if (role === "native") return "native_clean";
  if (id.indexOf("google_rsa") !== -1) return "clean_image";
  if (id.indexOf("google_logo") !== -1 || id.indexOf("demandgen_logo") !== -1) return "logo_only";
  if (id.indexOf("pmax") !== -1 || channel.indexOf("pmax") !== -1) return "headline_only";
  if (id.indexOf("meta_img") !== -1 || channel === "meta") return "meta_full";
  if (id.indexOf("demandgen") !== -1 || channel.indexOf("demandgen") !== -1) return "full_creative";
  if (id.indexOf("engerio") !== -1) return "native_clean";
  return "publisher_branding";
}

function getCreativeRule(format) {
  if (!format) return null;
  const profileId = format.creativeProfile || inferProfile(format);
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
