## Why

Once LoopBus itself is split into a dedicated runtime refactor, the source-specific work also needs its own change. Message-system and terminal-system are not part of LoopBus core; they are first-party adapters that feed attention and therefore need their own design, migration rules, and tests. Keeping them separate makes the architecture clearer and gives the testing plan a proper home.

## What Changes

- Integrate message-system and terminal-system with the attention-first LoopBus runtime through explicit source adapters.
- Route message and focused-terminal invalidations through attention ingestion before cycle gating.
- Define the adapter-side testing plan across app-server, message-system, and terminal-system.
- Keep source integration work separate from LoopBus core runtime and from the broader terminal control-plane expansion.

## Capabilities

### New Capabilities
- `attention-source-plugins`: source adapters that convert message and terminal invalidations into attention updates before LoopBus decides whether to start a cycle.
- `source-adapter-regression-plan`: a dedicated regression and verification plan for message/terminal adaptation.

### Modified Capabilities
- `terminal-control-plane`: focused terminal changes participate in the attention-source pipeline used by LoopBus.

## Impact

- Affected code: `packages/app-server`, `packages/message-system`, `packages/terminal-system`, and touch points into `packages/attention-system`.
- Affected APIs: source adapter contracts, message/terminal invalidation flow, focused terminal behavior, and adapter-oriented test plans.
- Affected tests: app-server integration tests, message-system tests, terminal-system tests, and cross-package regression coverage for source ingestion.

## Delivery Order

1. Consume the LoopBus plugin runtime from `refactor-loopbus-attention-runtime`.
2. Land message and focused-terminal source adapters without expanding terminal control-plane scope.
3. Verify no-delta/no-cycle and deferred-cycle behavior.
4. Hand terminal API expansion and transport work to `modernize-terminal-control-plane`.
