## Context

The current Heartbeat persistence model still treats tool lifecycle as a derived detail of the assistant response row:

- `handleAssistantStreamUpdate(tool_call)` mutates `activeModelResponseDraft.toolTrace`
- `persistActiveModelResponse()` rewrites one synthetic assistant Heartbeat row
- the row mixes assistant-authored parts with local execution facts
- UI state is therefore gated by snapshot refresh timing instead of invocation timing

That violates the operator law the user clarified:

- `tool_call` is already a durable AI response fact
- tool execution is a later local fact
- the two facts must stay objectively visible and linked by `tool_call_id`

## Goals / Non-Goals

**Goals**

- Make tool lifecycle durable at invocation granularity.
- Let Heartbeat show running tool params as soon as they are known.
- Keep one stable Heartbeat row per invocation instead of splitting after completion.
- Preserve assistant response persistence for text/thinking without embedding tool result rows there.
- Let settings edits create durable next-call config facts immediately, without mutating the currently running model call.
- Keep grouped Heartbeat paging anchored to the scroll surface with a top load affordance, not a footer control.

**Non-Goals**

- Do not redesign unrelated Heartbeat visuals in this change.
- Do not redesign `ai_call.responseBody`; it may still carry a response snapshot for model/devtools surfaces.
- Do not broaden this change into the on-demand OTel work.

## Decisions

### 1. One invocation owns one Heartbeat message id

Each tool invocation will persist to:

- `heartbeat-part:ai-call:<aiCallId>:tool:<invocationId>`

That row starts with one incomplete `tool_call` part and later updates to:

- `[tool_call]` while still running
- `[tool_call, tool_result]` once execution completes

Rationale:

- this matches the operator's mental model
- it keeps the row identity stable across hydration and completion
- it removes the previous "same invocation gets split after completion" failure mode

### 2. Assistant response Heartbeat rows stop carrying tool lifecycle parts

The assistant response Heartbeat row will only carry assistant-authored parts such as:

- `thinking`
- `text`

Rationale:

- tool execution is not assistant-authored content
- conflating assistant output and local execution created misleading ordering and delayed visibility

### 3. Running invocation rows remain incomplete until a result exists

While only the `tool_call` part exists, that part is persisted with `isComplete=false`.
When the result arrives, the same row is updated so the `tool_call` part becomes complete and a `tool_result` part is appended.

Rationale:

- Heartbeat must objectively show that the invocation is still in flight
- UI loading state should come from durable fact completeness, not from temporary browser heuristics

### 4. Hydrated arguments update the same invocation row

Some providers emit tool lifecycle in phases:

- start event with `toolName + invocationId`
- later args event with hydrated input
- end/result event

The runtime will upsert the same invocation row on every phase instead of waiting for completion.

Rationale:

- `@tanstack/ai` still exposes enough lifecycle detail for this model
- the problem is not missing protocol detail; it is that the current persistence collapses those phases into a response snapshot

### 5. Local tool execution must emit completion back into the same Heartbeat stream

When the runtime-owned tool actually finishes locally, it must emit a `tool_result` stream update for the same `invocationId` instead of relying on the later `persistModelCall(done)` snapshot to imply completion.

Rationale:

- the operator must see the invocation transition from running to completed on the same row
- otherwise the final model-call snapshot can regress the row back into a split or incomplete shape

### 6. `ai_call.responseMessageIds` must reconcile to invocation rows, not only assistant rows

The durable `ai_call` linkage must include invocation row ids alongside any assistant response row ids, and the final `done` persistence path must recompute that linkage from the invocation-first ledger.

Rationale:

- cycle projection and cold restore read `responseMessageIds`
- if only the assistant row is linked, restart can reintroduce split rows or lose invocation continuity

### 7. Request-side auxiliary rows stay change-based, not per-call duplicated

`systemPrompt / tools / config` remain deduplicated `request_aux` rows with `ai_call.auxiliaryMessageIds` linkage.

Rationale:

- this already matches the "record on change" rule the user stated
- the broken area is invocation lifecycle, not request-aux dedupe

### 8. Heartbeat grouping is a query-time projection, not a write-time schema

The database continues to store only objective facts:

- `message_part`
- `ai_call`
- `request_aux`

Heartbeat inspection groups are projected at read time into:

- `before-call`
- `call`
- `compact`
- `before-call-pending`

Rationale:

- the operator explicitly rejected adding presentation semantics into persistence
- query-time grouping avoids paging one call into incomplete fragments
- the same write path can support multiple inspection surfaces without special-case storage

### 9. Realtime Heartbeat updates only invalidate grouped pages

`runtime.heartbeatPart` remains useful as a durable change signal, but the client no longer merges raw parts directly into the visible Heartbeat stream.

Instead:

- live events mark grouped Heartbeat data stale
- the client debounces and reloads `runtime.heartbeatGroupsPage`
- cold restore and live streaming therefore share the same projection law

Rationale:

- live path and cold path must not disagree about Heartbeat shape
- otherwise operators see one structure while streaming and another after refresh/restart

### 10. Streaming thinking is persisted as a first-class Heartbeat part

When the provider emits incremental assistant reasoning before assistant text, the runtime updates the assistant response Heartbeat row in place with a `thinking` part.

Rationale:

- the operator asked to inspect real message-parts, not a post-hoc assistant snapshot
- grouped Heartbeat and restart must agree about whether reasoning existed
- thinking belongs to the assistant-authored response row, not to a separate synthetic projection

### 11. Settings saves create trailing `before-call-pending` config facts

Saving Heartbeat config writes through the durable Settings layer, reloads runtime config, and persists one loose `request_aux:config:*` fact whenever the effective model config changed.

That fact:

- appears immediately in a `before-call-pending` group if no next model call exists yet
- is later consumed through `ai_call.auxiliaryMessageIds` and projected into the next `before-call` group
- does not mutate any currently streaming model call

Rationale:

- the operator needs objective evidence that the next-call knobs changed
- write-time persistence stays factual and query-time grouping decides whether the fact is pending or attached to a call
- current streaming output must remain a snapshot of the config that actually launched it

### 12. Older-page loading belongs to the top of the Heartbeat stream

Grouped Heartbeat paging now exposes a centered top-of-stream affordance:

- `Load older` when older grouped pages exist
- `No older messages` when paging is exhausted

Rationale:

- older-page loading is part of the scroll surface, not part of the status footer
- moving it to the top keeps the footer available for passive status and next-call config controls
- the operator can discover pagination only when it is contextually relevant, i.e. after reaching the top

## Remaining Known Gaps After This Change

These are adjacent but not required to complete invocation-first tool persistence:

- assistant part ordering is still rebuilt from timestamps inside one response row instead of a fully append-only part event stream
- `before-call` currently projects changed `request_aux` rows plus loose pre-call Heartbeat rows; if we later want full request snapshots, that should be a separate law change
- provider-specific transport of optional knobs such as `topK` / `thinking` still depends on the target protocol and vendor adapter; the durable config fact is authoritative even when one provider ignores some knobs

Those are real debts, but they are separate from the current tool invocation law and should not block this correction.
