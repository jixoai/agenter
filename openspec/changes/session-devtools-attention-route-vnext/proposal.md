## Why

The current Devtools attention surface still leaks legacy structure in two important ways:

- the primary route is still `/workspace/devtools?...&sessionId=...` instead of a session-native deep link;
- the attention inspector keeps `Context / Items` and `Query commits` state in local memory instead of route-backed navigation.

That makes Devtools fragile to refresh/back-forward navigation, keeps the shell URL semantically weak, and does not match the attention-first inspection flow the product now requires.

## What Changes

- Add a session-native Devtools route at `/session/$SESSION_ID/devtools`.
- Make Devtools attention selection and query state route-backed instead of local-memory-only.
- Rename the `Contexts` top-level panel to `Attention`.
- Move `Context / Items` tabs into the right-side attention detail panel, only after a context is selected.
- Bind `Query commits` and score/hash traversal to navigation state so reload, copy-link, and browser back/forward remain coherent.

## Capabilities

### Modified Capabilities
- `workspace-devtools-surface`: Devtools becomes session-addressable and keeps attention inspection state in the route.
- `attention-context-inspector`: context selection, detail tabs, and commit queries become route-backed instead of ephemeral component state.

## Impact

- Affected code: `packages/webui/src/router.tsx`, `packages/webui/src/features/attention/*`, `packages/webui/src/features/shell/*`, related stories/tests/e2e.
- Affected UX: Devtools deep links, browser navigation, context/item drill-down, score/hash traversal.
