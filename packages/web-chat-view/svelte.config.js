import { relative, sep } from "node:path";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import("svelte").Config} */
const config = {
  preprocess: vitePreprocess(),
  compilerOptions: {
    runes: ({ filename }) => {
      const relativePath = relative(import.meta.dirname, filename);
      const normalizedPath = relativePath.toLowerCase();
      const pathSegments = normalizedPath.split(sep);
      const isNodeModules = pathSegments.includes("node_modules");
      const isAgenterWorkspacePackage =
        normalizedPath.includes("@agenter/web-chat-view") || normalizedPath.includes("@agenter/web-components");

      return isNodeModules && !isAgenterWorkspacePackage ? undefined : true;
    },
    customElement: ({ filename }) => {
      return filename.endsWith("web-chat-view-element.svelte");
    },
  },
};

export default config;
