## Why

Workspace route switching still remounts heavy route trees that own their own async data. The clearest regression is `Chats`: every switch back to the tab re-runs `listMessageChannels()` and shows `Loading chat channels...`, even though the session-scoped channel catalog should already be warm. The same ownership mistake also leaks into other route-level resources such as workspace settings refresh.

## What Changes

- Introduce lifecycle-owned shared resources for workspace/session data instead of mount-local `useState + useEffect` fetches.
- Make session-scoped message-channel catalogs a shared runtime resource owned by the session lifecycle, not by the Chats or Devtools route component.
- Add `ensure` / `refresh` semantics so routes can distinguish first-load from warm refresh.
- Keep React `Activity` as an optional DOM optimization only; cache correctness must not depend on subtree retention.
- Apply the same ownership rule to other obvious workspace route resources that were reloading unnecessarily.

## Capabilities

### New Capabilities
- `workspace-resource-ownership`: lifecycle-owned shared async resources for session/workspace route data.

### Modified Capabilities
- `workspace-chat-surface`: Chat channel catalogs come from a shared session resource and no longer flash a cold-loading state on every tab switch.
- `workspace-devtools-surface`: secondary message-channel inspection consumes the same shared session catalog instead of refetching.
- `workspace-settings-surface`: route entry uses `ensure` semantics and avoids redundant first-load treatment when data is already warm.

## Impact

- Affected code: `packages/client-sdk`, `packages/webui/src/App.tsx`, `packages/webui/src/app-context.tsx`, `packages/webui/src/router.tsx`, `packages/webui/src/features/devtools/SystemsPanel.tsx`
- Affected UX: workspace route switching, loading-state behavior, session-scoped data reuse
