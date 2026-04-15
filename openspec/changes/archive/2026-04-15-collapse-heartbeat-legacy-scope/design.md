## Context

The durable spec already says Heartbeat is one message-parts stream:

- `scope=heartbeat_part` holds AI-visible request / response / compact facts
- `scope=request_aux` holds deduplicated `systemPrompt / tools / config`

But the code never completed the destructive migration. Residual helpers still:

- write `scope=heartbeat` wrapper rows for focused room ingress and compact boundaries
- restore persisted runtime chat from `listMessagesByScope("heartbeat")`
- build persisted cycle projections from legacy wrapper messages
- test for legacy `heartbeat` rows as if they were still part of the contract

That is not a UI bug. It is a platform-law mismatch: the runtime kept a compatibility shadow after the spec had already moved to the new ledger physics.

## Goals / Non-Goals

**Goals:**

- Make Heartbeat durable truth singular again: `heartbeat_part + request_aux`
- Remove `scope=heartbeat` from type-level and runtime-level persistence paths
- Keep focused ingress, compact boundaries, and other Heartbeat-only facts durable without reintroducing chat-wrapper storage
- Preserve persisted cycle projection by rebuilding it from canonical `heartbeat_part` rows plus `ai_call` linkage

**Non-Goals:**

- Do not redesign Heartbeat visuals in this change
- Do not redesign room transcript ownership or the message-system durable model
- Do not start the future on-demand OTel work here

## Decisions

### 1. The legacy `scope=heartbeat` contract will be deleted, not widened again

`SessionMessageScope` will stop including `heartbeat`. All source/test code that still reads or writes that scope must move to canonical scopes in the same change.

Rationale:

- The durable spec is already single-scope for Heartbeat.
- Keeping the legacy enum value preserves the wrong platform law and invites more accidental writes.

Alternative considered:

- Keep `heartbeat` in the type as a tolerated historical value.
  Rejected because the user explicitly chose forward-only cleanup over compatibility glue.

### 2. Focused ingress and non-`ai_call` Heartbeat facts will persist directly as `heartbeat_part`

When the runtime needs to persist a focused room ingress or other Heartbeat-visible event that is not one of the provider request/response rows, it will write a normal `scope=heartbeat_part` row with `aiCallId = null`.

Rationale:

- Heartbeat still needs those facts before or outside a provider call.
- They belong in the same ledger, not in a shadow wrapper scope.

Alternative considered:

- Stop persisting focused ingress until an `ai_call` begins.
  Rejected because the operator must still see the ingress fact that woke the loop.

### 3. Assistant/provider output remains single-write through the structured Heartbeat part path

Assistant request/response rows already have canonical `heartbeat_part` persistence through `ai_call` linkage. The runtime will stop writing a second chat-wrapper row for the same assistant output.

Rationale:

- This removes duplicate assistant truth and keeps streamed-to-final identity stable.

Alternative considered:

- Keep both rows and let the UI dedupe.
  Rejected because dedupe in the UI is precisely the kind of glue this migration is meant to eliminate.

### 4. Persisted chat/cycle projection must be rebuilt from canonical ledger rows

Cold restore helpers in `session-runtime` / `app-kernel` will read `heartbeat_part` rows (plus `request_aux` when needed) and project them into persisted chat/cycle views. They may still expose `ChatMessage` / `ChatCycle` shapes to callers, but those are projections, not storage law.

Rationale:

- Some runtime/store APIs still need chat/cycle-shaped projections.
- The correct fix is to rebuild those projections from canonical ledger facts, not to keep a second persisted substrate.

Alternative considered:

- Delete all persisted chat/cycle helpers immediately.
  Rejected because the current shell/store/tests still consume those projections.

## Risks / Trade-offs

- [Projection drift] Chat/cycle helpers may lose legacy wrapper-only metadata. Mitigation: keep projection focused on stable fields the current runtime surfaces actually consume.
- [Cold restore regressions] Removing `heartbeat` can break session bootstrap unexpectedly. Mitigation: update session-runtime/app-kernel tests together and run a real runtime verification after the code change.
- [Test debt exposure] Previously green tests may reveal hidden compatibility assumptions. Mitigation: treat those failures as intended migration scope, not as reasons to preserve the old law.
