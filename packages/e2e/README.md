# @fuse/e2e

Shared Playwright E2E test utilities for the FUSE monorepo.

## Service URLs Configuration

The package provides a centralized service URL configuration that supports both local development and deployed environments.

### Default Local URLs

```typescript
import { serviceUrls } from "@fuse/e2e";

serviceUrls.patientApp;    // http://localhost:3000
serviceUrls.api;           // http://localhost:3001
serviceUrls.adminApp;      // http://localhost:3002
serviceUrls.doctorApp;     // http://localhost:3003
serviceUrls.affiliateApp;  // http://localhost:3005
serviceUrls.tenantApp;     // http://localhost:3030
```

### Environment Variable Overrides

Override service URLs for testing against deployed environments:

```bash
# Test admin app against staging
E2E_ADMIN_APP_URL=https://app-staging.fusehealth.com \
E2E_API_URL=https://api-staging.fusehealth.com \
npx playwright test

# Test against production
E2E_ADMIN_APP_URL=https://app.fusehealth.com \
E2E_API_URL=https://api.fusehealth.com \
npx playwright test
```

Available environment variables:
- `E2E_PATIENT_APP_URL` - Patient-facing frontend
- `E2E_API_URL` - Main API backend
- `E2E_ADMIN_APP_URL` - Admin portal
- `E2E_DOCTOR_APP_URL` - Doctor portal
- `E2E_AFFILIATE_APP_URL` - Affiliate portal
- `E2E_TENANT_APP_URL` - Tenant portal

## Smoke Tests

Create smoke tests that verify pages load without errors:

```typescript
import { createSmokeTests, type SmokeTestPage } from "@fuse/e2e";

const pages: SmokeTestPage[] = [
  // Public pages
  { path: "/signin", name: "Sign In" },
  { path: "/signup", name: "Sign Up" },

  // Protected pages (requires auth)
  { path: "/", name: "Dashboard", auth: true },
  { path: "/settings", name: "Settings", auth: true },
];

createSmokeTests(pages);
```

## Auth Mocking

Mock authentication for protected pages in tests:

```typescript
import { test } from "@playwright/test";
import { mockAdminAuth } from "@fuse/e2e";

test("protected page", async ({ page }) => {
  await mockAdminAuth(page, {
    user: { email: "test@example.com", role: "admin" },
  });

  await page.goto("/dashboard");
  // Test your page...
});
```

## Base Playwright Config

Extend the shared base configuration:

```typescript
import { defineConfig } from "@playwright/test";
import { baseConfig } from "@fuse/e2e/playwright.base.config";
import { serviceUrls, isRemoteEnvironment } from "@fuse/e2e";

export default defineConfig({
  ...baseConfig,
  testDir: "./e2e",
  use: {
    ...baseConfig.use,
    baseURL: serviceUrls.adminApp,
  },
  ...(!isRemoteEnvironment() && {
    webServer: {
      command: "pnpm dev",
      port: 3002,
      reuseExistingServer: true,
    },
  }),
});
```
