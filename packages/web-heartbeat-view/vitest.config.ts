/// <reference types="vitest/config" />
import path from "node:path";
import { fileURLToPath } from "node:url";

import { svelte } from "@sveltejs/vite-plugin-svelte";
import { playwright } from "@vitest/browser-playwright";
import type { UserConfig } from "vite";
import { defineConfig } from "vitest/config";
import type { InlineConfig } from "vitest/node";

const dirname = typeof __dirname !== "undefined" ? __dirname : path.dirname(fileURLToPath(import.meta.url));

const createConfig = (): UserConfig & { test: InlineConfig } =>
  ({
    plugins: [svelte()],
    optimizeDeps: {
      include: ["framework7/lite-bundle"],
      exclude: [
        "@agenter/web-heartbeat-view",
        "@agenter/svelte-components",
        "@lucide/svelte",
        "@lucide/svelte/icons/chevron-down",
        "@lucide/svelte/icons/circle-alert",
        "@lucide/svelte/icons/copy",
        "@lucide/svelte/icons/loader-circle",
        "@lucide/svelte/icons/settings-2",
        "@lucide/svelte/icons/sparkles",
        "@lucide/svelte/icons/wrench",
        "framework7-svelte",
        "@storybook/svelte",
        "@storybook/svelte-vite",
      ],
    },
    test: {
      server: {
        deps: {
          inline: ["framework7", "framework7-svelte", "skeleton-elements", "dom7", "ssr-window"],
        },
      },
      projects: [
        {
          extends: true,
          test: {
            name: "unit",
            environment: "jsdom",
            include: ["test/**/*.test.ts"],
            exclude: ["test/dom/**/*.test.ts", "test/storybook/**/*.test.ts"],
            setupFiles: [path.join(dirname, "test/vitest.setup.ts")],
          },
        },
        {
          extends: true,
          test: {
            name: "storybook",
            include: ["test/storybook/**/*.test.ts"],
            setupFiles: [path.join(dirname, "test/storybook/vitest.setup.ts")],
            browser: {
              enabled: true,
              headless: true,
              provider: playwright({}),
              instances: [{ browser: "chromium" }],
            },
          },
        },
        {
          extends: true,
          test: {
            name: "dom",
            include: ["test/dom/**/*.test.ts"],
            setupFiles: [path.join(dirname, "test/vitest.setup.ts")],
            browser: {
              enabled: true,
              headless: true,
              provider: playwright({}),
              instances: [{ browser: "chromium" }],
            },
          },
        },
      ],
    },
  }) satisfies UserConfig & { test: InlineConfig };

export default defineConfig(createConfig());
