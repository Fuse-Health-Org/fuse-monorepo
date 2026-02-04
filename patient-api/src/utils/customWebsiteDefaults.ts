/**
 * Default values for CustomWebsite creation and resets
 */

export interface FooterCategory {
  name: string;
  visible: boolean;
  urls: Array<{
    label: string;
    url: string;
  }>;
}

export interface SocialMediaLinks {
  instagram: { enabled: boolean; url: string };
  facebook: { enabled: boolean; url: string };
  twitter: { enabled: boolean; url: string };
  tiktok: { enabled: boolean; url: string };
  youtube: { enabled: boolean; url: string };
}

export const DEFAULT_FOOTER_CATEGORIES: FooterCategory[] = [
  {
    name: "NAVIGATION LINKS",
    visible: true,
    urls: [
      { label: "Bundles", url: "/#bundles" },
      { label: "Programs", url: "/#programs" },
      { label: "Performance", url: "/#performance" },
      { label: "Weight Loss", url: "/#weightloss" },
      { label: "Wellness", url: "/#wellness" }
    ]
  },
  { name: "Section 2", visible: false, urls: [] },
  { name: "Section 3", visible: false, urls: [] },
  { name: "Section 4", visible: false, urls: [] }
];

export const DEFAULT_SOCIAL_MEDIA_LINKS: SocialMediaLinks = {
  instagram: { enabled: true, url: "" },
  facebook: { enabled: true, url: "" },
  twitter: { enabled: true, url: "" },
  tiktok: { enabled: true, url: "" },
  youtube: { enabled: true, url: "" }
};

export const DEFAULT_CUSTOM_WEBSITE_VALUES = {
  portalTitle: "Welcome to Our Portal",
  portalDescription: "Your trusted healthcare partner. Browse our products and services below.",
  primaryColor: "#000000",
  fontFamily: "Playfair Display",
  logo: "",
  heroImageUrl: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1920&q=80",
  heroTitle: "Your Daily Health, Simplified",
  heroSubtitle: "All-in-one nutritional support in one simple drink",
  isActive: true,
  footerColor: "#000000",
  footerCategories: DEFAULT_FOOTER_CATEGORIES,
  section1: "NAVIGATION LINKS",
  section2: null,
  section3: null,
  section4: null,
  socialMediaSection: "SOCIAL MEDIA",
  useDefaultDisclaimer: true,
  footerDisclaimer: null,
  socialMediaLinks: DEFAULT_SOCIAL_MEDIA_LINKS
};

/**
 * Get default values for creating a new CustomWebsite
 */
export function getDefaultCustomWebsiteValues(clinicId: string) {
  return {
    clinicId,
    ...DEFAULT_CUSTOM_WEBSITE_VALUES
  };
}

/**
 * Get default footer section values for reset
 */
export function getDefaultFooterValues() {
  return {
    footerColor: DEFAULT_CUSTOM_WEBSITE_VALUES.footerColor,
    footerCategories: DEFAULT_FOOTER_CATEGORIES,
    section1: DEFAULT_CUSTOM_WEBSITE_VALUES.section1,
    section2: DEFAULT_CUSTOM_WEBSITE_VALUES.section2,
    section3: DEFAULT_CUSTOM_WEBSITE_VALUES.section3,
    section4: DEFAULT_CUSTOM_WEBSITE_VALUES.section4,
    useDefaultDisclaimer: DEFAULT_CUSTOM_WEBSITE_VALUES.useDefaultDisclaimer,
    footerDisclaimer: DEFAULT_CUSTOM_WEBSITE_VALUES.footerDisclaimer
  };
}

/**
 * Get default social media section values for reset
 */
export function getDefaultSocialMediaValues() {
  return {
    socialMediaSection: DEFAULT_CUSTOM_WEBSITE_VALUES.socialMediaSection,
    socialMediaLinks: DEFAULT_SOCIAL_MEDIA_LINKS
  };
}
