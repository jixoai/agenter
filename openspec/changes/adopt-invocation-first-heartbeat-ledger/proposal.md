## Why

Heartbeat is already supposed to be the operator-facing projection of durable `message_part` facts, but one major category is still persisted with the wrong physics:

- assistant text/thinking are stored as one evolving response message
- tool lifecycle is reconstructed from the same response snapshot
- the operator does not see a stable invocation row at tool-decision time
- running tool parameters can appear only after later hydration or completion

This is why Heartbeat still feels subjectively "late" even though the database is being updated. The platform is storing an assistant-response snapshot, not an invocation-first ledger.

## What Changes

- Persist each tool invocation as its own canonical Heartbeat message keyed by `aiCallId + invocationId`.
- Write the `tool_call` part as soon as the model decides the invocation, then update that same invocation row as arguments hydrate, and finally append the `tool_result` part when local execution ends.
- Remove tool lifecycle parts from the synthetic assistant response Heartbeat row so assistant-authored text/thinking and local tool execution are no longer conflated.
- Mark running tool rows as incomplete until their result part arrives so Heartbeat can objectively show "still running".
- Preserve request-side `systemPrompt / tools / config` rows and assistant text rows, but make the runtime/UI consume the invocation-first tool ledger as the source of truth for tool visibility.

## Capabilities

### Modified Capabilities

- `session-ai-call-ledger`: Heartbeat tool execution becomes invocation-first instead of response-snapshot-derived.
- `runtime-ui-publication`: live Heartbeat rows expose tool parameters and running state as soon as they exist, without waiting for completion.

## Impact

- Affected code: `packages/app-server`, `packages/webui`, `packages/client-sdk`
- Affected APIs: `runtime.heartbeatPartsPage`, realtime `runtime.heartbeatPart` publication, Heartbeat row projection
- Affected systems: session ledger persistence, runtime Heartbeat live streaming, operator inspection
