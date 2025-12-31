// Utility functions for clinic subdomain handling
import { apiCall } from './api';

export interface ClinicDomainInfo {
  hasClinicSubdomain: boolean;
  clinicSlug: string | null;
  affiliateSlug?: string | null; // For affiliate detection (check.test.localhost -> affiliateSlug: "check")
  isDevelopment: boolean;
  isProduction: boolean;
}

/**
 * Extracts clinic slug from current domain
 * 
 * This function first checks for custom/vanity domains via API call,
 * then falls back to subdomain detection if no custom domain is found.
 * 
 * Vanity domain examples:
 * - myclinic.com -> checks API for custom domain -> returns slug if configured
 * 
 * Subdomain examples (fallback):
 * - saboia.xyz.localhost:3000 -> slug: "saboia.xyz"
 * - g-health.localhost:3000 -> slug: "g-health"  
 * - limitless.health.localhost:3000 -> no slug (special case)
 * - localhost:3000 -> no slug
 * 
 * Production examples:
 * - app.fuse.health -> slug: "fuse.health"
 * - app.hims.com -> slug: "hims.com"
 * - app.limitless.health -> no slug (special case)
 * - app.anydomain.anyextension -> slug: "anydomain.anyextension"
 * - fuse.health -> no slug (direct domain access)
 */
export async function extractClinicSlugFromDomain(): Promise<ClinicDomainInfo> {
  if (typeof window === 'undefined') {
    return {
      hasClinicSubdomain: false,
      clinicSlug: null,
      isDevelopment: false,
      isProduction: false
    };
  }

  const hostname = window.location.hostname;
  const parts = hostname.split('.');

  console.log('🔍 Domain analysis:', { hostname, parts });

  // FIRST: Try to detect custom domain (vanity domain)
  // Check if hostname is NOT a .fuse.health subdomain, NOT a .fusehealthstaging.xyz subdomain, NOT localhost and NOT bare localhost
  // Skip custom domain check for localhost and localhost with port (e.g., localhost:3000)
  const isLocalhost = hostname === 'localhost' || hostname.startsWith('127.0.0.1');

  if (!hostname.endsWith('.fuse.health') && !hostname.endsWith('.fusehealth.com') && !hostname.endsWith('.fusehealthstaging.xyz') && !hostname.includes('.localhost') && !isLocalhost) {
    try {
      console.log('🔍 Checking for custom domain:', hostname);
      const customDomainResult = await apiCall('/clinic/by-custom-domain', {
        method: 'POST',
        body: JSON.stringify({ domain: hostname })
      });

      if (customDomainResult.success && customDomainResult.data?.slug) {
        const clinicSlug = customDomainResult.data.slug;
        console.log('✅ Found clinic via custom domain:', clinicSlug);

        return {
          hasClinicSubdomain: true,
          clinicSlug,
          isDevelopment: false,
          isProduction: true
        };
      } else {
        console.log('[clinic-utils] custom-domain lookup returned no slug, falling back to subdomain detection');
      }
    } catch (error) {
      console.error('❌ Error fetching clinic by custom domain, falling back to subdomain detection:', error);
    }
  } else if (isLocalhost) {
    console.log('🔍 Skipping custom domain check for bare localhost');
  }

  // FALLBACK: Subdomain detection logic

  // Development: Check if 'localhost' appears in any position
  const localhostIndex = parts.indexOf('localhost');
  const isDevelopment = localhostIndex !== -1 && parts[0] !== 'www';

  // Production: app.fuse.health, app.hims.com, app.anydomain.anyextension
  const isProduction = parts.length >= 3 && parts[0] === 'app';

  let clinicSlug: string | null = null;
  let hasClinicSubdomain = false;

  if (isDevelopment && localhostIndex > 0) {
    // Development: extract slug(s) before 'localhost'
    const partsBeforeLocalhost = parts.slice(0, localhostIndex);
    
    if (partsBeforeLocalhost.length === 2) {
      // Affiliate subdomain: check.test.localhost -> affiliateSlug: "check", brandSlug: "test"
      const affiliateSlug = partsBeforeLocalhost[0];
      const brandSlug = partsBeforeLocalhost[1];
      
      console.log('👤 Detected affiliate subdomain (dev):', { 
        affiliateSlug, 
        brandSlug,
      });
      
      // SECURITY: Validate that this affiliate really belongs to this brand
      try {
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await fetch(`${API_BASE}/public/affiliate/validate-access`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ affiliateSlug, brandSlug }),
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
          // Validation passed - use the brand clinic slug and return affiliate slug
          clinicSlug = data.data.brandClinic.slug;
          hasClinicSubdomain = true;
          console.log('✅ Affiliate access validated (dev):', { 
            affiliateSlug,
            brandSlug: data.data.brandClinic.slug,
          });
          
          // Return early with affiliate slug
          return {
            hasClinicSubdomain: true,
            clinicSlug: data.data.brandClinic.slug,
            affiliateSlug: affiliateSlug, // Include affiliate slug for product fetching
            isDevelopment: true,
            isProduction: false
          };
        } else {
          // Validation failed - invalid affiliate or doesn't belong to this brand
          console.error('❌ Affiliate validation failed (dev):', data.message);
          clinicSlug = null;
          hasClinicSubdomain = false;
        }
      } catch (error) {
        console.error('❌ Error validating affiliate (dev):', error);
        clinicSlug = null;
        hasClinicSubdomain = false;
      }
    } else if (partsBeforeLocalhost.length === 1) {
      // Regular clinic subdomain: limitless.localhost -> slug: "limitless"
      clinicSlug = partsBeforeLocalhost[0];
      hasClinicSubdomain = true;
    } else if (partsBeforeLocalhost.length > 2) {
      // More complex subdomain - join all parts
      clinicSlug = partsBeforeLocalhost.join('.');
      hasClinicSubdomain = true;
    }
  } else if (isProduction) {
    // Production: extract everything after 'app.' (fuse.health from app.fuse.health)
    clinicSlug = parts.slice(1).join('.');
    hasClinicSubdomain = true;
  } else if (hostname.endsWith('.fuse.health') && parts.length >= 3 && parts[0] !== 'app' && parts[0] !== 'www') {
    // Production clinic subdomain: <clinic>.fuse.health
    clinicSlug = parts[0];
    hasClinicSubdomain = true;
  } else if (hostname.endsWith('.fusehealth.com') && parts.length >= 3 && parts[0] !== 'app' && parts[0] !== 'www') {
    // Production clinic subdomain: <clinic>.fusehealth.com OR affiliate subdomain: <affiliate>.<brand>.fusehealth.com
    if (parts.length === 4) {
      // Affiliate subdomain: check.test.fusehealth.com
      // parts[0] = affiliate slug, parts[1] = brand slug
      const affiliateSlug = parts[0];
      const brandSlug = parts[1];
      
      console.log('👤 Detected affiliate subdomain (prod fusehealth.com):', { 
        affiliateSlug, 
        brandSlug
      });
      
      // SECURITY: Validate that this affiliate really belongs to this brand
      try {
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await fetch(`${API_BASE}/public/affiliate/validate-access`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ affiliateSlug, brandSlug }),
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
          // Validation passed - use the brand clinic slug and return affiliate slug
          clinicSlug = data.data.brandClinic.slug;
          hasClinicSubdomain = true;
          console.log('✅ Affiliate access validated (prod fusehealth.com):', { 
            affiliateSlug,
            brandSlug: data.data.brandClinic.slug,
          });
          
          // Return early with affiliate slug
          return {
            hasClinicSubdomain: true,
            clinicSlug: data.data.brandClinic.slug,
            affiliateSlug: affiliateSlug, // Include affiliate slug for product fetching
            isDevelopment: false,
            isProduction: true
          };
        } else {
          // Validation failed - invalid affiliate or doesn't belong to this brand
          console.error('❌ Affiliate validation failed (prod fusehealth.com):', data.message);
          clinicSlug = null;
          hasClinicSubdomain = false;
        }
      } catch (error) {
        console.error('❌ Error validating affiliate (prod fusehealth.com):', error);
        clinicSlug = null;
        hasClinicSubdomain = false;
      }
    } else if (parts.length === 3) {
      // Regular clinic subdomain: limitless.fusehealth.com -> slug: "limitless"
      clinicSlug = parts[0];
      hasClinicSubdomain = true;
    }
  } else if (hostname.endsWith('.fusehealthstaging.xyz') && parts.length >= 3 && parts[0] !== 'app' && parts[0] !== 'www') {
    // Staging clinic subdomain: <clinic>.fusehealthstaging.xyz OR affiliate subdomain: <affiliate>.<brand>.fusehealthstaging.xyz
    if (parts.length === 4) {
      // Affiliate subdomain: admin.checkhealth.fusehealthstaging.xyz
      // parts[0] = affiliate slug, parts[1] = brand slug
      const affiliateSlug = parts[0];
      const brandSlug = parts[1];
      
      console.log('👤 Detected affiliate subdomain (staging):', { 
        affiliateSlug, 
        brandSlug
      });
      
      // SECURITY: Validate that this affiliate really belongs to this brand
      try {
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await fetch(`${API_BASE}/public/affiliate/validate-access`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ affiliateSlug, brandSlug }),
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
          // Validation passed - use the brand clinic slug and return affiliate slug
          clinicSlug = data.data.brandClinic.slug;
          hasClinicSubdomain = true;
          console.log('✅ Affiliate access validated (staging):', { 
            affiliateSlug,
            brandSlug: data.data.brandClinic.slug,
          });
          
          // Return early with affiliate slug
          return {
            hasClinicSubdomain: true,
            clinicSlug: data.data.brandClinic.slug,
            affiliateSlug: affiliateSlug, // Include affiliate slug for product fetching
            isDevelopment: false,
            isProduction: false
          };
        } else {
          // Validation failed - invalid affiliate or doesn't belong to this brand
          console.error('❌ Affiliate validation failed (staging):', data.message);
          clinicSlug = null;
          hasClinicSubdomain = false;
        }
      } catch (error) {
        console.error('❌ Error validating affiliate (staging):', error);
        clinicSlug = null;
        hasClinicSubdomain = false;
      }
    } else if (parts.length === 3) {
      // Regular clinic subdomain: checkhealth.fusehealthstaging.xyz -> slug: "checkhealth"
      clinicSlug = parts[0];
      hasClinicSubdomain = true;
    }
  }

  // Special case: limitless.health should act as the normal website (no clinic)
  if (clinicSlug === 'fuse.health' || clinicSlug === 'fusehealth.com') {
    clinicSlug = null;
    hasClinicSubdomain = false;
  }

  const result = {
    hasClinicSubdomain,
    clinicSlug,
    isDevelopment,
    isProduction
  };

  console.log('🏥 Clinic domain extraction result:', result);
  return result;
}