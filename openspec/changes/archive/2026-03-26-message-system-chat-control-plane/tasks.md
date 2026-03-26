## 1. Control plane

- [x] 1.1 Add delta spec `message-chat-control-plane`
- [x] 1.2 Replace the queue-based message-system with `MessageControlPlane`
- [x] 1.3 Add SQLite-backed channel/message persistence and reverse-time paging
- [x] 1.4 Add focus semantics and subscriptions

## 2. Transport

- [x] 2.1 Add chat transport server and `ws://HOST:PORT/chat/$CHAT_ID` endpoint discovery
- [x] 2.2 Add chat snapshot and incremental event protocol

## 3. Verification

- [x] 3.1 Add tests for channel lifecycle, paging, focus, and transport
- [x] 3.2 Prove `chat-*` and `room-*` invariants in tests
