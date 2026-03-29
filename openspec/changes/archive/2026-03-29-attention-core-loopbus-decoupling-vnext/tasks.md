- [x] 1. Finalize the OpenSpec contract for attention-core decoupling
  - Add proposal, design, and spec deltas for the prompt-window compaction model and the removal of legacy core output contracts.

- [x] 2. Refactor backend core contracts
  - Remove `chat/task/output` response contracts from `AgenterAI`, `LoopBus`, and `AgentRuntime`.
  - Replace assistant-history/task-stage concepts with prompt-window and compact-summary semantics.

- [x] 3. Keep runtime and frontend projections working on top of the new core
  - Adapt `SessionRuntime`, `AppKernel`, client-facing model debug payloads, and WebUI inspectors/status views.
  - Remove assumptions about legacy LoopBus phases or model debug field names.

- [x] 4. Rebuild verification around the new contracts
  - Update backend unit/integration coverage, including real-model scenarios.
  - Run frontend regression tests and browser walkthroughs for desktop and mobile.
