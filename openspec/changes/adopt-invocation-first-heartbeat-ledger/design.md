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

### 5. Request-side auxiliary rows stay change-based, not per-call duplicated

`systemPrompt / tools / config` remain deduplicated `request_aux` rows with `ai_call.auxiliaryMessageIds` linkage.

Rationale:

- this already matches the "record on change" rule the user stated
- the broken area is invocation lifecycle, not request-aux dedupe

## Remaining Known Gaps After This Change

These are adjacent but not required to complete invocation-first tool persistence:

- provider thinking is still not streamed as its own Heartbeat delta today; it lands mainly at final response persistence
- assistant part ordering is still rebuilt from timestamps inside one response row instead of a fully append-only part event stream

Those are real debts, but they are separate from the current tool invocation law and should not block this correction.
