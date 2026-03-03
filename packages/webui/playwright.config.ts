import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./test/e2e",
  use: {
    baseURL: "http://127.0.0.1:44173",
  },
  webServer: {
    command: "bun run build && bunx vite preview --host 127.0.0.1 --port 44173 --strictPort",
    cwd: import.meta.dirname,
    port: 44173,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
