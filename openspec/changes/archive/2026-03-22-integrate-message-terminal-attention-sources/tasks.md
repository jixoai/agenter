## 1. Source adapter contracts

- [x] 1.1 Add OpenSpec proposal, design, and capability specs for message/terminal source adaptation
- [x] 1.2 Integrate message-system invalidation through the attention-source adapter path
- [x] 1.3 Integrate focused terminal invalidation through the attention-source adapter path

## 2. Cycle gating behavior

- [x] 2.1 Route source invalidations through attention ingestion before cycle gating
- [x] 2.2 Verify that no committed attention delta means no new cycle from that source activity alone
- [x] 2.3 Verify that policy hooks can still defer work after source-driven attention commits

## 3. Regression plan and tests

- [x] 3.1 Add app-server regression tests for message and focused-terminal attention invalidation flow
- [x] 3.2 Add focused message-system and terminal-system tests that support the adapter behavior
- [x] 3.3 Run cross-package verification and update this task list from verified results

## Execution Notes

- Land message and terminal adapters against the LoopBus runtime contract from `refactor-loopbus-attention-runtime`; do not fork runtime semantics here.
- Treat package-level tests as required unless the package has no adapter-visible logic, in which case record that result explicitly before checking the task.
- Do not mix terminal control-plane expansion into this change.
