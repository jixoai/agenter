## Why

`AttentionContext.scoreMap` currently keeps zero-valued score keys after a resolution commit. That mixes current-state projection with historical settlement residue, which makes the context snapshot look like a ledger instead of an unresolved-state view.

We need to separate those laws cleanly now because `done=true` and `minscore:0` already depend on explicit zero patches in commit history, while state consumers should only reason over still-unresolved scores.

## What Changes

- **BREAKING**: `AttentionContext.scoreMap` and derived context snapshots stop retaining resolved score keys with value `0`; missing keys become the canonical current-state representation of resolved work.
- Preserve zero-valued `commit.scores` entries in the immutable attention ledger so `done=true`, hash-history traversal, and widened history queries can still observe the settlement fact explicitly.
- Update runtime and test surfaces that currently assert `scoreMap[key] === 0` to instead treat absence as the resolved current-state projection.

## Capabilities

### New Capabilities

<!-- None. -->

### Modified Capabilities

- `attention-context-state`: current context score projection keeps only unresolved positive scores while immutable commit history still records explicit zero-valued resolution patches
- `runtime-skills-cli-surface`: `attention commit done=true` persists zero-valued resolution patches in the commit ledger without requiring the current context snapshot to retain zero-valued keys

## Impact

- Affected code: `packages/attention-system`, `packages/app-server`, and tests that inspect raw `scoreMap`
- Affected APIs: attention snapshots and any runtime/UI consumer that reads `AttentionContext.scoreMap` directly
- No new dependencies or transport protocols
