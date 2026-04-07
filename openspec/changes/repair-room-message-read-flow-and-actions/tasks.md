## 1. Read Flow Law

- [x] 1.1 Add OpenSpec deltas for monotonic mark-read acknowledgement, per-message read disclosure, and restored shared row actions
- [x] 1.2 Sync the relevant durable specs after implementation so the repaired message interaction law becomes repository truth

## 2. Message Read Interaction

- [x] 2.1 Repair the room route mark-read callback so repeated observer churn does not re-send `message.globalMarkRead` for the same or older message
- [x] 2.2 Extend shared read-progress data and `MessageReadIndicator` so each message can disclose canonical `read` and `unread` actor lists

## 3. Shared Message Row Actions

- [x] 3.1 Restore shared built-in and host-provided message actions in `message-row.svelte`
- [x] 3.2 Re-enable the shared context-menu / hover action affordances without reviving the previous floating-layer crash path

## 4. Verification

- [x] 4.1 Add focused tests for monotonic mark-read behavior, read disclosure rendering, and shared row actions
- [ ] 4.2 Run targeted typecheck/tests plus browser verification for the Messages room route
  - Blocked on existing browser bootstrap failure in `packages/webui/tests/e2e/system-surfaces.e2e.ts`: `authenticateWithManagedKey` never reaches the `Avatars` heading on either desktop or mobile.
