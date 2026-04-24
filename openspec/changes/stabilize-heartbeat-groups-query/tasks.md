## 1. Reproduction

- [x] 1.1 Add a backend regression that reproduces deep-history `heartbeatGroupsPage` pressure and fails when the first grouped page still depends on full-history materialization.
- [x] 1.2 Add a client regression that proves grouped Heartbeat cold hydration and refresh settle explicitly instead of remaining indefinitely loading.

## 2. Implementation

- [x] 2.1 Extract a bounded Heartbeat grouped-query module so storage paging and grouped projection are independently testable.
- [x] 2.2 Update `SessionDb` paging/bounded-read helpers so Heartbeat queries no longer use `select all -> JS slice` on `ai_call` or inspection rows.
- [x] 2.3 Rewire `app-kernel` / runtime router to the bounded grouped-query path while preserving `before-call`, `call`, `compact`, and `before-call-pending` semantics.

## 3. Verification

- [x] 3.1 Run targeted `bun test` coverage for `@agenter/app-server` and `@agenter/client-sdk` Heartbeat scenarios.
- [x] 3.2 Run a real Heartbeat walkthrough and record that the page opens without startup memory blow-up or persistent `Loading Heartbeat…`.
- [x] 3.3 Sync any durable contract changes back into `SPEC.md` / package specs before declaring the fix complete.
