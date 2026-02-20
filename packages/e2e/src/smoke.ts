import { test, expect, type Page } from "@playwright/test";
import { mockAdminAuth, type MockAdminAuthOptions } from "./auth";

export interface SmokeTestPage {
  /** The URL path, e.g. "/settings" */
  path: string;
  /** Human-readable label for the test name */
  name: string;
  /** Whether this page requires authentication */
  auth?: boolean;
}

export interface CreateSmokeTestsOptions {
  /** Options passed to mockAdminAuth for protected pages */
  authOptions?: MockAdminAuthOptions;
}

/**
 * Asserts a page loaded successfully:
 * - No Next.js error overlay
 * - Document title is set
 * - Body has visible content
 */
async function assertPageLoaded(page: Page) {
  // No Next.js error overlay
  const errorOverlay = page.locator("#__next-build-error");
  await expect(errorOverlay).toHaveCount(0, { timeout: 5000 });

  // Also check for Next.js runtime error dialog
  const errorDialog = page.locator('[data-nextjs-dialog]');
  await expect(errorDialog).toHaveCount(0, { timeout: 2000 });

  // Document title should be set (not empty)
  const title = await page.title();
  expect(title.length).toBeGreaterThan(0);

  // Page body should have some visible content
  const body = page.locator("body");
  await expect(body).not.toBeEmpty();
}

/**
 * Generates a smoke test suite that checks each page renders without crashing.
 */
export function createSmokeTests(
  pages: SmokeTestPage[],
  options: CreateSmokeTestsOptions = {}
) {
  const publicPages = pages.filter((p) => !p.auth);
  const protectedPages = pages.filter((p) => p.auth);

  if (publicPages.length > 0) {
    test.describe("Public pages", () => {
      for (const pageInfo of publicPages) {
        test(`${pageInfo.name} (${pageInfo.path}) loads without errors`, async ({
          page,
        }) => {
          await page.goto(pageInfo.path, { waitUntil: "networkidle" });
          await assertPageLoaded(page);
        });
      }
    });
  }

  if (protectedPages.length > 0) {
    test.describe("Protected pages", () => {
      test.beforeEach(async ({ page }) => {
        await mockAdminAuth(page, options.authOptions);
      });

      for (const pageInfo of protectedPages) {
        test(`${pageInfo.name} (${pageInfo.path}) loads without errors`, async ({
          page,
        }) => {
          await page.goto(pageInfo.path, { waitUntil: "networkidle" });
          await assertPageLoaded(page);
        });
      }
    });
  }
}
