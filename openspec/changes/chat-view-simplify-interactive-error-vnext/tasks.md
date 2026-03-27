## 1. Message-system typed record + APIs

- [x] 1.1 Extend message-system types and storage schema to persist `kind` + typed payload (`text/error/interactive`).
- [x] 1.2 Add control-plane methods + transport support for typed sends (normal text, interactive card, admin error).
- [x] 1.3 Add/adjust message-system tests for role gating, persistence, and transport snapshots.

## 2. App-server and client wiring

- [x] 2.1 Add TRPC procedures for `message.sendError` and `message.sendInteractive` with proper validation and access checks.
- [x] 2.2 Wire kernel/session-runtime/client-store methods to the new procedures.
- [x] 2.3 Ensure channel reply hooks continue producing only channel-appropriate user-visible text messages.

## 3. Web chat simplification

- [x] 3.1 Update `web-chat-view` to render typed `text/error/interactive` message rows.
- [x] 3.2 Implement interactive v1 submit-to-text behavior in chat UI.
- [x] 3.3 Remove Chat transcript tool-call/tool-result rendering branches and keep technical tool views in Devtools.

## 4. Verification

- [x] 4.1 Add/update Storybook DOM tests for typed message rows and interactive submit behavior.
- [x] 4.2 Run impacted package verification (`typecheck`, targeted unit tests, targeted DOM tests).
