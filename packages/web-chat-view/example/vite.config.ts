import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const resolveProxyTarget = (): string => {
  const configured = process.env.PUBLIC_WEB_CHAT_VIEW_REVIEW_API_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  const port = process.env.WEB_CHAT_VIEW_REVIEW_HARNESS_PORT?.trim() || "4600";
  return `http://127.0.0.1:${port}`;
};

const proxyTarget = resolveProxyTarget();
const exampleRoot = import.meta.dirname;
const repoRoot = resolve(exampleRoot, "../../..");
const framework7IconsRoot = realpathSync(resolve(exampleRoot, "node_modules/framework7-icons"));

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  server: {
    fs: {
      allow: [exampleRoot, repoRoot, framework7IconsRoot],
    },
    proxy: {
      "/api": {
        target: proxyTarget,
        changeOrigin: true,
      },
      "/media": {
        target: proxyTarget,
        changeOrigin: true,
      },
    },
  },
});
