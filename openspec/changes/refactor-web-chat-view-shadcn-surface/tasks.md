## 1. Shared chat surface

- [ ] 1.1 Refactor `packages/web-chat-view` so the transcript, notices, and composer form one durable conversation-first shell with `ScrollView` ownership and improved compact/desktop behavior.
- [ ] 1.2 Update `packages/web-chat-view` tests to cover the refactored transcript/composer shell and preserve websocket hydration, paging, and viewer-context behavior.

## 2. Operator message surface

- [ ] 2.1 Rebuild `packages/webui/src/lib/features/messages/message-system-surface.svelte` around a chat-first route layout with explicit viewer/send-as context and a dedicated responsive room-management surface.
- [ ] 2.2 Verify the message-system route still derives room actors, read progress, and send-as authority from canonical auth/profile and room state truth.

## 3. Canonical Svelte UI composition

- [ ] 3.1 Remove multipart alias-style exports/usages for `Card`, `Tabs`, and similar primitives in `packages/webui`, and migrate feature code to canonical shadcn-svelte composition.
- [ ] 3.2 Replace feature-layer layout patch stacks in `Messages`, `Terminals`, `Workspaces`, `History`, `Settings`, and runtime shells with explicit panel shells built from `flex`/`grid` plus shared `ScrollView`.

## 4. Verification and guardrails

- [ ] 4.1 Extend WebUI source-contract tests to fail on feature-layer `min-h-0` and multipart alias misuse, while preserving documented primitive-level exceptions.
- [ ] 4.2 Run targeted package tests and browser verification for `web-chat-view`, `Messages`, and the global system surfaces after the refactor.
