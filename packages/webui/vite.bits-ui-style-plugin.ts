import { readFile } from 'node:fs/promises';
import type { PluginOption } from 'vite';

const bitsUiVirtualStylePattern =
	/[\\/](?:node_modules[\\/].*?[\\/])?bits-ui[\\/].*\.svelte\?svelte&type=style&lang\.css(?:&.*)?$/u;
const styleBlockPattern = /<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/gu;

export const bitsUiVirtualStylePlugin = (): PluginOption => ({
	name: 'agenter:bits-ui-virtual-style',
	enforce: 'pre',
	async load(id) {
		if (!bitsUiVirtualStylePattern.test(id)) {
			return null;
		}

		const [filename] = id.split('?');
		if (!filename) {
			return '';
		}

		const source = await readFile(filename, 'utf8');
		const blocks = Array.from(source.matchAll(styleBlockPattern))
			.map((match) => match[1]?.trim() ?? '')
			.filter((block) => block.length > 0);

		return blocks.join('\n\n');
	},
});
