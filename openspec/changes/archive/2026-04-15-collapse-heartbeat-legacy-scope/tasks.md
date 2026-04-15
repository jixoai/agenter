## 1. Spec sync

- [x] 1.1 Add OpenSpec deltas that explicitly remove `scope=heartbeat` from the Heartbeat durable contract.
- [x] 1.2 Record the single-scope migration plan and affected projection surfaces in this change.

## 2. Persistence collapse

- [x] 2.1 Remove `heartbeat` from `SessionMessageScope` and delete legacy Heartbeat helper/constants.
- [x] 2.2 Persist focused ingress / compact / other non-`ai_call` Heartbeat facts directly as `scope=heartbeat_part`.
- [x] 2.3 Ensure assistant response persistence stays single-write through the structured Heartbeat-part path.

## 3. Projection collapse

- [x] 3.1 Update session-runtime and app-kernel persisted readers so Heartbeat/cycle/chat projections no longer read `scope=heartbeat`.
- [x] 3.2 Rebuild projected chat/cycle rows from canonical `heartbeat_part` messages and `ai_call` linkage.

## 4. Regression and verification

- [x] 4.1 Update `session-system`, `app-server`, and `client-sdk` tests to assert the single-scope Heartbeat contract.
- [x] 4.2 Run focused typecheck/tests and a real runtime verification to confirm Heartbeat still hydrates, streams, and projects cycles after the legacy scope is removed.
