## 1. Platform Law

- [x] 1.1 Update durable specs to distinguish current attention-state projection from zero-valued commit-ledger settlement patches
- [x] 1.2 Record the breaking snapshot-law change that resolved current-state keys are omitted instead of retained as `0`

## 2. Core Implementation

- [x] 2.1 Prune zero-valued keys from `AttentionContext.scoreMap` during state construction and commit application while preserving zero-valued `commit.scores`
- [x] 2.2 Keep `done=true` and attention history/query flows emitting explicit zero-valued settlement patches without reintroducing zero-valued keys into current state

## 3. Verification

- [x] 3.1 Update attention-system and runtime tests to treat missing current-state keys as resolved projection
- [x] 3.2 Add regression coverage proving `done=true` and `minscore:0` still preserve settlement history after state pruning
