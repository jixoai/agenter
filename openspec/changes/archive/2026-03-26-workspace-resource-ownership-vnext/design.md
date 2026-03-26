## Context

The problem is not the `Tabs` primitive. The route components own async resources that should belong to longer-lived lifecycle objects. Because `/workspace/chat`, `/workspace/terminals`, `/workspace/devtools`, and `/workspace/settings` are separate TanStack Router routes, switching tabs unmounts the subtree and restarts route-local effects.

The user direction is explicit:
- treat cache ownership as an architectural property,
- associate resources with lifecycle objects,
- use React `Activity` only as a performance optimization,
- prefer clean breaking simplification over compatibility glue.

## Goals / Non-Goals

**Goals:**
- Move session-scoped message-channel catalogs into a shared lifecycle-owned resource.
- Expose first-load vs warm-refresh state explicitly.
- Reuse the same shared resource across Chats and Devtools.
- Reduce redundant route-entry refresh behavior for other obvious workspace resources.

**Non-Goals:**
- Redesign message-system transport or chat-channel protocol.
- Make cache correctness depend on React `Activity`.
- Generalize every async fetch in the application in one pass.

## Decisions

### Session resources are owned by session handles
A session-scoped resource is keyed by a stable session lifecycle handle. Ephemeral controller details such as inflight refresh tasks live in `WeakMap`s attached to that handle. Serializable snapshots still live in runtime client state so selectors can render them.

### Shared resources expose `ensure` and `refresh`
`ensure` means: only fetch if the resource is cold. `refresh` means: fetch regardless, but preserve warm data and only raise a lightweight refresh state.

### Route components only consume resource state
Route components stop keeping their own copies of message-channel arrays and loading booleans. They read the shared resource snapshot and request `ensure` on entry.

### Activity is optional polish
If we keep route subtrees alive with React `Activity`, that is a UI optimization. The resource model must still work correctly when the route unmounts.

## Migration Plan

1. Add shared session resource state for message channels in `RuntimeStore` plus `ensure`/`refresh` APIs.
2. Update `Chats` and `SystemsPanel` to consume that shared resource instead of route-local async state.
3. Add route-entry `ensure` semantics for workspace settings refresh so warm state is not treated as a cold load.
4. Validate the first-load vs warm-refresh behavior with tests.
