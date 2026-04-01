## 1. OpenSpec And Scaffold

- [x] 1.1 Author the foundation proposal, design, and capability spec for the SvelteKit replatform.
- [x] 1.2 Rename the current React package to `packages/webui-bak` and change its package identity so the workspace has one active `@agenter/webui`.
- [x] 1.3 Add `pnpm-workspace.yaml` and scaffold the new `packages/webui` package with SvelteKit 2, Svelte 5, Tailwind v4, Vitest, Playwright, Storybook, and the pinned shadcn-svelte preset.

## 2. Static Delivery And Runtime Wiring

- [x] 2.1 Wire the new package build/dev scripts into the root workspace and CLI asset-copy pipeline.
- [x] 2.2 Upgrade CLI static serving to support SvelteKit SPA fallback output and `PUBLIC_AGENTER_WS_URL` injection in dev mode.
- [x] 2.3 Add a Svelte runtime adapter that exposes `@agenter/client-sdk` runtime state and actions through Svelte stores/context.

## 3. Shell And Verification

- [x] 3.1 Build the new top-level Svelte shell, navigation, profile entrypoint, and route layout skeletons.
- [x] 3.2 Remove template/demo residue from the Svelte scaffold and align generated UI usage with shadcn-svelte best practices.
- [x] 3.3 Run package typecheck/build/tests and a desktop/mobile browser smoke walkthrough against the new shell.
