import { fileURLToPath } from "node:url";

import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [sveltekit()],
  resolve: {
    alias: {
      "@agenter/client-sdk": fileURLToPath(new URL("../../client-sdk/src/index.ts", import.meta.url)),
    },
  },
  server: {
    host: "127.0.0.1",
  },
});
