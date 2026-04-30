import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
import { bitsUiVirtualStylePlugin } from "./vite.bits-ui-style-plugin";

const svelteDependencyExcludes = [
  "@agenter/web-chat-view",
  "@agenter/svelte-components",
  "@agenter/web-components",
  "@lucide/svelte",
  "bits-ui",
  "shadcn-svelte",
];

const optimizeDepsInclude = [
  "@agenter/terminal-view",
  "@base-ui-components/react/accordion",
  "@base-ui-components/react/dialog",
  "@base-ui-components/react/menu",
  "@base-ui-components/react/tabs",
  "@base-ui-components/react/tooltip",
  "@codemirror/autocomplete",
  "@codemirror/lang-json",
  "@codemirror/lang-markdown",
  "@codemirror/language",
  "@codemirror/language-data",
  "@codemirror/state",
  "@codemirror/view",
  "@lezer/highlight",
  "@tanstack/react-router",
  "@tanstack/svelte-virtual",
  "clsx",
  "highlight.js",
  "idb-keyval",
  "lit",
  "lit/decorators.js",
  "lit/directives/style-map.js",
  "lit/directives/unsafe-html.js",
  "lit/static-html.js",
  "markdown-it",
  "react-dom/client",
  "tailwind-merge",
  "tailwind-variants",
  "yaml",
];

export default defineConfig({
  plugins: [bitsUiVirtualStylePlugin(), react(), svelte(), tailwindcss()],
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    include: optimizeDepsInclude,
    exclude: svelteDependencyExcludes,
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          setupFiles: ["./test/setup.ts"],
          include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
          exclude: ["test/storybook/**/*.test.tsx"],
        },
      },
      {
        extends: true,
        test: {
          name: "storybook",
          setupFiles: ["./test/setup.ts", "./.storybook/vitest.setup.ts"],
          include: ["test/storybook/**/*.test.tsx"],
          browser: {
            enabled: true,
            provider: playwright({}),
            headless: true,
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
