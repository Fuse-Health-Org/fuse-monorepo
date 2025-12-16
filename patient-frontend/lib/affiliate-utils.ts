// Utility functions for affiliate subdomain handling

export interface AffiliateDomainInfo {
  hasAffiliateSubdomain: boolean;
  affiliateSlug: string | null;
  brandSlug: string | null;
  isDevelopment: boolean;
  isProduction: boolean;
}

/**
 * Extracts affiliate slug from current domain
 * 
 * Examples:
 * - checktwo.limitless.fusehealth.com -> affiliateSlug: "checktwo", brandSlug: "limitless"
 * - checktwo.limitless.localhost:3000 -> affiliateSlug: "checktwo", brandSlug: "limitless"
 * - localhost:3000 -> no affiliate
 */
export async function extractAffiliateSlugFromDomain(): Promise<AffiliateDomainInfo> {
  if (typeof window === 'undefined') {
    return {
      hasAffiliateSubdomain: false,
      affiliateSlug: null,
      brandSlug: null,
      isDevelopment: false,
      isProduction: false
    };
  }

  const hostname = window.location.hostname;
  const parts = hostname.split('.');

  console.log('🔍 Affiliate domain analysis:', { hostname, parts });

  // Development: Check if 'localhost' appears
  const localhostIndex = parts.indexOf('localhost');
  const isDevelopment = localhostIndex !== -1;

  // Production: checktwo.limitless.fusehealth.com
  const isProduction = !isDevelopment && parts.length >= 4;

  let affiliateSlug: string | null = null;
  let brandSlug: string | null = null;
  let hasAffiliateSubdomain = false;

  if (isDevelopment && localhostIndex >= 2) {
    // Development: checktwo.limitless.localhost -> affiliateSlug: "checktwo", brandSlug: "limitless"
    if (parts.length >= 3 && localhostIndex >= 2) {
      affiliateSlug = parts[0];
      brandSlug = parts[1];
      hasAffiliateSubdomain = true;
    }
  } else if (isProduction && parts.length >= 4) {
    // Production: checktwo.limitless.fusehealth.com
    // Check if it matches pattern: affiliate.brand.domain.extension
    if (hostname.endsWith('.fusehealth.com') || hostname.endsWith('.fuse.health')) {
      affiliateSlug = parts[0];
      brandSlug = parts[1];
      hasAffiliateSubdomain = true;
    }
  }

  const result = {
    hasAffiliateSubdomain,
    affiliateSlug,
    brandSlug,
    isDevelopment,
    isProduction
  };

  console.log('👤 Affiliate domain extraction result:', result);
  return result;
}
