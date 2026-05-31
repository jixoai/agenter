## Context

The repo already has partial virtualization in Chat and some Devtools lists, but the data plane is still split across `afterId`/`beforeId` queries and special cases. Chat cycles are current-branch ordered through `prev_cycle_id`, LoopBus state logs are not persisted, and Terminal Activity is reconstructed in the browser by scanning loaded cycles. That architecture does not scale to very long histories and does not give different panels one shared loading model.

## Goals / Non-Goals

**Goals**
- Define one reverse-time pagination contract shared by session history resources.
- Keep cycle history scoped to the current branch while still paging by reverse time.
- Hydrate only recent windows and prepend older pages without scroll jumps.
- Make Terminal Activity and LoopBus history server-backed long lists.
- Keep list ownership explicit so each panel has one scroll owner and one paging state.

**Non-Goals**
- Rework workspace session list pagination.
- Redesign the live runtime event stream.
- Introduce opaque cursors or compatibility shims for old id-based page routes.

## Decisions

### Shared reverse-time page contract
All long-history routes will expose:
- `before?: { beforeTimeMs: number; beforeId: number }`
- `limit`
- response `{ items, nextBefore, hasMoreBefore }`

Queries sort by `(time desc, id desc)`, read `limit + 1`, then return `items` in ascending display order so the client can prepend directly.

Why: explicit cursors keep TRPC contracts inspectable and type-safe.

### Cycles stay current-branch scoped
Cycle pagination still walks only the current branch reachable from `session_head.head_cycle_id`. The server materializes that branch window, applies the reverse-time cursor inside that branch, and returns results oldest-to-newest.

Why: the approved app decision is current-branch semantics, not all-branch history.

### LoopBus state logs become persisted facts
`loopbus_state_log` becomes a real session-db table with timestamped rows, not an in-memory-only compatibility buffer.

Why: long-list pagination requires durable history.

### Terminal activity becomes a normalized timeline
Terminal activity gets a server-side projection with rows that explicitly reference `terminalId` and describe the source kind (`terminal_read`, `terminal_write`, `tool_trace`, `attention_reply`, etc.). The panel queries this projection directly.

Why: scanning all loaded cycles on the client defeats paging and virtualization.

### Runtime store owns page state per resource
The client runtime store will track `nextBefore`, `hasMoreBefore`, `loadingOlder`, and `hydrated` per session/resource pair and use shared helpers to merge older pages.

Why: page-state duplication in `App.tsx` and ad hoc `beforeId` maps is already too fragmented.

## Risks / Trade-offs

- Current-branch cycle paging may require more database work than direct SQL pagination if implemented naively. Mitigation: materialize only the reachable branch ids needed for the requested window.
- Persisting LoopBus state logs increases DB writes. Mitigation: store compact factual rows and keep patch payloads structured, not duplicated snapshots.
- Terminal activity normalization can drift from runtime facts if mapping is inconsistent. Mitigation: centralize the projector and cover it with integration tests.

## Migration Plan

1. Add the OpenSpec delta and shared reverse-time cursor types.
2. Extend session-db with persisted LoopBus state logs, reverse-time page helpers, and terminal-activity rows.
3. Replace app-server TRPC history routes with shared page queries.
4. Refactor runtime-store to use the shared page contract.
5. Move WebUI long lists onto shared reverse-virtualized timelines and run unit/DOM regression coverage.
