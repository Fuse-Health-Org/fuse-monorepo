/**
 * Centralized service URL configuration for E2E tests
 *
 * Provides default localhost URLs for local development with environment
 * variable overrides for testing against deployed environments.
 *
 * @example
 * ```ts
 * import { serviceUrls } from "@fuse/e2e/config";
 *
 * test("admin app loads", async ({ page }) => {
 *   await page.goto(serviceUrls.adminApp);
 *   // ...
 * });
 * ```
 *
 * @example Testing against deployed environment
 * ```bash
 * E2E_ADMIN_APP_URL=https://app.fusehealth.com \
 * E2E_API_URL=https://api.fusehealth.com \
 * npx playwright test
 * ```
 */

export interface ServiceUrls {
  /** Patient-facing frontend (default: http://localhost:3000) */
  patientApp: string;

  /** Main API backend (default: http://localhost:3001) */
  api: string;

  /** Admin portal frontend (default: http://localhost:3002) */
  adminApp: string;

  /** Doctor portal frontend (default: http://localhost:3003) */
  doctorApp: string;

  /** Affiliate portal frontend (default: http://localhost:3005) */
  affiliateApp: string;

  /** Tenant portal frontend (default: http://localhost:3030) */
  tenantApp: string;
}

/**
 * Get service URLs with environment variable overrides
 */
export function getServiceUrls(): ServiceUrls {
  return {
    patientApp: process.env.E2E_PATIENT_APP_URL || "http://localhost:3000",
    api: process.env.E2E_API_URL || "http://localhost:3001",
    adminApp: process.env.E2E_ADMIN_APP_URL || "http://localhost:3002",
    doctorApp: process.env.E2E_DOCTOR_APP_URL || "http://localhost:3003",
    affiliateApp: process.env.E2E_AFFILIATE_APP_URL || "http://localhost:3005",
    tenantApp: process.env.E2E_TENANT_APP_URL || "http://localhost:3030",
  };
}

/**
 * Service URLs singleton - use this in tests
 */
export const serviceUrls = getServiceUrls();

/**
 * Check if tests are running against deployed (remote) URLs
 */
export function isRemoteEnvironment(): boolean {
  return Object.values(process.env).some(
    (val) => val?.startsWith("https://") ||
             (val?.startsWith("http://") && !val.includes("localhost"))
  );
}
