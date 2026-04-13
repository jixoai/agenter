## Context

The current runtime already has useful ingredients for a future OpenTelemetry path:

- attention/runtime tracing already carries stable `traceId` / `spanId` style identity
- model-call and runtime publication already expose objective execution facts
- monitored real-AI runners already read live facts from runtime state and `session.db` instead of guessing

What is still missing is the control plane and storage law for advanced capture:

- when capture is off, the runtime should not keep paying telemetry costs
- when capture is on, the output should follow a stable OTel-style contract
- capture lifetime should be bounded and operator-controlled
- advanced trace storage should not leak back into `session.db`

## Decision

Treat advanced telemetry as an attachable capture subsystem instead of as an always-on part of the session ledger.

### 1. Capture control is a first-class runtime API

Introduce a future session-scoped capture controller with commands equivalent to:

- `startCapture({ sessionId, maxDurationMs })`
- `stopCapture({ sessionId })`
- `getCaptureStatus({ sessionId })`

Rules:

- `maxDurationMs` defaults to `600_000`
- `maxDurationMs = 0` means unlimited capture
- starting capture on an already-capturing session is idempotent and refreshes the capture window only if requested explicitly by the caller contract
- capture expiry stops the session's telemetry sink automatically and records a terminal reason such as `expired`

### 2. Idle mode must be cheap

When capture is off, the runtime must stay on a no-capture fast path:

- no trace payload serialization
- no telemetry file writes
- no long-lived telemetry buffers

The allowed idle overhead is only the minimal branch needed to decide whether a sink is attached.

### 3. OTel shape reuses the existing runtime identity model

The future exporter should not invent a second identity system. It should map from the existing runtime facts:

- attention refs
- context refs
- cycle refs
- model-call refs
- tool invocation refs
- external dispatch refs

into an OpenTelemetry-compatible shape of:

- spans
- events
- links
- resource/session attributes

This preserves the current attention-first architecture instead of regressing into a provider-only trace view.

### 4. Storage stays outside `session.db`

`session.db` continues to store durable operating facts such as:

- `message_part`
- `ai_call`
- Heartbeat rows

Advanced telemetry capture is stored separately, either:

- in a dedicated capture directory under the session root, or
- through a replaceable exporter package

The core contract is separation, not a specific file format.

### 5. Publication and UI are separate from Heartbeat

Heartbeat remains the conversation-style durable view driven by ledger facts.

The future telemetry surface is a different layer:

- Heartbeat answers "what user-visible work happened"
- telemetry answers "how the runtime internally executed"

This prevents the Heartbeat UI from being forced to masquerade as a trace viewer.

## Consequences

- The monitored real-AI runner can later upgrade from ad hoc CLI diagnostics into a formal telemetry capture client instead of being thrown away.
- The runtime keeps a clean split between durable ledger truth and optional advanced tracing.
- WebUI and future external viewers can share one capture-control and export contract.

## Risks

- A partially gated tracer that still builds payloads while "disabled" would violate the no-cost idle law.
- A telemetry exporter that writes into `session.db` would regress the storage boundary the new architecture is trying to protect.
- If capture control is added without clear status publication, operators will not know whether they are looking at live capture, expired capture, or no capture at all.

## Verification

Future implementation should prove:

1. disabled capture performs no telemetry writes during normal runtime work
2. capture can be started and stopped dynamically on a live session
3. default capture window expires automatically after 10 minutes
4. `maxDurationMs = 0` keeps capture active until explicit stop
5. exported telemetry preserves span/event/link relations across model calls, tool calls, and attention refs
