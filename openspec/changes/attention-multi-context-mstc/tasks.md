## 1. Attention-item M+S+T+C model

- [x] 1.1 Add spec `attention-item-mstc` defining M+S+T+C structure and scoring semantics
- [x] 1.2 Implement `attention-item.ts` types (AttentionItemMeta, AttentionItem, AttentionItemInput)
- [x] 1.3 Implement `attention-context.ts` (AttentionContext class with add, adjustScores, updateItem, getActive, queryByHash, queryRelated, onChange, snapshot)
- [x] 1.4 Add tests for AttentionContext matching spec scenarios (12 tests)

## 2. Multi-context management

- [x] 2.1 Add spec `attention-multi-context` defining multi-context lifecycle and cross-context queries
- [x] 2.2 Implement `attention-system.ts` (AttentionSystem class with createContext, addItem, getAllActive, queryByHash, subscribe, snapshot/fromSnapshot)
- [x] 2.3 Add tests for AttentionSystem matching spec scenarios (7 tests)

## 3. Persistence and compatibility

- [x] 3.1 Upgrade `attention-store.ts` with V2 snapshot format and V1→V2 migration
- [x] 3.2 Rewrite `attention-engine.ts` as facade delegating to AttentionSystem default context
- [x] 3.3 Update `index.ts` exports
- [x] 3.4 Verify existing `attention-engine.test.ts` passes unchanged (2 tests pass)

## 4. Context subscription

- [x] 4.1 Add spec `attention-context-subscription` defining subscription semantics
- [x] 4.2 Implement subscribe method on AttentionSystem
- [x] 4.3 Add tests for subscription matching spec scenarios (4 tests)

## 5. Verification

- [x] 5.1 Run `bun run typecheck` — packages with typecheck scripts pass (attention-system has no tsconfig)
- [x] 5.2 Run `bun run test` — attention-system: 25 pass, 0 fail. Pre-existing failures in terminal-system (1) and app-server (2) are unrelated.
- [x] 5.3 Update this task list from verified results

## Execution Notes

- Complete section 1 before section 2 (AttentionSystem depends on AttentionContext).
- Complete sections 1-2 before section 3 (facade depends on both).
- Section 4 can proceed in parallel with section 3.
- Update checkboxes only from verified test results.
