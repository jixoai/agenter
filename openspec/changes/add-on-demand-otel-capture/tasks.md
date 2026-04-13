## 0. Approval Gate

- [ ] 0.1 Wait for explicit approval before implementation starts

## 1. Platform Law

- [ ] 1.1 Add OpenSpec deltas for runtime telemetry capture control and OTel export boundaries
- [ ] 1.2 Define the no-capture idle-cost rule and the separation from `session.db`

## 2. Backend Capture Control

- [ ] 2.1 Add start/stop/status capture APIs with bounded lifetime control
- [ ] 2.2 Implement auto-expiry with default `maxDurationMs = 600_000` and `0 = unlimited`
- [ ] 2.3 Ensure disabled capture stays on a no-serialization, no-file-write fast path

## 3. Export and Storage

- [ ] 3.1 Implement an OpenTelemetry-compatible export shape for spans, events, links, and runtime refs
- [ ] 3.2 Store capture output outside `session.db` through a dedicated sink boundary
- [ ] 3.3 Keep the exporter pluggable so a future external telemetry package and viewer can attach without changing runtime law

## 4. Client and UI

- [ ] 4.1 Publish capture status for CLI and WebUI inspection
- [ ] 4.2 Add hydrate/stream paths for capture data without polluting Heartbeat
- [ ] 4.3 Verify Heartbeat remains ledger-first while telemetry stays a separate advanced surface

## 5. Verification

- [ ] 5.1 Add backend tests proving disabled capture has no telemetry writes
- [ ] 5.2 Add backend tests for start/stop/expiry/unlimited capture behavior
- [ ] 5.3 Add verification that exported telemetry preserves linked runtime refs across model calls and tool calls
- [ ] 5.4 Add client/WebUI tests that consume capture status and capture output separately from Heartbeat
