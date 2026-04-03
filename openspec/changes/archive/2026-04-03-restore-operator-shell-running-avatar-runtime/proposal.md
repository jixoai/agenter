## Why

The Svelte replatform restored the top-level operator routes but dropped the secondary `Running Avatars` rail and the running-avatar detail shell. Operators can no longer scan active avatars or jump into the `Attention`-first runtime surface that the platform specs already require.

## What Changes

- Restore a secondary `Running Avatars` section inside the global operator shell on desktop and mobile.
- Add a running-avatar detail route that opens from rail entries and lands on `Attention` by default.
- Restore flat runtime peer tabs (`Attention`, `Cycles`, `Systems`, `Observability`, `Settings`) with the active cycle badge behavior.
- Keep `Messages` and `Terminals` as global system pages, and use link-out navigation from the runtime shell instead of duplicating those catalogs.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `svelte-webui-platform`: the Svelte shell must expose the secondary running-avatar rail and runtime detail route instead of only the top-level system pages
- `workspace-shell-session-rail`: running avatars must be visible again on desktop and mobile shells
- `workspace-runtime-shell`: the running-avatar detail shell must exist in the active Svelte WebUI and land on `Attention`

## Impact

- `packages/webui` shell layout, navigation, and new runtime routes
- `packages/client-sdk` runtime selectors used to derive running-avatar rail state
- Playwright and Storybook coverage for shell navigation and runtime tabs
