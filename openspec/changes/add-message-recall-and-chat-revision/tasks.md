## 1. Message Revision Platform Law

- [x] 1.1 Extend `message-system` types, storage, and authorization with durable `recall` support and explicit recalled-message metadata
- [x] 1.2 Complete the runtime/tool/transport contract for `send`, `edit`, and `recall`, including CLI/runtime descriptors and room skill guidance
- [x] 1.3 Add backend tests covering authorized edit, authorized recall, rejection of cross-sender mutation, and same-`messageId` lifecycle upserts

## 2. Shared Chat Rendering

- [x] 2.1 Update `web-chat-view` merge and row rendering so edited or recalled message updates replace the existing row objectively
- [x] 2.2 Wire the room route and any required host helpers to surface edited/recalled message truth without synthetic follow-up rows
- [x] 2.3 Add UI/unit/DOM coverage for edited and recalled transcript rendering

## 3. Real-Provider Validation

- [x] 3.1 Add a real-provider validation flow for draft -> verify -> edit same message without naming the `edit` command
- [x] 3.2 Add a real-provider validation flow for draft -> recall -> send final without naming the `recall` command
- [x] 3.3 Capture objective `.chat` evidence that distinguishes `send + send`, `send + edit`, and `send + recall + send`

## 4. Verification and Durable Follow-Through

- [x] 4.1 Run targeted backend/client/frontend tests for the new message-revision contract
- [x] 4.2 Run the real-provider walkthroughs and inspect the produced room evidence before reporting completion
- [x] 4.3 Sync any affected durable specs or docs before declaring the change ready for archive
