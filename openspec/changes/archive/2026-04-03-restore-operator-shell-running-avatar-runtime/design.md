## Context

The previous React shell already implemented the intended operator information architecture: global primary navigation, a secondary `Running Avatars` rail, and a runtime shell with `Attention` as the default tab. The new Svelte shell currently exposes only the global routes, which means existing durable specs are no longer satisfied.

## Goals / Non-Goals

**Goals:**
- Restore the `Running Avatars` rail in the active Svelte shell
- Restore a running-avatar detail route with flat runtime tabs and `Attention` as the default surface
- Keep the shell aligned with shared `shadcn-svelte` sidebar primitives and `ScrollView`

**Non-Goals:**
- Rebuild every legacy React runtime panel in this change
- Re-embed room or terminal catalogs inside the runtime shell
- Change the durable session identity model

## Decisions

### Use a dedicated SvelteKit runtime route
The Svelte shell will expose `/runtime/[sessionId]/[tab]` as the running-avatar detail route. This keeps runtime state out of the top-level system routes while preserving deep-linking and reload behavior.

### Derive rail state from the existing runtime snapshot
The `Running Avatars` rail will project from `runtimeState.sessions` and related unread/status facts already held in `RuntimeStore`, rather than adding another bespoke cache in the shell layer.

### Keep one global shell owner
`AppShell` remains the only owner of primary navigation, secondary running-avatar navigation, and profile footer chrome. Route surfaces own only their local content and local tabs.

### Link out to global rooms and terminals
The runtime shell will expose room/terminal jump affordances that navigate to the global `Messages` and `Terminals` routes. It will not mount duplicate room or terminal catalogs.

## Risks / Trade-offs

- [Risk] Restoring the runtime shell without enough DOM coverage could reintroduce mobile/drawer regressions. -> Mitigation: add Storybook DOM and Playwright coverage for desktop and iPhone 14 paths.
- [Risk] Reintroducing running-avatar selectors in the shell could drift from store truth. -> Mitigation: implement selectors in one place and reuse them across shell and runtime route entry points.
- [Risk] Runtime tab surfaces may initially be thinner than the old React panels. -> Mitigation: keep the route scaffold and badge behavior correct first, then expand individual panels in later changes.
