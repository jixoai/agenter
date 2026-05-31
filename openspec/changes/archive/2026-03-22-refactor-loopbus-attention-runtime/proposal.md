## Why

LoopBus is still described and implemented too narrowly as backend orchestration glue. The real target is broader: LoopBus should become the attention-first runtime core for the whole app, with a clear plugin pipeline on the backend and a coherent publication/inspection contract on the frontend. Without that split, backend refactors and frontend runtime/devtools surfaces will keep drifting apart.

## What Changes

- Rebuild LoopBus around an attention-first plugin pipeline instead of direct source-specific collection logic.
- Define backend runtime stages, hook kinds, source registration, and cycle gating semantics as the stable LoopBus core contract.
- Define the frontend/backend publication contract for LoopBus runtime state so client-sdk and WebUI can observe the new runtime model directly.
- Keep LoopBus core focused on runtime orchestration itself; source-specific message/terminal adaptation moves to a separate change.

## Capabilities

### New Capabilities
- `loopbus-plugin-pipeline`: attention-first LoopBus lifecycle, plugin registration, ordered hook execution, and deterministic cycle gating.
- `loopbus-runtime-publication`: runtime state, traces, and frontend-facing publication contracts for the new LoopBus model.

### Modified Capabilities
- `workspace-devtools-surface`: LoopBus inspection surfaces consume the new runtime publication model instead of backend-private assumptions.

## Impact

- Affected code: `packages/app-server`, `packages/client-sdk`, `packages/webui`.
- Affected APIs: LoopBus internal contracts, runtime snapshots/realtime events, runtime-store selectors, and LoopBus/devtools inspection surfaces.
- Affected tests: app-server unit/integration tests, client-sdk runtime-store tests, WebUI Storybook DOM tests for LoopBus-facing panels.

## Delivery Order

1. Land LoopBus backend runtime primitives and deterministic hook execution.
2. Land runtime publication contracts that frontend consumers can observe directly.
3. Migrate client-sdk and LoopBus-facing WebUI/devtools consumers to the published contract.
4. Hand source-specific attention ingestion to `integrate-message-terminal-attention-sources`.
