## Why

The current attention model mixes three responsibilities into one object: context state, commit history, and output side effects. That makes the runtime stop early, makes scores hard to reason about, and keeps the AI tool surface larger than necessary.

## What Changes

- **BREAKING** replace the current item-centric attention model with a context-plus-commit model.
- **BREAKING** expose a single AI-facing `attention_commit` tool instead of `attention_item_append` / `attention_item_patch`.
- Make active debt a property of `attention-context.scoreMap`, not of the latest matching item revision.
- Make LoopBus collect and schedule active contexts instead of active items.
- Persist attention state as immutable commit history plus mutable context heads.

## Capabilities

### New Capabilities
- `attention-context-state`: maintain mutable context state (`content`, `scoreMap`, `headCommitId`) with immutable commit history.
- `attention-commit-tool`: AI-facing attention tool that submits one commit with summary, score mutations, and context change.

### Modified Capabilities
- `attention-runtime-scheduling`: LoopBus wakes from active contexts instead of active items.
- `attention-runtime-persistence`: runtime snapshots and session cycle extensions store context heads and commit logs.

## Impact

- Affected code: `packages/attention-system`, `packages/app-server`, `packages/session-system`, `packages/client-sdk`.
- Affected prompts and tooling: AI tool catalog, runtime prompt text, model-call persistence.
- Verification: unit/integration tests for context state transitions, loop wake conditions, and single-tool commit semantics.
