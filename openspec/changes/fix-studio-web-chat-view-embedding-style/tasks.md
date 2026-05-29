## 1. OpenSpec Alignment

- [x] 1.1 Create the `vision-driven` change on `main` using `bun run openspec:vision -- new fix-studio-web-chat-view-embedding-style`.
- [x] 1.2 Inspect the screenshot, Studio embedding code, shared Web Chat components, and existing OpenSpec specs before locking the plan.
- [x] 1.3 Write `plans/plan.md` as the current Intent Document SSOT.
- [x] 1.4 Write delta specs for shared Web Chat embedded style ownership and Studio message-surface consumption.

## 2. BDD First

- [x] 2.1 Add a failing BDD/source contract proving `ChatAvatar` owns its geometry through component CSS instead of relying on Tailwind utility classes.
- [x] 2.2 Add or extend a Storybook DOM contract proving an embedded Studio/Web Chat story keeps transcript avatars within normal chat-row bounds.
- [x] 2.3 Run the targeted failing tests before implementation and record the failure in the self-review evidence.

## 3. Shared Component Fix

- [x] 3.1 Replace `ChatAvatar` Tailwind-dependent geometry with scoped package-owned CSS and stable semantic classes.
- [x] 3.2 Ensure avatar images, fallback initials, border radius, clipping, and host-provided extra class names remain bounded.
- [x] 3.3 Audit obvious embedded transcript icon/image paths for the same class-generation dependency and fix only the ones needed for the visible regression.

## 4. Studio Embedding Verification

- [x] 4.1 Run targeted Web Chat unit/contract tests.
- [x] 4.2 Run targeted Studio Storybook DOM contract for `WebChatViewHost` or `MessageSystemSurface`.
- [x] 4.3 Capture desktop and iPhone 14 screenshot evidence for the embedded Studio chat surface after the fix.
- [x] 4.4 Confirm unrelated dirty files, especially `bun.lock`, were not staged or rewritten by this change.

## 5. Vision Self-Review

- [x] 5.1 Run `bun run openspec:vision -- validate fix-studio-web-chat-view-embedding-style`.
- [x] 5.2 Run `bun run openspec:vision -- check fix-studio-web-chat-view-embedding-style` after implementation and review artifacts exist.
- [x] 5.3 Produce `review/self-review.html` with deviation list, new user-confirmation questions, screenshots/evidence paths, commit evidence, and exit judgment.
- [x] 5.4 Commit OpenSpec artifact updates separately from implementation changes, and only check off tasks completed and verified in the current context.

## 6. Round 2 Read Indicator Fix

- [x] 6.1 Back up the Round 1 intent document before changing `plans/plan.md`.
- [x] 6.2 Record live Studio evidence that the remaining giant circles are read-progress SVG rings, not avatars.
- [ ] 6.3 Add a failing BDD/source contract proving the read indicator trigger sizing works across a Framework7 component root boundary.
- [ ] 6.4 Add or extend a Storybook DOM contract proving discloseable read indicators stay within normal inline bounds in an embedded Studio/Web Chat story.
- [ ] 6.5 Fix `MessageReadIndicator` so trigger, SVG ring, and check icon geometry are package-owned and do not depend on Svelte scoped CSS attaching to an external component root.
- [ ] 6.6 Run targeted Web Chat unit/contract tests.
- [ ] 6.7 Run targeted Studio Storybook DOM contract for `WebChatViewHost`.
- [ ] 6.8 Capture live Studio route evidence from `bun agenter studio --dev` or the active local dev URL when available.
- [ ] 6.9 Update self-review with Round 2 deviations, screenshots, and exit judgment before committing the review update.
