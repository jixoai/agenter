import { defineConfig } from "vitest/config";
import { mergeConfig } from "vite";

import viteConfig from "./vite.config";

export default defineConfig(mergeConfig(viteConfig, {
  resolve: {
    conditions: ["browser"],
  },
  optimizeDeps: {
    exclude: ["framework7-svelte", "skeleton-elements", "dom7", "ssr-window"],
  },
  ssr: {
    noExternal: ["framework7", "framework7-svelte", "skeleton-elements", "dom7", "ssr-window"],
  },
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.ts"],
    server: {
      deps: {
        inline: ["framework7", "framework7-svelte", "skeleton-elements", "dom7", "ssr-window"],
      },
    },
  },
}));
