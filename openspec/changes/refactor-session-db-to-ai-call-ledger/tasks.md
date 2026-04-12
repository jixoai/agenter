## 1. OpenSpec and contract alignment

- [x] 1.1 Finalize the `session-ai-call-ledger` change artifacts and confirm the removal scope for legacy session-db tables
- [x] 1.2 Update durable specs and package-level specs that still describe `session_cycle`, `prompt_window_state`, or session-db-owned telemetry as current truth

## 2. Session-system schema rewrite

- [x] 2.1 Replace legacy `SessionDb` types with the new `message_parts` and `ai_call` ledger types
- [x] 2.2 Rebuild `packages/session-system/src/session-db.ts` around the new schema, streaming updates, grouped message reconstruction, and two-round AI-call retention
- [x] 2.3 Remove obsolete session-db APIs and tests for cycle, prompt-window, trace, state-log, and session-owned telemetry tables

## 3. App-server persistence refactor

- [x] 3.1 Rewrite `session-runtime.ts` write paths so model requests, streamed assistant output, and compact cycles populate the new ledger
- [x] 3.2 Replace `app-kernel.ts` persisted read paths and public inspection APIs that still depend on legacy session-db tables
- [x] 3.3 Cut or rewrite realtime/public contracts that expose session-owned cycle/trace persistence instead of the new ledger vocabulary

## 4. Verification

- [x] 4.1 Update unit and integration tests for `session-system` and `app-server` to assert against the new ledger
- [x] 4.2 Add or update cold-restart coverage to prove prompt reconstruction works without legacy cycle tables
- [x] 4.3 Run real-AI validation for streamed calls, compaction rotation, and cold restart against the new persistence model
