import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.e2e.ts",
  use: {
    baseURL: "http://localhost:4173",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
    {
      name: "mobile-iphone14",
      use: {
        ...devices["iPhone 14"],
        browserName: "chromium",
      },
    },
  ],
  webServer: [
    {
      command:
        "rm -rf .playwright/agenter-home && mkdir -p .playwright/agenter-home && HOME=$PWD/.playwright/agenter-home bun run ../cli/src/bin/agenter.ts daemon --host 127.0.0.1 --port 19090",
      port: 19090,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command:
        "PUBLIC_AGENTER_WS_URL=ws://127.0.0.1:19090/trpc pnpm run build && PUBLIC_AGENTER_WS_URL=ws://127.0.0.1:19090/trpc pnpm run preview -- --host 127.0.0.1 --port 4173",
      port: 4173,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
