## Why

The backend terminal contract can only become real product behavior once runtime snapshots, realtime events, client-sdk state, and WebUI surfaces all consume it consistently. Right now those layers still rely on compatibility fields and older assumptions about focused terminals and terminal reads. That mismatch raises migration risk and leaves the user-facing product one step behind the backend architecture.

## What Changes

- Promote `focusedTerminalIds` to the primary runtime/client contract while preserving a temporary derived compatibility field only where required.
- Propagate explicit terminal read representation metadata through runtime events, client-sdk stores, and WebUI consumers.
- Update WebUI terminal/devtools surfaces so they consume the new focus/read contracts directly instead of relying on backend shims.
- Add focused regression coverage in client-sdk and WebUI, including Storybook DOM tests for terminal/devtools surfaces.

## Capabilities

### New Capabilities
- `runtime-terminal-contract`: runtime snapshots and realtime events publish focused-terminal sets and terminal read representation metadata as first-class fields.

### Modified Capabilities
- `workspace-devtools-surface`: Devtools consumes the new terminal contract without relying on legacy diff aliases or single-focus assumptions.
- `overflow-layout-contract`: terminal/devtools panels preserve one stable scroll owner while adapting to the new terminal surface behavior.

## Impact

- Affected code: `packages/app-server`, `packages/client-sdk`, `packages/webui`.
- Affected APIs: runtime snapshot payloads, realtime terminal events, client-sdk runtime store contracts, and terminal/devtools UI adapters.
- Affected tests: runtime-store tests, WebUI unit tests, Storybook DOM tests for terminal/devtools surfaces.

## Delivery Order

1. Consume LoopBus/runtime publication changes from `refactor-loopbus-attention-runtime`.
2. Consume the canonical terminal payloads emitted by `modernize-terminal-control-plane`.
3. Remove client/store/UI reliance on legacy single-focus and diff-alias assumptions.
4. Leave renderer extraction itself to `extract-terminal-view-webcomponent`.
