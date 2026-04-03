## Why

The current Svelte `Workspaces` page treats avatar catalogs as one-off queries. Copying an avatar does not reliably appear in the UI, and external avatar directory changes are invisible until a full refresh, which breaks the Quick Start story.

## What Changes

- Make workspace avatar catalogs first-class live resources in the client runtime store instead of route-local async state.
- Add optimistic copy behavior so a copied avatar appears immediately and becomes selectable without a manual refresh.
- Add backend-driven avatar catalog invalidation so workspace and global avatar directory changes are pushed back into the UI.
- Keep Quick Start bound to the live catalog so launching a copied avatar immediately flows into the stable session path.

## Capabilities

### New Capabilities

- `workspace-avatar-catalog-events`: live invalidation and push updates for workspace and global avatar catalogs

### Modified Capabilities

- `workspace-avatar-management`: avatar copy and selection flows must become immediate and refresh-safe in `Workspaces`
- `client-runtime-store`: avatar catalogs must be normalized as live store state instead of route-local one-off fetches

## Impact

- `packages/app-server` avatar catalog invalidation and watcher plumbing
- `packages/client-sdk` runtime store state, optimistic update helpers, and avatar catalog subscriptions
- `packages/webui` Quick Start and workspace avatar catalog rendering
