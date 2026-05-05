## Why

Shared-terminal collaboration currently needs `pause()` in backend validation to keep ordinary terminal output from immediately waking the session runtime and being consumed as AI-loop ingress. That is a law-boundary problem, not just a flaky test: terminal physical activity and runtime attention consumption are still too tightly coupled, which also makes process/resource interference easy to misread as "bun instability".

## What Changes

- Introduce an explicit bridge between terminal-owned activity facts and runtime-loop consumption so terminal changes are recorded first as objective terminal truth, then promoted to runtime ingress only when the bridge decides they are actionable.
- Narrow focused-terminal ingestion so focus means eligibility, not "every semantic terminal change must wake the AI loop". Passive shared-terminal collaboration and inspection flows must remain stable without muting the whole runtime.
- Add deterministic validation coverage for shared-terminal collaboration and terminal-backed real-AI flows that proves the behavior without hidden loop-pausing shortcuts and that checks process/port hygiene before blaming runtime or `bun`.

## Capabilities

### New Capabilities

- `runtime-terminal-activity-bridge`: Define the durable boundary between terminal physical activity, passive observation history, and explicit runtime attention ingress.

### Modified Capabilities

- `runtime-system-kernel-adapters`: Terminal adapter behavior changes so activity signaling and loop ingress draining are no longer the same step.
- `terminal-seat-focus`: Focus remains actor-scoped terminal eligibility truth, but focus alone no longer implies that every semantic terminal change becomes runtime attention work.
- `attention-runtime-kernel`: Terminal-originated activity only schedules model work when the bridge produces an explicit attention delta or actionable obligation instead of passive history.
- `real-ai-room-terminal-validation`: Validation flows must prove room-delivered shared-terminal collaboration under real runtime conditions without relying on hidden loop-pausing shortcuts.

## Impact

- Affected code: `packages/app-server/src/session-runtime.ts`, `packages/app-server/src/runtime-system-kernel-adapters/terminal-adapter.ts`, `packages/app-server/test/workspace-system.test.ts`, and real-AI validation/test helpers.
- Affected systems: terminal collaboration, LoopBus scheduling, runtime attention ingestion, and process-hygiene rules for terminal-backed validation.
