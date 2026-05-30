import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { relative, sep } from "node:path";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  compilerOptions: {
    runes: ({ filename }) => {
      const relativePath = relative(import.meta.dirname, filename);
      const normalizedPath = relativePath.toLowerCase();
      const pathSegments = normalizedPath.split(sep);
      const isNodeModules = pathSegments.includes("node_modules");
      const isAgenterWorkspacePackage =
        normalizedPath.includes("@agenter/web-chat-view") ||
        normalizedPath.includes("@agenter/web-components") ||
        normalizedPath.includes("agenter-app-studio");

      return isNodeModules && !isAgenterWorkspacePackage ? undefined : true;
    },
  },
  kit: {
    adapter: adapter({
      fallback: "200.html",
    }),
  },
};

export default config;
