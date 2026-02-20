import { test, expect } from "@playwright/test";
import { serviceUrls } from "@fuse/e2e";

const BASE_URL = serviceUrls.doctorApp;
const EMAIL = process.env.E2E_DOCTOR_EMAIL;
const PASSWORD = process.env.E2E_DOCTOR_PASSWORD;

if (!EMAIL || !PASSWORD) {
  throw new Error(
    "E2E_DOCTOR_EMAIL and E2E_DOCTOR_PASSWORD env vars are required. Example:\n" +
    "  E2E_DOCTOR_EMAIL=user@example.com E2E_DOCTOR_PASSWORD=secret npx playwright test visit-all-pages"
  );
}

// Delay between page visits to avoid rate limiting on deployed server
// Use 0ms for localhost, 4000ms for deployed servers
const DELAY_MS = BASE_URL.includes('localhost') ? 0 : 4000;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test.describe("Visit all pages (deployed)", () => {
  test.use({ baseURL: BASE_URL });

  // Increase timeout since we're hitting a deployed server with delays
  test.setTimeout(300_000);

  let authToken: string;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(120_000);

    const page = await browser.newPage();

    // Listen for console messages to debug login
    page.on("console", (msg) => {
      const text = msg.text();
      if (text.includes("[Auth")) console.log(`  [browser] ${text}`);
    });

    await page.goto(`${BASE_URL}/signin`);
    await page.waitForLoadState("load");
    await delay(2000);

    // Fill in credentials and submit
    await page.fill('input[type="email"]', EMAIL);
    await delay(500);
    await page.fill('input[type="password"]', PASSWORD);
    await delay(500);

    // Wait for the submit button to be enabled
    const submitBtn = page.locator('button[type="submit"]:not([disabled])');
    await submitBtn.waitFor({ state: "visible", timeout: 5000 });
    await submitBtn.click();

    console.log("  Clicked sign in, waiting for redirect...");

    // Wait for navigation away from /signin (handles both direct login and MFA)
    await page.waitForURL((url) => !url.pathname.includes("/signin"), {
      timeout: 60_000,
    });

    await page.waitForLoadState("load");
    await delay(3000);

    console.log(`  Landed on: ${page.url()}`);

    // Extract auth data from localStorage
    authToken = await page.evaluate(() =>
      localStorage.getItem("doctor_token") || ""
    );

    expect(authToken).toBeTruthy();
    console.log("  Login successful, token captured");

    await page.close();
  });

  // Seed localStorage before each test
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(
      ({ token }) => {
        localStorage.setItem("doctor_token", token);
      },
      { token: authToken }
    );
  });

  const publicPages = [
    { path: "/signin", name: "Sign In" },
    { path: "/signup", name: "Sign Up" },
    { path: "/forgot-password", name: "Forgot Password" },
    { path: "/verify-email", name: "Verify Email" },
  ];

  const protectedPages = [
    { path: "/", name: "Dashboard" },
    { path: "/requests", name: "Requests" },
    { path: "/patients", name: "Patients" },
    { path: "/settings", name: "Settings" },
    { path: "/payouts", name: "Payouts" },
    { path: "/brand-invitations", name: "Brand Invitations" },
    { path: "/forms", name: "Forms" },
    { path: "/multi-choice-forms", name: "Multi-Choice Forms" },
  ];

  for (const pg of publicPages) {
    test(`Public: ${pg.name} (${pg.path})`, async ({ page }) => {
      await page.goto(pg.path, { waitUntil: "load", timeout: 30_000 });
      await delay(DELAY_MS);

      const title = await page.title();
      expect(title.length).toBeGreaterThan(0);

      const errorOverlay = page.locator("#__next-build-error");
      await expect(errorOverlay).toHaveCount(0);

      console.log(`  ✓ ${pg.name} loaded — title: "${title}"`);
    });
  }

  for (const pg of protectedPages) {
    test(`Protected: ${pg.name} (${pg.path})`, async ({ page }) => {
      await page.goto(pg.path, { waitUntil: "load", timeout: 30_000 });
      await delay(DELAY_MS);

      // Should NOT have been redirected to signin
      const url = page.url();
      expect(url).not.toContain("/signin");

      const title = await page.title();
      expect(title.length).toBeGreaterThan(0);

      const errorOverlay = page.locator("#__next-build-error");
      await expect(errorOverlay).toHaveCount(0);

      const body = page.locator("body");
      await expect(body).not.toBeEmpty();

      console.log(`  ✓ ${pg.name} loaded — title: "${title}"`);
    });
  }
});
