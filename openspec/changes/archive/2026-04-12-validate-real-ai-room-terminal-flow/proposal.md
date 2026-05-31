## Why

Current backend validation proves isolated room, attention, and terminal behaviors, but it still does not prove the most basic app promise end to end with a real provider: a user asks an Avatar to build something, the Avatar uses terminal tools to create and launch it, delivers a URL through a room, receives feedback, and improves the result in follow-up turns.

This gap matters now because the next round of backend refactors needs a single, repeatable, real-AI acceptance flow that exercises room messaging, terminal execution, HTTP delivery, and iterative user feedback together instead of relying on mocked model behavior or disconnected subsystem tests.

## What Changes

- Add a backend-only real-AI validation scenario that drives one user and one Avatar through a room-based delivery loop with a real provider HTTP call.
- Reuse the existing real kernel harness and extend it with a scenario helper that asks the Avatar to build a tiny app, launch a local HTTP service, and report the delivery URL back through the room.
- Add follow-up verification that simulates the user opening the delivered URL, sending one round of app feedback, and waiting for the Avatar to update the running app.
- Add deterministic assertions around room messages, terminal tool usage, HTTP reachability, and attention convergence so the scenario can fail with concrete evidence.
- Keep the change backend-only and intentionally exclude the later multi-Avatar project-room scenario.

## Capabilities

### New Capabilities
- `real-ai-room-terminal-validation`: executable real-provider acceptance scenarios that validate room delivery, terminal-backed app creation, URL handoff, and user-feedback iteration.

### Modified Capabilities
- None.

## Impact

- Affected systems: `packages/app-server` real harnesses, real integration tests, and backend-only verification scripts.
- Affected APIs: no new public runtime API is required, but the change adds durable validation expectations over existing room, terminal, model-call, and HTTP-delivery contracts.
- Affected operations: real-provider test runs now require a configured provider in `~/.agenter/settings.json`, `demo/.env`, or `AGENTER_REAL_AI_*` env.
