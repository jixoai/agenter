import tailwindcss from '@tailwindcss/vite';
import type { StorybookConfig } from '@storybook/sveltekit';
import { mergeConfig, type PluginOption } from 'vite';

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
	'@storybook/svelte',
	'@storybook/sveltekit',
];

const optimizeDepsInclude = [
	'@lucide/svelte/icons/message-square-more',
	'@lucide/svelte/icons/circle-ellipsis',
	'@lucide/svelte/icons/loader-circle',
	'@lucide/svelte/icons/chevron-right',
	'@lucide/svelte/icons/help-circle',
	'@lucide/svelte/icons/folder-kanban',
	'@lucide/svelte/icons/history',
	'@lucide/svelte/icons/user-round',
	'@lucide/svelte/icons/users',
	...codemirrorDedupe,
	'lit/static-html.js',
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
			plugins: [tailwindcss()],
			resolve: {
				dedupe: codemirrorDedupe,
			},
			optimizeDeps: {
				include: optimizeDepsInclude,
				exclude: storybookSveltePackages,
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
