/// <reference types="vitest/config" />
import path from "node:path";
import { fileURLToPath } from "node:url";

import { playwright } from "@vitest/browser-playwright";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import type { InlineConfig } from "vitest/node";
import { defineConfig } from "vitest/config";
import type { UserConfig } from "vite";

const dirname =
  typeof __dirname !== "undefined" ? __dirname : path.dirname(fileURLToPath(import.meta.url));

const codemirrorDedupe = [
  "@codemirror/autocomplete",
  "@codemirror/lang-markdown",
  "@codemirror/language",
  "@codemirror/language-data",
  "@codemirror/state",
  "@codemirror/view",
];

const appSvelteDependencyExcludes = [
  "@agenter/svelte-components",
  "@agenter/web-chat-view",
  "@agenter/web-components",
  "@lucide/svelte",
  "bits-ui",
  "framework7-svelte",
];

const appSvelteDependencyInline = [
  "framework7-svelte",
  "framework7",
  "skeleton-elements",
  "dom7",
  "ssr-window",
];

const storybookSvelteDependencyExcludes = ["@storybook/svelte", "@storybook/svelte-vite"];

const createConfig = (): UserConfig & { test: InlineConfig } => ({
  plugins: [svelte()],
  resolve: process.env.VITEST
    ? {
        dedupe: codemirrorDedupe,
        conditions: ["browser"],
      }
    : {
        dedupe: codemirrorDedupe,
      },
  optimizeDeps: {
    include: codemirrorDedupe,
    exclude: [...appSvelteDependencyExcludes, ...storybookSvelteDependencyExcludes],
  },
  test: {
    server: {
      deps: {
        inline: appSvelteDependencyInline,
      },
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          include: ["test/**/*.test.ts"],
          exclude: ["test/storybook/**/*.test.ts"],
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
    ],
  },
}) satisfies UserConfig & { test: InlineConfig };

export default defineConfig(createConfig());
