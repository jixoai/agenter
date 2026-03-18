## Why

The chat projection still exposes the core conversation unit as `round` across app-server, client-sdk, realtime events, and TRPC. That conflicts with the rest of the kernel, which already uses `cycle` as the durable LoopBus unit. The mixed vocabulary creates avoidable confusion in product, API, and implementation layers.

## What Changes

- Rename the chat projection contract from `round` to `cycle` across app-server, client-sdk, and WebUI.
- Replace `chat.rounds` TRPC procedures with `chat.cycles`, and replace `runtime.round.updated` with `runtime.cycle.updated`.
- Update runtime snapshots and store projections to use `activeCycle`, `chatCyclesBySession`, and related cycle-first names.
- Remove the remaining WebUI chat implementation terms that still describe the timeline as rounds.

## Capabilities

### Modified Capabilities
- `chat-rounds-view`: rename the public contract to cycle terminology while preserving behavior and ordering semantics.

## Impact

- Affected packages: `@agenter/app-server`, `@agenter/client-sdk`, `@agenter/webui`
- Affected APIs: TRPC chat procedures, realtime runtime events, runtime snapshot/state types
- Affected UX: Chat labels, cycle rail labels, cycle-oriented debugging terminology
