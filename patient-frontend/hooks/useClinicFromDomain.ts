import React from 'react';
import { apiCall } from '../lib/api';
import { extractClinicSlugFromDomain, getDashboardPrefix, buildDashboardRoute } from '../lib/clinic-utils';

export interface Clinic {
  id: string;
  name: string;
  slug: string;
  logo: string;
  defaultFormColor?: string;
  patientPortalDashboardFormat?: string;
}

export interface UseClinicFromDomainResult {
  clinic: Clinic | null;
  hasClinicSubdomain: boolean;
  isLoading: boolean;
  error: string | null;
  clinicSlug: string | null;
}

/**
 * Custom hook to automatically detect and load clinic data from the current domain
 * 
 * Examples:
 * - saboia.xyz.localhost:3000 -> loads clinic with slug "saboia.xyz"
 * - app.fuse.health -> loads clinic with slug "fuse.health"
 * - localhost:3000 -> no clinic (main site)
 */
export function useClinicFromDomain(): UseClinicFromDomainResult {
  const [clinic, setClinic] = React.useState<Clinic | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadClinic = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // This function checks vanity domain first, then falls back to subdomain
      const domainInfo = await extractClinicSlugFromDomain();

      if (domainInfo.hasClinicSubdomain && domainInfo.clinicSlug) {
        console.log('🏥 Loading clinic from domain:', domainInfo.clinicSlug);

        const result = await apiCall(`/clinic/by-slug/${domainInfo.clinicSlug}`);

        if (result.success && result.data) {
          const clinicData = result.data.data || result.data;
          setClinic(clinicData);
          console.log('✅ Loaded clinic data:', clinicData);
        } else {
          setError('Clinic not found');
          console.error('❌ Clinic not found for slug:', domainInfo.clinicSlug);
        }
      } else {
        // No clinic subdomain detected - this is normal for main site
        setClinic(null);
      }
    } catch (err) {
      setError('Failed to load clinic');
      console.error('❌ Error loading clinic:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load clinic when component mounts
  React.useEffect(() => {
    loadClinic();
  }, [loadClinic]);

  // Note: We track clinicSlug and hasClinicSubdomain in state via loadClinic
  // To get these synchronously, we'd need to call the function again, but that would
  // trigger another API call. Instead, components should use the clinic object directly.
  // For now, we'll use a simple synchronous check just for the return value.
  const [domainInfo, setDomainInfo] = React.useState<{
    hasClinicSubdomain: boolean;
    clinicSlug: string | null;
  }>({ hasClinicSubdomain: false, clinicSlug: null });

  React.useEffect(() => {
    const getDomainInfo = async () => {
      const info = await extractClinicSlugFromDomain();
      setDomainInfo({
        hasClinicSubdomain: info.hasClinicSubdomain,
        clinicSlug: info.clinicSlug
      });
    };
    getDomainInfo();
  }, []);

  return {
    clinic,
    hasClinicSubdomain: domainInfo.hasClinicSubdomain,
    isLoading,
    error,
    clinicSlug: domainInfo.clinicSlug
  };
}

/**
 * Simple utility function to get just the clinic slug from current domain
 * Checks vanity domain first, then falls back to subdomain detection
 */
export async function getClinicSlugFromDomain(): Promise<string | null> {
  const domainInfo = await extractClinicSlugFromDomain();
  return domainInfo.clinicSlug;
}

/**
 * Hook to get the dashboard prefix based on the current clinic's patientPortalDashboardFormat
 * 
 * @returns Object with dashboardPrefix ('/fuse-dashboard' or '/mdi-dashboard') and helper function
 */
export function useDashboardPrefix() {
  const { clinic, isLoading } = useClinicFromDomain();
  
  const dashboardPrefix = React.useMemo(() => {
    return getDashboardPrefix(clinic);
  }, [clinic]);
  
  const buildRoute = React.useCallback((path: string = '') => {
    return buildDashboardRoute(clinic, path);
  }, [clinic]);
  
  return {
    dashboardPrefix,
    buildRoute,
    isLoading,
    clinic
  };
}
