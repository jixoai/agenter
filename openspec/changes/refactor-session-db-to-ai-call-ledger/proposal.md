## Why

The runtime core has already been simplified into an attention-first, root-workspace-bash-driven loop, but `session.db` still persists the older cycle/prompt-window/trace worldview. That mismatch keeps cold-restart recovery, runtime inspection, and backend APIs coupled to obsolete tables instead of the smaller AI-call ledger the new kernel actually needs.

## What Changes

- **BREAKING** Replace the cycle-centered `session.db` model with a smaller AI-call ledger centered on `message_parts` and `ai_call`.
- Persist AI-visible request/response traffic as grouped message parts, including streamed assistant updates and request-side auxiliary payloads such as `systemPrompt`, `tools`, and `config`.
- Persist each model invocation as one stream-updatable `ai_call` row containing request URL, request body, response body, lifecycle timestamps, and completion state.
- Retain only the current and previous prompt-window rounds in `ai_call`, rotating retained windows when compaction rewrites the bounded model context.
- **BREAKING** Remove session-db-owned loop/cycle/trace/state-log telemetry persistence from the core schema; telemetry is no longer part of the session durable truth and will be handled by separately controlled capture surfaces.
- Simplify `session-system` and `app-server` contracts so persisted runtime inspection, cold-start reconstruction, and future `Heartbeat` UI surfaces read from the AI-call ledger instead of `session_cycle`, `prompt_window_state`, `loopbus_trace`, or `api_call`.

## Capabilities

### New Capabilities
- `session-ai-call-ledger`: durable session persistence around grouped message parts, objective AI-call envelopes, and bounded round retention.

### Modified Capabilities
- `model-call-lifecycle`: model-call inspection shifts from the old `model_call` row shape to the new `ai_call` ledger shape with stream-updated request/response bodies.
- `attention-prompt-window-compaction`: compaction now rotates retained AI-call rounds and reseeds bounded prompt context from the ledger instead of relying on dedicated prompt-window tables.

## Impact

- Affected code is concentrated in `packages/session-system` and `packages/app-server`, especially `session-db.ts`, session types, `session-runtime.ts`, `app-kernel.ts`, tRPC surfaces, and the tests that currently assert against cycle/trace-oriented persistence.
- Persisted inspection APIs for model calls, chat-like runtime history, and cold-start recovery will move to the new ledger vocabulary, while obsolete cycle/trace/state-log persistence APIs will be removed or rewritten.
- This is a deliberate breaking refactor; backward compatibility with the old `session.db` schema is not a goal.
