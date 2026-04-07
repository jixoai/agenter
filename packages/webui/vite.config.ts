/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import type { InlineConfig } from 'vitest/node';
import type { UserConfig } from 'vite';
const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

const resolveTrpcProxyTarget = (): string => {
  const configured = process.env.PUBLIC_AGENTER_WS_URL?.trim();
  if (configured) {
    const url = new URL(configured);
    url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
    url.pathname = url.pathname.replace(/\/trpc\/?$/u, '') || '/';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  }

  const daemonPort = process.env.AGENTER_DAEMON_PORT?.trim() || '4580';
  return `http://127.0.0.1:${daemonPort}`;
};

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
const config = {
  plugins: [tailwindcss(), sveltekit()],
  resolve: {
    dedupe: [
      '@codemirror/autocomplete',
      '@codemirror/lang-markdown',
      '@codemirror/language',
      '@codemirror/language-data',
      '@codemirror/state',
      '@codemirror/view'
    ]
  },
  server: {
    proxy: {
      '/trpc': {
        target: resolveTrpcProxyTarget(),
        changeOrigin: true,
        ws: true
      }
    }
  },
  optimizeDeps: {
    include: [
      '@lucide/svelte/icons/message-square-more',
      '@lucide/svelte/icons/circle-ellipsis',
      '@lucide/svelte/icons/loader-circle',
      '@lucide/svelte/icons/chevron-right',
      '@lucide/svelte/icons/help-circle',
      '@lucide/svelte/icons/folder-kanban',
      '@lucide/svelte/icons/history',
      '@lucide/svelte/icons/user-round',
      '@lucide/svelte/icons/users',
      '@codemirror/autocomplete',
      '@codemirror/lang-markdown',
      '@codemirror/language',
      '@codemirror/language-data',
      '@codemirror/state',
      '@codemirror/view',
      'axe-core',
      'lit/static-html.js'
    ]
  },
  test: {
    expect: {
      requireAssertions: true
    },
    projects: [{
      extends: './vite.config.ts',
      test: {
        name: 'server',
        environment: 'node',
        include: ['src/**/*.{test,spec}.{js,ts}'],
        exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
      }
    }, {
      extends: true,
      plugins: [
      // The plugin will run tests for the stories defined in your Storybook config
      // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      storybookTest({
        configDir: path.join(dirname, '.storybook')
      })],
      test: {
        name: 'storybook',
        browser: {
          enabled: true,
          headless: true,
          provider: playwright({}),
          instances: [{
            browser: 'chromium'
          }]
        }
      }
    }]
  }
} satisfies UserConfig & { test: InlineConfig };

export default config;
