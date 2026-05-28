import type { StorybookConfig } from "@storybook/svelte-vite";
import { mergeConfig, type PluginOption } from "vite";

const codemirrorDedupe = [
  "@codemirror/autocomplete",
  "@codemirror/lang-markdown",
  "@codemirror/language",
  "@codemirror/language-data",
  "@codemirror/state",
  "@codemirror/view",
];

const storybookSveltePackages = [
  "@storybook/svelte",
  "@storybook/svelte-vite",
];

const appSveltePackages = [
  "@agenter/svelte-components",
  "@agenter/web-chat-view",
  "@agenter/web-components",
  "@lucide/svelte",
  "bits-ui",
];

const reorderSvelteCsfPlugin = (plugins: PluginOption[] | undefined) => {
  if (!Array.isArray(plugins)) {
    return plugins;
  }

  const nextPlugins = [...plugins];
  const sveltePluginIndex = nextPlugins.reduce((lastIndex, plugin, index) => {
    if (plugin && typeof plugin === "object" && "name" in plugin && typeof plugin.name === "string") {
      return plugin.name.startsWith("vite-plugin-svelte") ? index : lastIndex;
    }
    return lastIndex;
  }, -1);
  const svelteCsfIndex = nextPlugins.findIndex(
    (plugin) =>
      Boolean(plugin) &&
      typeof plugin === "object" &&
      "name" in plugin &&
      plugin.name === "storybook:addon-svelte-csf",
  );

  if (sveltePluginIndex < 0 || svelteCsfIndex < 0 || svelteCsfIndex > sveltePluginIndex) {
    return nextPlugins;
  }

  const [svelteCsfPlugin] = nextPlugins.splice(svelteCsfIndex, 1);
  nextPlugins.splice(sveltePluginIndex + 1, 0, svelteCsfPlugin!);
  return nextPlugins;
};

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(js|ts)"],
  addons: [
    "@chromatic-com/storybook",
    "@storybook/addon-vitest",
    "@storybook/addon-a11y",
    "@storybook/addon-docs",
  ],
  framework: {
    name: "@storybook/svelte-vite",
    options: {
      docgen: false,
    },
  },
  async viteFinal(config) {
    const mergedConfig = mergeConfig(config, {
      resolve: {
        dedupe: codemirrorDedupe,
      },
      optimizeDeps: {
        include: codemirrorDedupe,
        exclude: [...appSveltePackages, ...storybookSveltePackages],
      },
      build: {
        minify: false,
        cssMinify: false,
      },
      ssr: {
        noExternal: storybookSveltePackages,
      },
    });
    return {
      ...mergedConfig,
      plugins: reorderSvelteCsfPlugin(mergedConfig.plugins),
    };
  },
};

export default config;
