## 1. Message-system Schema And Contracts

- [x] 1.1 Add durable `actor_state` and `actor_room_state` tables plus the breaking-reset migration path for the new unread model
- [x] 1.2 Remove `attentionState` from message-system message types, SQLite rows, transport payloads, and room projections
- [x] 1.3 Update authorized send, mark-read, grant, and revoke flows so frozen message arrays and actor unread aggregates mutate transactionally together
- [x] 1.4 Expose unread room summary reads and cancellable unread subscription / wait handles from `message-control-plane`

## 2. Runtime Unread Ingress And WaitUntil Scheduling

- [x] 2.1 Refactor `session-runtime` unread ingress to select work from actor unread summaries instead of scanning room rows for AI queue markers
- [x] 2.2 Enforce `message.maxFocusedRoomCount` and `message.maxBatchReadRoomMessageCount` when selecting unread room slices for one cycle
- [x] 2.3 Mark selected unread room messages as read only when a real outbound model request is dispatched, while keeping unresolved attention debt active on later failure
- [x] 2.4 Compose message unread subscriptions into the runtime `waitUntil(...)` loop alongside task, terminal, and attention-debt wake handles, and cancel losing waiters after each race

## 3. Projections, Tests, And Cleanup

- [x] 3.1 Update app-server, WebUI, and web-chat-view projections to stop depending on durable `attentionState`
- [x] 3.2 Add regression coverage for restart replay, relay rooms, joined-later readers, revoked room access, and unread subscription wake behavior
- [x] 3.3 Run targeted typecheck / test suites and archive any obsolete queued-message assumptions from specs or code comments
