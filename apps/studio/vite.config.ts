/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { playwright } from '@vitest/browser-playwright';
import type { InlineConfig } from 'vitest/node';
import type { UserConfig } from 'vite';
import { bitsUiVirtualStylePlugin } from './vite.bits-ui-style-plugin';
import {
  appOptimizeDepsInclude,
  appVitestOptimizeDepsInclude,
  codemirrorDedupe,
  JIXO_CODEMIRROR_WORKSPACE_PACKAGE,
  workspaceSourceDependencyExcludes,
} from './src/lib/dev/vite-dependency-optimization';
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

const proxyTarget = resolveTrpcProxyTarget();

const appSvelteDependencyExcludes = [
  '@agenter/svelte-components',
  '@agenter/web-chat-view',
  '@agenter/web-components',
  JIXO_CODEMIRROR_WORKSPACE_PACKAGE,
  '@lucide/svelte',
  'bits-ui',
  'framework7-svelte',
  'framework7/lite-bundle',
  'shadcn-svelte'
];
const appSvelteDependencyInline = [
  'framework7',
  'framework7-svelte',
  'dom7',
  'skeleton-elements',
  'ssr-window'
];
const storybookSvelteDependencyExcludes = [
  '@storybook/addon-svelte-csf',
  '@storybook/svelte',
  '@storybook/sveltekit'
];

const createConfig = async (): Promise<UserConfig & { test: InlineConfig }> => {
  const isVitest = Boolean(process.env.VITEST);
  return {
    plugins: [bitsUiVirtualStylePlugin(), tailwindcss(), sveltekit()],
    resolve: {
      dedupe: codemirrorDedupe
    },
    server: {
      proxy: {
        '/trpc': {
          target: proxyTarget,
          changeOrigin: true,
          ws: true
        },
        '/api': {
          target: proxyTarget,
          changeOrigin: true
        },
        '/media': {
          target: proxyTarget,
          changeOrigin: true
        }
      }
    },
    optimizeDeps: {
      include: isVitest ? appVitestOptimizeDepsInclude : appOptimizeDepsInclude,
      // Storybook DOM tests must let Vite's Svelte pipeline own Svelte dependencies.
      exclude: [
        ...(isVitest ? [] : workspaceSourceDependencyExcludes),
        ...appSvelteDependencyExcludes,
        ...storybookSvelteDependencyExcludes
      ]
    },
    test: {
      expect: {
        requireAssertions: true
      },
      server: {
        deps: {
          inline: appSvelteDependencyInline
        }
      },
      projects: [{
        extends: true,
        test: {
          name: 'server',
          environment: 'node',
          include: ['src/**/*.{test,spec}.{js,ts}'],
          exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
        }
      }, {
        extends: true,
        test: {
          name: 'storybook',
          include: ['test/storybook/**/*.test.ts'],
          setupFiles: [path.join(dirname, 'test/storybook/vitest.setup.ts')],
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
};

export default createConfig();
