import tailwindcss from '@tailwindcss/vite';
import type { StorybookConfig } from '@storybook/sveltekit';
import { mergeConfig, type PluginOption } from 'vite';
import { bitsUiVirtualStylePlugin } from '../vite.bits-ui-style-plugin.ts';

const codemirrorDedupe = [
	'@codemirror/autocomplete',
	'@codemirror/lang-markdown',
	'@codemirror/language',
	'@codemirror/language-data',
	'@codemirror/state',
	'@codemirror/view',
];

const storybookSveltePackages = [
	'@storybook/addon-svelte-csf',
	'@storybook/addon-svelte-csf/internal/create-runtime-stories',
	'@storybook/svelte',
	'@storybook/sveltekit',
];

const appSveltePackages = [
	'@agenter/svelte-components',
	'@agenter/web-chat-view',
	'@agenter/web-components',
	'@lucide/svelte',
	'bits-ui',
	'framework7/lite-bundle',
	'framework7-svelte',
	'shadcn-svelte',
	'skeleton-elements',
];

const optimizeDepsInclude = [
	...codemirrorDedupe,
	'@agenter/terminal-view',
	'@lezer/highlight',
	'@tanstack/svelte-virtual',
	'clsx',
	'highlight.js',
	'idb-keyval',
	'lit',
	'lit/decorators.js',
	'lit/directives/style-map.js',
	'lit/directives/unsafe-html.js',
	'lit/static-html.js',
	'markdown-it',
	'tailwind-merge',
	'tailwind-variants',
	'yaml',
];

const reorderSvelteCsfPlugin = (plugins: PluginOption[] | undefined) => {
	if (!Array.isArray(plugins)) {
		return plugins;
	}

	const nextPlugins = [...plugins];
	const sveltePluginIndex = nextPlugins.reduce((lastIndex, plugin, index) => {
		if (plugin && typeof plugin === 'object' && 'name' in plugin && typeof plugin.name === 'string') {
			return plugin.name.startsWith('vite-plugin-svelte') ? index : lastIndex;
		}
		return lastIndex;
	}, -1);
	const svelteCsfIndex = nextPlugins.findIndex(
		(plugin) =>
			Boolean(plugin) &&
			typeof plugin === 'object' &&
			'name' in plugin &&
			plugin.name === 'storybook:addon-svelte-csf',
	);

	if (sveltePluginIndex < 0 || svelteCsfIndex < 0 || svelteCsfIndex > sveltePluginIndex) {
		return nextPlugins;
	}

	const [svelteCsfPlugin] = nextPlugins.splice(svelteCsfIndex, 1);
	nextPlugins.splice(sveltePluginIndex + 1, 0, svelteCsfPlugin!);
	return nextPlugins;
};

const config: StorybookConfig = {
	stories: ['../src/**/*.stories.@(js|ts|svelte)'],
	addons: [
		'@storybook/addon-svelte-csf',
		'@chromatic-com/storybook',
		'@storybook/addon-vitest',
		'@storybook/addon-a11y',
		'@storybook/addon-docs',
	],
	framework: '@storybook/sveltekit',
	async viteFinal(config) {
		const mergedConfig = mergeConfig(config, {
			plugins: [bitsUiVirtualStylePlugin(), tailwindcss()],
			resolve: {
				dedupe: codemirrorDedupe,
			},
			optimizeDeps: {
				include: optimizeDepsInclude,
				// Let Vite's Svelte pipeline transform packages that ship `.svelte` entrypoints.
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
