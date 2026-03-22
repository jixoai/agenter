## Why

The current `session.stop` path destroys the runtime, terminals, and cycle inspection state in one step. That conflicts with the intended architecture: pausing LoopBus and canceling the current model call is not the same operation as tearing the whole runtime down. The product now needs two explicit lifecycle actions so Chat, Devtools, and terminal surfaces can behave predictably.

## What Changes

- Split session lifecycle into `stop` and `abort` instead of treating both as one destructive stop.
- Preserve runtime-owned resources on `stop`, while still canceling the active LoopBus/model work.
- Add explicit paused session semantics through app-server, client-sdk, and WebUI.
- Keep `abort` as the destructive runtime teardown path for terminals, message-system bindings, and future session-scoped systems.

## Capabilities

### New Capabilities
- `session-pause-abort-lifecycle`: sessions support non-destructive pause and destructive abort as separate lifecycle operations.

### Modified Capabilities
- `workspace-chat-surface`: the primary session action reflects paused vs stopped semantics.
- `workspace-devtools-surface`: inspection continues to work after non-destructive stop.

## Impact

- Affected code: `packages/app-server`, `packages/client-sdk`, `packages/webui`.
- Affected APIs: session tRPC procedures, session status types, runtime snapshot publication, and toolbar behavior.
- Affected tests: lifecycle integration tests, runtime-store reducers, and WebUI session toolbar regression coverage.
