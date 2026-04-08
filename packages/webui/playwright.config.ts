import { defineConfig, devices } from "@playwright/test";

const E2E_DAEMON_PORT = 19190;
const E2E_WEB_PORT = 44173;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${E2E_WEB_PORT}`,
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
        `if lsof -ti tcp:${E2E_DAEMON_PORT} >/dev/null; then lsof -ti tcp:${E2E_DAEMON_PORT} | xargs kill; sleep 1; fi && rm -rf .playwright/agenter-home && mkdir -p .playwright/agenter-home && HOME=$PWD/.playwright/agenter-home bun run ../cli/src/bin/agenter.ts daemon --host 127.0.0.1 --port ${E2E_DAEMON_PORT}`,
      port: E2E_DAEMON_PORT,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command:
        `AGENTER_DAEMON_PORT=${E2E_DAEMON_PORT} pnpm exec vite dev --host 127.0.0.1 --port ${E2E_WEB_PORT}`,
      port: E2E_WEB_PORT,
      reuseExistingServer: false,
      timeout: 300_000,
    },
  ],
});
