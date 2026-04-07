## Why

The current room transcript still violates the read-interaction law after the earlier read-state rebuild. The frontend repeatedly calls `message.globalMarkRead` for the same visible message, per-message read rings still hide the actual read/unread actor breakdown, and shared message-row actions are still absent after the previous crash containment rollback.

These are not isolated cosmetic defects. They mean the read pipeline is still treating transient viewport churn as durable progress, and the shared transcript row has not fully returned to its intended interaction contract.

## What Changes

- Repair the room read acknowledgement path so `globalMarkRead` advances monotonically per room seat instead of resetting on transient `null` visibility churn.
- Extend the shared per-message read indicator into a disclosure surface that shows canonical `read` and `unread` actor lists for that specific message.
- Restore shared message-row local actions through stable hover and context-menu affordances without reviving the earlier floating-layer crash path.
- Add focused regression coverage for monotonic mark-read behavior, message read disclosure rendering, and shared row action affordances.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `message-read-state`: clarify that client-side mark-read acknowledgement is monotonic and that message-level read disclosures expose the frozen actor breakdown behind each message.
- `web-chat-view`: restore shared row actions and add a message-level read disclosure surface anchored to the inline-end read indicator.
- `message-system-surface`: resolve read/unread disclosure entries from canonical actor truth for each room message.

## Impact

- `packages/webui/src/lib/features/messages`
- `packages/web-chat-view/src`
- `packages/web-chat-view/test`
- `openspec/specs/message-read-state/spec.md`
- `openspec/specs/web-chat-view/spec.md`
- `openspec/specs/message-system-surface/spec.md`
