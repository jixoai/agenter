## Why

`default` session Call #1115 exposed that attention protocol inputs are being stored in the bounded prompt window and replayed into later model calls. This makes `AttentionContexts.metadata` and historical `AttentionItems` appear multiple times, bloats provider requests, and turns focused attention from a current obligation signal into history replay.

## What Changes

- **BREAKING** Treat attention bootstrap protocol inputs as current-call transient inputs, not prompt-window memory.
- Directly inject newly committed focused attention item deltas into the current model call.
- Treat `AttentionContext` and `AttentionItems` as different protocol planes: context snapshots/diffs are injected at runtime boundaries, while item detail is injected only for in-flight current commits.
- Stop cursor fallback from injecting historical attention item batches merely because the runtime does not know what a previous model call saw.
- Focus state changes (`focused`, `background`, `muted`, and back to `focused`) update context projection and scheduling, but do not replay historical items.
- Context compaction and cold restart may rebuild the model-visible `AttentionContext` projection from fresh snapshots/diffs, but they do not replay historical `AttentionItems`.
- AI-authored attention tool commits mutate context scores/facts and do not become a new model-facing item reminder.
- Preserve provider request truth in `ai_call.request.messages`: the ledger still records what was actually sent to the provider, including transient inputs for that call.
- Keep historical attention facts queryable through attention CLI/API and persisted attention state.

## Capabilities

### New Capabilities

### Modified Capabilities

- `attention-bootstrap-protocol`: Attention `context` and `items` inputs are current-call protocol payloads, and focused item injection is limited to newly committed deltas.
- `attention-runtime-kernel`: Focused commits create active notification deltas; focus transitions do not imply item replay.
- `assistant-history-facts`: Bounded prompt-window memory excludes transient attention protocol inputs while `ai_call` retains provider request truth.
- `attention-prompt-window-compaction`: Compaction rewrites long-lived prompt memory only and must not rehydrate old attention protocol payloads.

## Impact

- Affected code: `packages/app-server/src/agenter-ai.ts`, `packages/app-server/src/session-runtime.ts`.
- Affected tests: `packages/app-server/test/agenter-ai.test.ts`, `packages/app-server/test/session-runtime.attention-system.test.ts`.
- Affected specs/docs: attention bootstrap, runtime kernel, prompt-window memory, app-server durable contract.
- No new external dependencies.
