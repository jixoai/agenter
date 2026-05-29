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
- [x] 6.3 Add a failing BDD/source contract proving the read indicator trigger sizing works across a Framework7 component root boundary.
- [x] 6.4 Add or extend a Storybook DOM contract proving discloseable read indicators stay within normal inline bounds in an embedded Studio/Web Chat story.
- [x] 6.5 Fix `MessageReadIndicator` so trigger, SVG ring, and check icon geometry are package-owned and do not depend on Svelte scoped CSS attaching to an external component root.
- [x] 6.6 Run targeted Web Chat unit/contract tests.
- [x] 6.7 Run targeted Studio Storybook DOM contract for `WebChatViewHost`.
- [x] 6.8 Capture live Studio route evidence from `bun agenter studio --dev` or the active local dev URL when available.
- [x] 6.9 Update self-review with Round 2 deviations, screenshots, and exit judgment before committing the review update.

## 7. Round 3 Architecture / Build-Style-Loss Investigation

- [x] 7.1 Back up the Round 2 intent document before changing `plans/plan.md`.
- [x] 7.2 Stop local CSS patching and record the user concern that the remaining issue may be Framework7 shell/build architecture, not individual component geometry.
- [x] 7.3 Start the full `web-chat-view` review shell on current `main` and repair only non-visual harness API drift needed to make it enter chat state.
- [x] 7.4 Capture desktop and iPhone 14 evidence from the full review shell.
- [x] 7.5 Compare the full review shell component topology with Studio's `MessageSystemSurface` embed topology.
- [x] 7.6 Add BDD/source contracts proving Studio must consume an explicit Web Chat island/shell boundary rather than mounting the leaf `WebChatViewHost` as a whole product surface.
- [x] 7.7 Clean the lingering `Actor -> Contact` terminology residue in the Studio/Web Chat surface code and visible copy.
- [x] 7.8 Decide with the user whether the implementation boundary is iframe/custom element or direct Svelte Framework7 island.
- [x] 7.9 Implement the chosen boundary and remove any Studio-local style workarounds that become unnecessary.
- [x] 7.10 Re-run desktop and iPhone 14 live-route evidence against Studio and compare it with the full review shell.
- [x] 7.11 Normalize the `app-view` product name across the review shell entrypoint docs and visible title copy.
- [x] 7.12 Update self-review with deviation list, retained/reverted Round 1/2 decisions, and future task list before committing.
