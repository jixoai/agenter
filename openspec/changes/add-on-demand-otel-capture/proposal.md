## Why

The current observability hardening solved the "black box" problem for real-AI validation, but it did not yet define the future telemetry platform the architecture expects:

- advanced runtime tracing should be OpenTelemetry-shaped rather than a one-off debug format
- capture must be dynamically enabled and disabled on demand
- idle runtimes must not pay ongoing serialization or storage cost when capture is off
- telemetry must stay outside `session.db`, which remains the durable truth for Heartbeat and model-call ledger facts

Without an explicit follow-up change, the monitored runner risks becoming a useful debugging helper that still lacks a clean upgrade path into the long-term telemetry package and dedicated inspection surface.

## What Changes

- Add a future runtime telemetry capture-control capability that can start, stop, and inspect capture state per session.
- Define a future OpenTelemetry-compatible export boundary for spans, events, links, and related runtime refs.
- Keep telemetry storage outside `session.db`; `session.db` remains the ledger for Heartbeat, `message_part`, and `ai_call` facts.
- Require capture lifetime control:
  - default capture window is 10 minutes
  - `maxDurationMs = 0` means unlimited capture
  - capture auto-stops when the window expires
- Require idle runtimes to remain in a no-capture mode that avoids ongoing trace materialization and file IO.

## Capabilities

### New Capabilities
- `runtime-telemetry-capture-control`

### Modified Capabilities
- `runtime-ui-publication`
- `real-ai-runtime-observability`

## Impact

- Affected code:
  - `packages/app-server`
  - `packages/client-sdk`
  - `packages/webui`
  - future external telemetry package / viewer package
- Affected data:
  - runtime telemetry capture files or external sink outputs
  - capture state publication for CLI and WebUI inspection
- Affected APIs:
  - future start/stop/status telemetry endpoints
  - future telemetry hydration / streaming endpoints

## Status

Planning only. Do not start implementation until explicit approval is given.
