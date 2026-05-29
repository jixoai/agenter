## 1. OpenSpec Alignment

- [x] 1.1 Create the `vision-driven` change on `main` using `bun run openspec:vision -- new fix-studio-web-chat-view-embedding-style`.
- [x] 1.2 Inspect the screenshot, Studio embedding code, shared Web Chat components, and existing OpenSpec specs before locking the plan.
- [x] 1.3 Write `plans/plan.md` as the current Intent Document SSOT.
- [x] 1.4 Write delta specs for shared Web Chat embedded style ownership and Studio message-surface consumption.

## 2. BDD First

- [ ] 2.1 Add a failing BDD/source contract proving `ChatAvatar` owns its geometry through component CSS instead of relying on Tailwind utility classes.
- [ ] 2.2 Add or extend a Storybook DOM contract proving an embedded Studio/Web Chat story keeps transcript avatars within normal chat-row bounds.
- [ ] 2.3 Run the targeted failing tests before implementation and record the failure in the self-review evidence.

## 3. Shared Component Fix

- [ ] 3.1 Replace `ChatAvatar` Tailwind-dependent geometry with scoped package-owned CSS and stable semantic classes.
- [ ] 3.2 Ensure avatar images, fallback initials, border radius, clipping, and host-provided extra class names remain bounded.
- [ ] 3.3 Audit obvious embedded transcript icon/image paths for the same class-generation dependency and fix only the ones needed for the visible regression.

## 4. Studio Embedding Verification

- [ ] 4.1 Run targeted Web Chat unit/contract tests.
- [ ] 4.2 Run targeted Studio Storybook DOM contract for `WebChatViewHost` or `MessageSystemSurface`.
- [ ] 4.3 Capture desktop and iPhone 14 screenshot evidence for the embedded Studio chat surface after the fix.
- [ ] 4.4 Confirm unrelated dirty files, especially `bun.lock`, were not staged or rewritten by this change.

## 5. Vision Self-Review

- [ ] 5.1 Run `bun run openspec:vision -- validate fix-studio-web-chat-view-embedding-style`.
- [ ] 5.2 Run `bun run openspec:vision -- check fix-studio-web-chat-view-embedding-style` after implementation and review artifacts exist.
- [ ] 5.3 Produce `review/self-review.html` with deviation list, new user-confirmation questions, screenshots/evidence paths, commit evidence, and exit judgment.
- [ ] 5.4 Commit OpenSpec artifact updates separately from implementation changes, and only check off tasks completed and verified in the current context.
