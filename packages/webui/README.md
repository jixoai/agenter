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
- `vite dev` now proxies `/trpc` to `AGENTER_DAEMON_PORT` and defaults that port to `4580`, so local walkthroughs do not need `vite preview`
- In a workspace checkout, default `agenter web` serves the canonical static build from `packages/webui/build`; run `bun run build:webui` before browser verification
- `packages/cli/assets/webui` is a derived packaging artifact refreshed by `bun run build:ui`, not a second runtime truth for workspace verification

## Product Surfaces

- `/avatars`: avatar workbench with fixed `workspace` / `history` / `settings` tabs plus dynamic runtime tabs
- `/messages`: message-system workbench with route-driven room tabs and a fixed `new room` tab
- `/terminals`: terminal-system workbench with route-driven terminal tabs and a fixed `new terminal` tab
- `/admin`: auxiliary superadmin/profile route reached from the shell footer

Each primary workbench route uses the shared workbench chrome law: a Chrome-like tab row, a responsive toolbar companion directly beneath it, and a fused body surface so the route reads as one switched window.
Inside that window, route roots use shared integrated `page` / `pane` surfaces instead of rendering a second detached outer card.
