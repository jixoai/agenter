## 1. Native model

- [x] 1.1 Add delta spec `attention-native-context-graph`
- [x] 1.2 Replace `attention-item.ts` and `attention-types.ts` with native graph-first types
- [x] 1.3 Rewrite `attention-context.ts` to support append/patch/fork/merge/query semantics
- [x] 1.4 Rewrite `attention-system.ts` to expose native context/item APIs and subscriptions

## 2. Persistence and migration

- [x] 2.1 Upgrade `attention-store.ts` to persist version 3 snapshots
- [x] 2.2 Add V1 and V2 migration coverage
- [x] 2.3 Remove `AttentionEngine` from exports and callers

## 3. Verification

- [x] 3.1 Add native graph tests for lineage, query depth, and score threshold semantics
- [x] 3.2 Update dependent tests and facts serialization callers
