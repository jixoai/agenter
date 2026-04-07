## 1. Read Flow Law

- [ ] 1.1 Add OpenSpec deltas for monotonic mark-read acknowledgement, per-message read disclosure, and restored shared row actions
- [ ] 1.2 Sync the relevant durable specs after implementation so the repaired message interaction law becomes repository truth

## 2. Message Read Interaction

- [ ] 2.1 Repair the room route mark-read callback so repeated observer churn does not re-send `message.globalMarkRead` for the same or older message
- [ ] 2.2 Extend shared read-progress data and `MessageReadIndicator` so each message can disclose canonical `read` and `unread` actor lists

## 3. Shared Message Row Actions

- [ ] 3.1 Restore shared built-in and host-provided message actions in `message-row.svelte`
- [ ] 3.2 Re-enable the shared context-menu / hover action affordances without reviving the previous floating-layer crash path

## 4. Verification

- [ ] 4.1 Add focused tests for monotonic mark-read behavior, read disclosure rendering, and shared row actions
- [ ] 4.2 Run targeted typecheck/tests plus browser verification for the Messages room route
