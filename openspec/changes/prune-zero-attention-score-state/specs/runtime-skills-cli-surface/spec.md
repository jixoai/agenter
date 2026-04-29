## MODIFIED Requirements

### Requirement: Runtime-local attention commit SHALL preserve done semantics across tool surfaces
When a runtime-local attention commit request marks a context as done without explicit score overrides, the runtime SHALL resolve that context's current active score keys to zero in the persisted commit ledger. The current context projection MAY prune those resolved keys from `scoreMap` as long as the context no longer presents them as active unresolved work.

#### Scenario: Done resolves active scores even through CLI/API
- **GIVEN** context `ctx-chat-main` currently has unresolved attention scores
- **WHEN** the runtime-local API receives an `attention commit` request with `contextId=ctx-chat-main`, `summary="done"`, `done=true`, and no explicit `scores`
- **THEN** the persisted commit sets each active score key in that context to `0`
- **AND** the context is no longer returned as active attention work
- **AND** the current context projection does not need to retain zero-valued keys in `scoreMap`
