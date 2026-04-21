import tailwindcss from '@tailwindcss/vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

import { bitsUiVirtualStylePlugin } from './vite.bits-ui-style-plugin';

const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	build: {
		emptyOutDir: true,
		outDir: 'build-toolbar-preview',
		rollupOptions: {
			input: path.resolve(dirname, 'toolbar-preview.html'),
		},
	},
	plugins: [bitsUiVirtualStylePlugin(), tailwindcss(), svelte()],
	resolve: {
		alias: {
			$app: path.resolve(dirname, 'src/toolbar-preview-app'),
			$lib: path.resolve(dirname, 'src/lib'),
		},
	},
	optimizeDeps: {
		exclude: ['@agenter/svelte-components', '@lucide/svelte', 'bits-ui', 'events', 'shadcn-svelte'],
	},
});
