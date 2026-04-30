import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { bitsUiVirtualStylePlugin } from "./vite.bits-ui-style-plugin";

export default defineConfig({
  plugins: [bitsUiVirtualStylePlugin(), react(), svelte(), tailwindcss()],
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  server: {
    port: 4173,
  },
});
