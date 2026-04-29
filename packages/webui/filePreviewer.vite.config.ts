import tailwindcss from '@tailwindcss/vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

import { bitsUiVirtualStylePlugin } from './vite.bits-ui-style-plugin';

const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	build: {
		emptyOutDir: false,
		outDir: 'build',
		rollupOptions: {
			input: path.resolve(dirname, 'filePreviewer.html'),
		},
	},
	plugins: [bitsUiVirtualStylePlugin(), tailwindcss(), svelte()],
	resolve: {
		alias: {
			$lib: path.resolve(dirname, 'src/lib'),
		},
	},
});
