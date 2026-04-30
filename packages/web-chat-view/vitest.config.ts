import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

const codemirrorDedupe = [
  "@codemirror/autocomplete",
  "@codemirror/lang-html",
  "@codemirror/lang-markdown",
  "@codemirror/language",
  "@codemirror/language-data",
  "@codemirror/state",
  "@codemirror/view",
];

export default defineConfig({
  plugins: [svelte()],
  resolve: process.env.VITEST
    ? {
        dedupe: codemirrorDedupe,
        conditions: ["browser"],
      }
    : undefined,
  optimizeDeps: {
    include: codemirrorDedupe,
  },
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.ts"],
  },
});
