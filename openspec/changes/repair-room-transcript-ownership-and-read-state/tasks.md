## 1. Platform Law

- [x] 1.1 Add OpenSpec deltas for explicit room sender identity, shared transcript row primitives, and per-message read arrays
- [x] 1.2 Update durable package/project specs after implementation so the breaking read-state law becomes part of repository truth

## 2. Room Transcript And Send Path

- [x] 2.1 Carry `sendAsActorId` from the Messages room route through client-sdk and tRPC into `AppKernel.sendGlobalRoomMessage(...)`
- [x] 2.2 Validate sender identity against room credential usage and persist stable `senderActorId`
- [x] 2.3 Repair `@agenter/web-chat-view` message rows to use one bubble surface, a real `ContextMenu`, and CodeMirror-based message rendering

## 3. Message Read-State Breaking Upgrade

- [x] 3.1 Replace `chat_read_state` durability with per-message `readActorIds` / `unreadActorIds` arrays in `message-system`
- [x] 3.2 Update room projections and webui read indicators to resolve from per-message arrays instead of seat cursors
- [x] 3.3 Make latest-visible read acknowledgement actor-scoped and merge it with durable message read floors before emitting `globalMarkRead`

## 4. Verification

- [x] 4.1 Update targeted unit/integration tests for sender identity and read-state durability
- [x] 4.2 Run focused typecheck/tests for `message-system`, `app-server`, `web-chat-view`, and `webui`
- [x] 4.3 Verify in the browser that an idle Room view does not repeatedly emit `/trpc/message.globalMarkRead` for an already-read latest visible message
