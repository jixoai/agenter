## 1. OpenSpec And Contracts

- [x] 1.1 Add change artifacts for attention message consumption lifecycle, focus decoupling, and compact replay removal.
- [x] 1.2 Sync the affected main specs so the new platform law is visible outside the change folder.

## 2. Kernel And Control Planes

- [x] 2.1 Extend `LoopBusPluginRuntime` with `attentionShouldLoad` and deferred invalidation retention.
- [x] 2.2 Upgrade `message-system` with queued/read lifecycle fields plus queued-message editing.
- [x] 2.3 Upgrade `session-system` chat persistence to store message lifecycle by `message_id`.
- [x] 2.4 Update `session-runtime` to load chat input through the new lifecycle and stop auto-focusing tabs.
- [x] 2.5 Remove compact ready-reply replay from `AgenterAI`.

## 3. UI Adaptation

- [x] 3.1 Upgrade `web-chat-view` with pending queue, transcript ordering by visibility, and unread edit support.
- [x] 3.2 Update `webui` chat and terminal routes so selection no longer mutates focus and compact cycles render as distinct special rounds.

## 4. Verification

- [x] 4.1 Add backend tests for `attentionShouldLoad`, message lifecycle transitions, queued editing, and compact no-replay behavior.
- [x] 4.2 Add UI tests for pending queue rendering, explicit focus toggles, and unread badges.
- [x] 4.3 Run targeted package tests plus real AI loopbus scenarios against the upgraded runtime.
