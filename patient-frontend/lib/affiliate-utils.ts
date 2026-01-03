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
 * Development:
 * - affiliate.brand.localhost:3000 (3 parts) -> affiliateSlug: "affiliate", brandSlug: "brand" (IS AFFILIATE)
 * - brand.localhost:3000 (2 parts) -> NO AFFILIATE (brand direct)
 * - localhost:3000 (1 part) -> NO AFFILIATE
 * Production:
 * - affiliate.brand.fusehealth.com -> affiliateSlug: "affiliate", brandSlug: "brand"
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

  console.log('🔍 Affiliate domain analysis:', { hostname, parts, partsLength: parts.length });

  // Development: Check if 'localhost' appears
  const localhostIndex = parts.indexOf('localhost');
  const isDevelopment = localhostIndex !== -1;

  // Production: checktwo.limitless.fusehealth.com
  const isProduction = !isDevelopment && parts.length >= 4;

  let affiliateSlug: string | null = null;
  let brandSlug: string | null = null;
  let hasAffiliateSubdomain = false;

  if (isDevelopment && localhostIndex >= 1) {
    // Development: Only 3 parts pattern is affiliate
    if (parts.length === 3 && localhostIndex === 2) {
      // Pattern: affiliate.brand.localhost (3 parts = AFFILIATE)
      affiliateSlug = parts[0];
      brandSlug = parts[1];
      hasAffiliateSubdomain = true;
    }
    // Pattern: brand.localhost (2 parts = BRAND, not affiliate)
    // Pattern: localhost (1 part = BRAND, not affiliate)
    // These cases: hasAffiliateSubdomain stays false
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
