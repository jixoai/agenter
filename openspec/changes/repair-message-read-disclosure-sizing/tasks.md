## 1. Shared Popover Sizing Law

- [ ] 1.1 Add OpenSpec deltas for readable message read disclosure sizing

## 2. Implementation

- [ ] 2.1 Replace `Popover.Content` arbitrary width utilities with a durable sizing contract
- [ ] 2.2 Make `message-read-indicator` provide an explicit readable disclosure width through that contract
- [ ] 2.3 Add focused `@agenter/web-chat-view` coverage for the popover/read-disclosure sizing contract

## 3. Verification

- [ ] 3.1 Run targeted `@agenter/web-chat-view` tests and typecheck
- [ ] 3.2 Verify desktop and mobile room read disclosure screenshots show a readable card width
