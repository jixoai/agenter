## Why

Real-provider regressions still take too long to diagnose because most scenarios still rely on shared default Avatar prompt state and only expose useful evidence after a full timeout. At the same time, the runtime shell is not reliably surfacing Heartbeat, Attention, and prompt-source facts on first load, which blocks direct inspection of the new `session.db` ledger and runtime prompt assembly.

## What Changes

- Introduce a shared real-AI observability contract for scenario-scoped test Avatars, live run monitoring, and durable success/failure snapshots.
- Upgrade single-avatar and multi-avatar real-provider validations to run with dedicated `AGENTER.mdx` personas instead of drifting default-avatar prompt state.
- Require real-provider validation evidence to include session-db-backed timing and diagnostics that can be inspected while a scenario is still running.
- Tighten the runtime shell so `Heartbeat`, `Attention`, and `Settings` hydrate from backend facts on first load and expose runtime prompt-source metadata instead of depending on optimistic live-only state.

## Capabilities

### New Capabilities
- `real-ai-runtime-observability`: shared contract for scenario-scoped test Avatar personas, monitored debug runners, and durable evidence snapshots.

### Modified Capabilities
- `real-ai-room-terminal-validation`: room-plus-terminal real validation now requires a dedicated builder persona and snapshot-backed diagnostics.
- `realistic-user-real-ai-validation`: ordinary-user real validations now require dedicated personas and snapshot-backed diagnostics for both single-avatar and multi-avatar flows.
- `real-ai-project-room-collaboration-validation`: project-room collaboration validation now requires dedicated backend/frontend personas and actor-scoped durable evidence.
- `workspace-runtime-shell`: runtime Heartbeat, Attention, and Settings must hydrate from backend facts on first load and expose runtime prompt-source metadata.

## Impact

- `packages/app-server`
- `packages/client-sdk`
- `packages/webui`
- `openspec/specs/real-ai-runtime-observability/spec.md`
- `openspec/specs/real-ai-room-terminal-validation/spec.md`
- `openspec/specs/realistic-user-real-ai-validation/spec.md`
- `openspec/specs/real-ai-project-room-collaboration-validation/spec.md`
- `openspec/specs/workspace-runtime-shell/spec.md`
