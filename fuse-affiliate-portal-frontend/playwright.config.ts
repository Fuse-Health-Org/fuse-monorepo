import { defineConfig } from "@playwright/test";
import { baseConfig } from "@fuse/e2e/playwright.base.config";
import { serviceUrls, isRemoteEnvironment } from "@fuse/e2e";

const isRemote = isRemoteEnvironment();

export default defineConfig({
  ...baseConfig,
  testDir: "./e2e",
  use: {
    ...baseConfig.use,
    baseURL: serviceUrls.affiliateApp,
  },
  // Only start local dev server when not targeting a remote URL
  ...(!isRemote && {
    webServer: {
      command: "pnpm dev",
      port: 3005,
      reuseExistingServer: true,
      timeout: 60_000,
    },
  }),
});
