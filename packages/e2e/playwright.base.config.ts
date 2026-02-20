import { defineConfig, type PlaywrightTestConfig } from "@playwright/test";

/**
 * Base Playwright config shared across all FUSE apps.
 * App-level configs should spread this and override as needed.
 */
const baseConfig: PlaywrightTestConfig = {
  testDir: "./e2e",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  retries: 1,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    ignoreHTTPSErrors: true,
  },
};

export default baseConfig;
export { baseConfig };
