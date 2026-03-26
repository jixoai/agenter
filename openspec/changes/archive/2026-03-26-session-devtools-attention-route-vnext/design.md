## Context

The current `WorkspaceDevtoolsRouteView` still stores `detailsTab`, selected attention context/item, and `Query commits` input in component-local state. That makes the inspector non-addressable and causes state loss on refresh or cross-linking. It also keeps the route tied to workspace query parameters even though the primary semantic object is the session.

## Goals / Non-Goals

**Goals:**
- Make Devtools deep-linkable by session id.
- Make the attention inspector navigable through route state.
- Keep the top-level Devtools tabs focused on panel choice, not on attention detail mode.
- Keep desktop/mobile behavior consistent with existing shell primitives.

**Non-Goals:**
- Migrate every workspace route to `/session/$SESSION_ID/*` in this change.
- Redesign cycles/model/trace data contracts.
- Reopen the old LoopBus-first information architecture.

## Decisions

### Session id becomes the primary Devtools route identity
Devtools moves from `/workspace/devtools?...&sessionId=...` to `/session/$SESSION_ID/devtools`.

Why: the inspected object is the session. `workspacePath` is supporting metadata and should be derived from the session record when possible.

### Route search owns Devtools detail state
The Devtools route search owns:
- `panel`: `attention | cycles | systems | observability`
- `cycleId?`
- `contextId?`
- `commitId?`
- `attentionView?`: `context | items`
- `attentionQuery?`

Why: selection, drill-down, and query are part of navigation state, not transient component memory.

### Attention detail tabs belong to the detail pane
The top-level `Attention` panel shows the context list and a right-side detail pane. `Context / Items` tabs appear only inside that detail pane after a context is selected.

Why: the top-level panel chooses *which technical lens* is active; the detail tabs choose *how to inspect one selected context*.

### Query commits is a route-backed drill-down, not a side memory cache
Typing a query, clicking a score hash, or opening an attention ref updates the route search. Reloading the page or using browser back/forward must restore the same inspector state.

Why: score/hash traversal is part of the inspection graph and should behave like navigation.

## Risks / Trade-offs

- Deriving workspace chrome from session id can temporarily show loading chrome before the session record hydrates -> mitigate with explicit loading placeholders.
- Route search grows denser -> mitigate with a narrow, typed search contract and helper functions for encoding/decoding.
- Existing links/tests still target `/workspace/devtools` -> mitigate with targeted route migration coverage.

## Migration Plan

1. Introduce `/session/$SESSION_ID/devtools` and typed search helpers for panel/detail/query state.
2. Move attention selection/query state out of `WorkspaceDevtoolsRouteView` local state into navigation helpers.
3. Refactor `AttentionInspectorPanel` so the right detail pane owns `Context / Items` tabs.
4. Update stories/tests/e2e to use the new session route and route-backed attention navigation.
