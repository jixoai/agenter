## 1. Message-system typed record + APIs

- [ ] 1.1 Extend message-system types and storage schema to persist `kind` + typed payload (`text/error/interactive`).
- [ ] 1.2 Add control-plane methods + transport support for typed sends (normal text, interactive card, admin error).
- [ ] 1.3 Add/adjust message-system tests for role gating, persistence, and transport snapshots.

## 2. App-server and client wiring

- [ ] 2.1 Add TRPC procedures for `message.sendError` and `message.sendInteractive` with proper validation and access checks.
- [ ] 2.2 Wire kernel/session-runtime/client-store methods to the new procedures.
- [ ] 2.3 Ensure channel reply hooks continue producing only channel-appropriate user-visible text messages.

## 3. Web chat simplification

- [ ] 3.1 Update `web-chat-view` to render typed `text/error/interactive` message rows.
- [ ] 3.2 Implement interactive v1 submit-to-text behavior in chat UI.
- [ ] 3.3 Remove Chat transcript tool-call/tool-result rendering branches and keep technical tool views in Devtools.

## 4. Verification

- [ ] 4.1 Add/update Storybook DOM tests for typed message rows and interactive submit behavior.
- [ ] 4.2 Run impacted package verification (`typecheck`, targeted unit tests, targeted DOM tests).
