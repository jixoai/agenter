## 1. OpenSpec And Shared Shell Law

- [x] 1.1 Sync the new shell/window/icon/chat requirements into durable OpenSpec artifacts and project/package specs before closing implementation.
- [x] 1.2 Refactor the app shell and workbench chrome to remove the redundant top bar, remove manual refresh affordances, expose shared sidebar toggle control, and normalize objective workspace path formatting.

## 2. Typed Entity Icon Authority

- [x] 2.1 Extend profile-service, app-server, and client-sdk to support typed entity icon ownership with room icons as the first non-session/profile consumer.
- [x] 2.2 Wire room icons into Messages tabs, room transcript/avatar surfaces, and any related canonical actor or room identity UI.

## 3. Room Media Transport

- [x] 3.1 Add room-owned media upload/retrieval endpoints and storage helpers parallel to the existing session asset contract.
- [x] 3.2 Update global room send semantics so room messages persist attachment references from uploaded room asset ids and survive reload/reconnect.

## 4. Shared Chat Primitive Uplift

- [x] 4.1 Port the richer shared composer behavior into `@agenter/web-chat-view`, including CodeMirror input, attachment previews, toolbar/status/help affordances, and responsive layout.
- [x] 4.2 Port the richer shared message row behavior into `@agenter/web-chat-view`, including canonical avatars, improved bubbles, hover/context actions, and attachment rendering.
- [x] 4.3 Reconnect the Messages room route to the upgraded shared chat primitive and full room attachment flow without feature-local fallbacks.

## 5. Verification

- [x] 5.1 Add or update Storybook/unit/integration coverage for shell path semantics, typed room icons, shared chat composer/message behavior, and room attachment transport.
- [x] 5.2 Run targeted typecheck/tests/browser verification for the touched packages and record any remaining risks before marking the change complete.
