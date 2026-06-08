/// <reference types="vitest/config" />
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

const codemirrorDedupe = [
  "@codemirror/lang-markdown",
  "@codemirror/lang-sql",
  "@codemirror/language",
  "@codemirror/language-data",
  "@codemirror/state",
  "@codemirror/view",
];

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    dedupe: codemirrorDedupe,
    conditions: ["browser"],
  },
  optimizeDeps: {
    include: codemirrorDedupe,
  },
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.ts"],
  },
});
