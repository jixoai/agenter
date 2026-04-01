# @agenter/webui

SvelteKit 2 + Svelte 5 WebUI for Agenter. This package is the active WebUI surface; the previous React implementation lives in `packages/webui-bak`.

## Stack

- Svelte 5 runes + SvelteKit 2
- shadcn-svelte components
- Tailwind CSS v4
- Vitest + Storybook DOM tests
- Playwright smoke verification

## Commands

```sh
pnpm --filter @agenter/webui dev
pnpm --filter @agenter/webui typecheck
pnpm --filter @agenter/webui test
pnpm --filter @agenter/webui build
pnpm --filter @agenter/webui preview
```

## Runtime

The app connects to the Agenter daemon over TRPC websocket transport.

- Default websocket endpoint fallback: `ws://127.0.0.1:4580/trpc`
- Override for dev/smoke runs: `PUBLIC_AGENTER_WS_URL=ws://host:port/trpc`

## Product Surfaces

- `/workspaces`: global workspace catalog and avatar quick start
- `/history`: workspace history sorted by recent/path/name
- `/messages`: message-system room surface
- `/terminals`: terminal-system collaboration surface
- `/settings`: superadmin auth and profile management
