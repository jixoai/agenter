## 1. LoopBus runtime core

- [x] 1.1 Add OpenSpec proposal, design, and capability specs for the LoopBus-only runtime refactor
- [x] 1.2 Implement LoopBus plugin/runtime primitives with explicit hook kinds, ordering, and cycle gating
- [x] 1.3 Add backend tests for LoopBus runtime semantics and lifecycle ordering

## 2. Runtime publication contract

- [x] 2.1 Define runtime snapshot and realtime publication contracts for the refactored LoopBus model
- [x] 2.2 Update client-sdk runtime-store consumers for LoopBus-facing runtime state and traces
- [x] 2.3 Update WebUI LoopBus/devtools surfaces and add Storybook DOM or focused UI tests

## 3. Verification

- [x] 3.1 Run targeted app-server, client-sdk, and webui tests for the LoopBus runtime/publication slice
- [x] 3.2 Fix regressions and update this task list from verified results

## Execution Notes

- Complete section 1 before landing source-adapter work in `integrate-message-terminal-attention-sources`.
- Complete section 2 before removing frontend compatibility assumptions in `propagate-terminal-contract-to-clients`.
- Update checkboxes only from verified test or walkthrough results.
