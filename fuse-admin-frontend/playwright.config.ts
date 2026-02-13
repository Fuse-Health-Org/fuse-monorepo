import { defineConfig } from "@playwright/test";
import { baseConfig } from "@fuse/e2e/playwright.base.config";

const baseURL = process.env.E2E_BASE_URL || "http://localhost:3002";
const isRemote = !!process.env.E2E_BASE_URL;

export default defineConfig({
  ...baseConfig,
  testDir: "./e2e",
  use: {
    ...baseConfig.use,
    baseURL,
  },
  // Only start local dev server when not targeting a remote URL
  ...(!isRemote && {
    webServer: {
      command: "pnpm dev",
      port: 3002,
      reuseExistingServer: true,
      timeout: 60_000,
    },
  }),
});
