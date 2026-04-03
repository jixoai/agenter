## 1. Durable Message Identity

- [x] 1.1 Extend message-system types, persistence, and transport payloads with durable `senderActorId` support for room messages.
- [x] 1.2 Update app-server room send, snapshot, and paging paths so acting actor identity survives send-as, refresh, and reconnect.

## 2. Shared Chat Surface

- [x] 2.1 Extract the shared Svelte `ScrollView` primitive into a package that both `webui` and `web-chat-view` can consume.
- [x] 2.2 Upgrade `@agenter/web-chat-view` to use the shared `ScrollView`, accept explicit viewer actor identity, and align transcript rows from durable sender identity.

## 3. Message-system Operator Route

- [x] 3.1 Rebuild `messages-route` state so viewer selection and caller token are independent room-scoped facts resolved from canonical actor truth.
- [x] 3.2 Refactor `message-system-surface` into a chat-first layout with room management moved into a dialog-backed control surface.

## 4. Verification

- [x] 4.1 Add BDD/DOM regression coverage for duplicate-label actors, viewer switching, dialog-based room management, and shared scroll ownership.
- [x] 4.2 Run targeted typecheck and test suites for `message-system`, `web-chat-view`, and `webui`, then update the task checklist.
