# agenter-ext-studio

SvelteKit 2 + Svelte 5 Studio for Agenter. This package is the active Studio surface; the previous React implementation lives in `packages/webui-bak`.

## Stack

- Svelte 5 runes + SvelteKit 2
- shadcn-svelte components
- Tailwind CSS v4
- Vitest + Storybook DOM tests
- Playwright smoke verification

## Commands

```sh
pnpm --filter agenter-ext-studio dev
pnpm --filter agenter-ext-studio typecheck
pnpm --filter agenter-ext-studio test
pnpm --filter agenter-ext-studio build
pnpm --filter agenter-ext-studio preview
```

## Runtime

The app connects to the Agenter daemon over TRPC websocket transport.

- Default websocket endpoint fallback: `ws://127.0.0.1:4580/trpc`
- Override for dev/smoke runs: `PUBLIC_AGENTER_WS_URL=ws://host:port/trpc`
- `vite dev` now proxies `/trpc` to `AGENTER_DAEMON_PORT` and defaults that port to `4580`, so local walkthroughs do not need `vite preview`
- In a workspace checkout, default `agenter studio` serves the canonical static build from `extensions/studio/build`; run `bun run build:studio` before static-mode browser verification
- `@agenter/cli` no longer owns Studio static assets. Static/dev serving belongs to this package.

## Product Surfaces

- `/avatars`: avatar workbench with fixed `workspace` / `history` / `settings` tabs plus dynamic runtime tabs
- `/messages`: message-system workbench with route-driven room tabs and a fixed `new room` tab
- `/terminals`: terminal-system workbench with route-driven terminal tabs and a fixed `new terminal` tab
- `/admin`: auxiliary superadmin/profile route reached from the shell footer

Each primary workbench route uses the shared workbench chrome law: a Chrome-like tab row, a responsive toolbar companion directly beneath it, and a fused body surface so the route reads as one switched window.
Inside that window, route roots use shared integrated `page` / `pane` surfaces instead of rendering a second detached outer card.
