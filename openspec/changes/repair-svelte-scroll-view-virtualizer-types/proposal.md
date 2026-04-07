## Why

`@agenter/svelte-components` exports the shared `ScrollView` primitive that now owns durable scroll law across Svelte surfaces. Current `@tanstack/svelte-virtual` typings no longer match the local assumptions inside `scroll-view.types.ts` and `scroll-view.svelte`, which breaks `@agenter/webui typecheck` before page-level walkthrough work can continue safely.

## What Changes

- Repair the shared `ScrollView` type contract so its virtual-mode API aligns with the installed `@tanstack/svelte-virtual` package.
- Remove stale local assumptions about exported `Key` types and the shape of `measureElement` virtualizer instances.
- Re-run package and WebUI type validation so shared Svelte consumers regain a sound type-safe scroll primitive.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `scrollview-surface`: the shared virtual scrolling contract now remains type-safe against the installed TanStack virtualizer package.

## Impact

- Affected code: `packages/svelte-components/src/scroll-view.types.ts`, `packages/svelte-components/src/scroll-view.svelte`
- Affected systems: `@agenter/svelte-components`, `@agenter/webui`, any Svelte consumer importing `ScrollView`
- Validation: focused `@agenter/svelte-components` + `@agenter/webui` typecheck, plus targeted virtual scroll tests if needed
