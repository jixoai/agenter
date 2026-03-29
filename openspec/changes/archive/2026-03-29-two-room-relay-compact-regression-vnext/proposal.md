## Why

The runtime already has a real-provider relay scenario, but it is not deterministic enough to serve as a stable regression for multi-room LoopBus behavior. We need a non-GUI session test that proves the runtime can traverse a manually configured secondary room, survive a manual compact cycle, and still answer the originating user from factual history instead of ad hoc glue logic.

## What Changes

- Add a deterministic app-server integration harness that boots a real `AppKernel` session with a local mock completion provider.
- Add a two-room regression scenario where `kzf` asks the main AI to consult `gaubee`, the runtime routes through the `gaubee` room, and the final answer returns to the original room.
- Add a compact-follow-up regression scenario that triggers manual `/compact` and verifies the next question can still be answered from persisted room facts.
- Tighten runtime behavior only where the tests expose a missing platform rule for room relay or compact continuity.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `session-runtime-attention-message`: Session runtime chat routing must cover manual multi-room relay and compact-preserved follow-up answers.
- `chat-cycles`: Manual compact cycles must stay visible as distinct cycle facts so non-GUI regressions can assert them.

## Impact

- `packages/app-server/test-support/*` deterministic kernel and scenario helpers
- `packages/app-server/test/*` non-GUI integration coverage for LoopBus relay and compact follow-up
- `packages/app-server/src/*` runtime or kernel fixes only if the new regressions reveal a missing platform rule
