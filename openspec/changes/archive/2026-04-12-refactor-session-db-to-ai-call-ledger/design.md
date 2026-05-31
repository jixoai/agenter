## Context

The runtime kernel has already crossed a paradigm boundary:

- the model only sees stable attention law plus `skills.list`;
- the runtime only exposes root-workspace primitives directly;
- message / terminal / workspace / attention interactions are discovered through runtime-local CLI instead of injected tool lists;
- attention, not chat, is the scheduling truth.

`session.db` did not follow that shift. It still persists:

- `session_cycle`
- `prompt_window_state`
- `model_call`
- `api_call`
- `session_block`
- `loopbus_state_log`
- `loopbus_trace`
- `terminal_activity`

That older schema made sense when the app mental model was “conversation + cycles + devtools traces”. It is now oversized and conceptually wrong for the current core law. The new kernel primarily needs two kinds of durable facts:

1. what the model actually saw or produced as message-like payload;
2. what each AI call objectively sent and received.

Everything else is either:

- already owned by another system (`message-system`, `terminal-system`, `attention-system`);
- derivable projection (`cycles`, preview panes, devtools lists);
- or future optional telemetry that should not bloat the default session durable truth.

## Goals / Non-Goals

**Goals:**
- redefine `session.db` around a minimal AI-call ledger that matches the new runtime law;
- make streamed assistant output and request-side bootstrap payloads durable as grouped message parts;
- make each AI call objectively inspectable through one mutable lifecycle row;
- keep bounded retention for expensive request/response bodies while preserving enough durable facts for cold restart and future heartbeat-style inspection;
- remove default session-db coupling to loop traces, state logs, and other telemetry-heavy tables;
- simplify `app-server` persistence and hydration APIs so they no longer depend on obsolete cycle/trace tables.

**Non-Goals:**
- preserving backward compatibility with the old `session.db` schema;
- redesigning the separate `attention-system` store;
- shipping the future standalone telemetry package or its eventual Svelte/WebUI viewer in this change;
- solving every historical inspection surface in one pass.

## Decisions

### Replace the old session schema with a two-layer ledger: `message_parts` + `ai_call`

The new schema will treat `message_parts` as the durable message-like fact ledger and `ai_call` as the objective request/response envelope ledger.

`message_parts` will store:

- `part_id` as the durable append order;
- `message_id` as the logical message grouping key;
- optional `ai_call_id` to relate parts back to the call that produced or consumed them;
- `round_index` so bounded prompt-window rotations remain queryable;
- `role`, `part_type`, and optional `mime_type`;
- a generic serialized payload column for the raw part body;
- `created_at`, `updated_at`, and `is_complete`.

This lets the runtime store:

- normal user / assistant message parts;
- streamed assistant deltas that update an existing row until complete;
- request-side auxiliary payloads such as `systemPrompt`, `tools`, or `config` using the same ledger shape instead of separate side tables.

Why this over keeping dedicated `prompt_window_state` and `model_call.request.messages` snapshots:

- it matches the runtime’s real unit of durable truth: message-like facts, not projection-specific prompt windows;
- it avoids duplicating the same content across `session_block`, `prompt_window_state`, and `model_call`;
- it keeps the schema extensible without reopening a loose metadata bag.

Rejected alternative:
- keep `session_block` as the canonical transcript and merely trim `session_cycle` / `loopbus_trace`. That would preserve old chat-specific assumptions and still require duplicated request reconstruction paths.

### Persist each AI request as one mutable `ai_call` row

`ai_call` will store:

- `id`;
- `round_index`;
- `kind` (`attention`, `compact`, or other runtime-known call classes);
- request URL;
- request body JSON;
- response body JSON;
- status and completion flags;
- `created_at`, `updated_at`, and optional `completed_at`;
- optional logical links such as `user_message_id` and `assistant_message_id`.

The row is created at request start and updated in place while the provider streams.

Why:

- the row stays objective and debuggable;
- realtime and persisted inspection share the same logical record;
- the runtime can cap retained request/response bodies without discarding the more reusable `message_parts` ledger.

Rejected alternative:
- derive everything from `message_parts` and stop persisting request/response envelopes entirely. That would lose the exact provider payload, which is still the most objective artifact for debugging and real-AI verification.

### Round retention is bounded in `ai_call`, not in `message_parts`

The expensive part of history is provider request/response payload retention, not the normalized message-part ledger. The design therefore keeps:

- `message_parts` as the longer-lived durable transcript of AI-visible facts;
- `ai_call` retention bounded to two rounds: current prompt-window round and previous prompt-window round.

When compaction produces a new prompt-window seed:

- the current round becomes previous;
- a new current round starts;
- rows older than previous are pruned from `ai_call`.

Why:

- it matches the user’s “keep current + previous” rule without throwing away durable facts needed for cold restart;
- it keeps provider payload storage bounded even when the runtime works for long periods.

Rejected alternative:
- prune `message_parts` on each compaction alongside `ai_call`. That would make cold restart and future heartbeat reconstruction depend too heavily on the smaller retained `ai_call` window.

### Request-side auxiliary payloads are versioned by change, not by every call

`systemPrompt`, `tools`, and `config` are durable request-side facts, but they are not worth rewriting into `message_parts` on every call if unchanged. The runtime will persist them as special message-part rows only when their content changes relative to the latest stored value.

Why:

- it preserves objective bootstrap history without needless bloat;
- it keeps the “what changed in request context?” question explicit and queryable.

Rejected alternative:
- only keep the latest bootstrap payload in memory and never persist it. That would weaken cold-start debugging and make request reconstruction less objective.

### Telemetry leaves `session.db`

`loopbus_state_log`, `loopbus_trace`, and related session-db telemetry tables will be removed from the core schema. The runtime may still emit or capture telemetry, but that capture must be controlled separately and stored outside the session durable truth.

Why:

- telemetry volume is operationally very different from the compact durable ledger the core needs;
- the user explicitly wants telemetry to become a separately controlled future package rather than default local DB bloat;
- removing telemetry from `session.db` simplifies both cold-start recovery and UI expectations.

Rejected alternative:
- keep telemetry tables but mark them optional. That still preserves the wrong ownership boundary and complicates every read path.

### Break compatibility intentionally and rebuild schema cleanly

This change will not attempt a field-by-field migration from the old schema. The implementation should detect incompatible legacy tables and replace the session DB with the new schema, optionally preserving the old file as a backup artifact for local debugging.

Why:

- the old and new models are based on different laws;
- trying to translate every old table into the new model would be glue code in exactly the area being purified.

Rejected alternative:
- incremental in-place migration that keeps old query APIs alive. That would significantly slow the refactor and preserve the obsolete vocabulary.

## Risks / Trade-offs

- **[Risk]** Removing old tables will break tests, debug views, and helper APIs that still speak in cycles or traces.
  **Mitigation**: refactor `session-system` and `app-server` together, delete obsolete APIs instead of shimming them, and update tests in the same change.
- **[Risk]** Longer-lived `message_parts` can still grow over time.
  **Mitigation**: keep rows normalized and avoid persisting unchanged bootstrap payloads repeatedly; only `ai_call` stores the expensive full request/response bodies.
- **[Risk]** Cold restart reconstruction may miss facts that used to be pulled from `prompt_window_state`.
  **Mitigation**: reconstruct from grouped message parts plus the latest bounded call window and add explicit cold-restart tests.
- **[Risk]** Telemetry consumers may temporarily lose persisted history.
  **Mitigation**: treat that as an intentional contract cut; record the follow-up standalone telemetry package separately rather than preserving a half-owned path.

## Migration Plan

1. Add the new `session-system` types and schema for `message_parts` and `ai_call`.
2. Refactor `app-server` write paths to populate the new ledger during normal and compact calls.
3. Replace persisted read paths and APIs that currently depend on `session_cycle`, `prompt_window_state`, `model_call`, `api_call`, `loopbus_trace`, or `loopbus_state_log`.
4. Remove obsolete tables and their tests once all callers have moved.
5. Run unit/integration tests, then run real-AI session validation to confirm:
   - streamed AI calls update correctly;
   - compaction rotates retained rounds correctly;
   - `session.stop -> restart -> start` still reconstructs the session from durable facts.

Rollback strategy:

- this is a breaking development-phase refactor, so rollback is by reverting the code change, not by maintaining dual-schema compatibility.

## Open Questions

- Should `message_id` remain a runtime-generated string, or should the implementation use a numeric surrogate plus an external logical id for grouping? The current design assumes a logical id string is sufficient.
- Which minimal persisted projection, if any, should replace the current session preview helpers that still read old chat/cycle tables? The answer may emerge during the `app-kernel` API cut.
