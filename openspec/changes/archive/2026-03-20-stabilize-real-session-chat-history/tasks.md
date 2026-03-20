## 1. Reproduce And Audit

- [x] 1.1 Build or capture one reproducible real-session fixture that includes long persisted history, attachments, and unread assistant replies
- [x] 1.2 Audit the current route-entry hydration, pagination, virtualization, and notification-consumption paths against that real-session fixture

## 2. Runtime And Client Stabilization

- [x] 2.1 Tighten session-local hydration so opening or resuming one session reliably loads persisted chat and cycle history without broad shell churn
- [x] 2.2 Harden client-sdk chat-state merging for persisted hydration, older-page prepends, and live runtime `chat.message` events
- [x] 2.3 Fix notification consumption boundaries so visible assistant replies are consumed correctly for paged and virtualized histories

## 3. Chat Viewport Hardening

- [x] 3.1 Stabilize the Chat viewport layout contract for long histories so virtualization cannot collapse or hide visible conversation rows
- [x] 3.2 Preserve optimistic, streamed, and attachment-bearing turns inside the same long-history conversation viewport
- [x] 3.3 Verify sticky-bottom and load-more behavior so prepending earlier pages does not lose the current reading position

## 4. Verification

- [x] 4.1 Add unit coverage for long-history hydration, chat-state merging, and notification-consumption boundaries
- [x] 4.2 Add Storybook DOM or browser-level coverage for long Chat histories, pagination, and attachment-bearing turns
- [x] 4.3 Run desktop and mobile walkthroughs against the real-session fixture, capture evidence, and record any remaining gaps before implementation sign-off
