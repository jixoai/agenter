## 1. Alignment / Investigation

- [x] 1.1 Confirm `plans/plan.md` records the latest user requirements verbatim, the prior archived app-view change, and the repo evidence for identity, comment, action, and Framework7 PageContent ownership.
- [x] 1.2 Confirm no destructive migration or state reset is required; if implementation discovers one, stop and ask the user before continuing.
- [x] 1.3 Use agent-browser against the real app-view or Studio-embedded app-view route to capture before-fix screenshot and CSS-rule evidence for `.message-source-comment-editor-content.page-content` or equivalent comment edit PageContent padding.
- [x] 1.4 Inspect all current `env(safe-area-inset-*)` usages in Web Chat Framework7-adjacent surfaces and classify them as conflicting PageContent/Toolbar overrides or inner-shell spacing.

## 2. BDD Contract

- [x] 2.1 Add a behavior test for `web-chat-view` sender presentation: Given a message has canonical `senderContactId` presentation and a bootstrap-like `from` label When the row renders Then the visible sender name/avatar come from canonical presentation and not `Trusted bootstrap`.
- [x] 2.2 Add a room-mode app-view/API contract test: Given a global room snapshot has participants/seats or profile presentation When app-view builds the actor directory Then sender entries include stable label and `iconUrl` where available without importing Studio stores.
- [x] 2.3 Add a source/comment behavior test: Given an empty comment draft or empty comment payload When comment anchors/details/resources render Then no `No comment body yet` text and no visible empty comment resource are produced.
- [x] 2.4 Add a comment icon/action contract test: Given comment anchor/detail/resource surfaces render Then comment glyphs use `MessageSquareDot` and primary comment panel actions are icon affordances with accessible labels.
- [x] 2.5 Add a Framework7 CSS contract test: Given source/comment edit `PageContent` styles are inspected When component CSS is read Then no whole `padding` declaration on `.page-content` disables Framework7 padding formulas; custom spacing uses extra-padding variables or inner shells.
- [x] 2.6 Add a message-row action-spacing contract test: Given compact sent and received rows with actions When CSS is inspected Then there is no unconditional compact `.message-card-with-actions { padding-inline-end: ... }` reservation that applies identically to both ownership directions.
- [x] 2.7 Confirm each task checkbox is updated only after the current agent has implemented and verified that task in this working context.

## 3. Implementation

- [x] 3.1 Run `bun run openspec:vision -- commit-check fix-web-chat-view-message-comment-polish --phase apply` after OpenSpec artifacts are committed and before product-code work starts. Process deviation recorded in self-review: the command was rerun in this context, but product-code edits already existed as uncommitted work from the previous context.
- [x] 3.2 Commit the ready OpenSpec artifacts separately from product code.
- [x] 3.3 Implement canonical sender/avatar presentation for app-view room mode without Studio iframe event bridges or Studio store imports; prefer backend/app-view snapshot projection and keep bootstrap labels as fallback provenance only.
- [x] 3.4 Replace comment icons with `MessageSquareDot` across comment anchor, inspector, resource card, and preview-layer comment surfaces while preserving the user's `.comment-anchor-serial span` style change.
- [x] 3.5 Prevent empty comment bodies from becoming visible comment cards/resources; keep save disabled for empty drafts and remove `No comment body yet` visible copy.
- [x] 3.6 Upgrade source/comment panel primary controls from bare text links to semantic icon affordances with accessible labels for actions, comment, cancel, save, close, view, and edit.
- [x] 3.7 Refactor Framework7 comment/source edit sheets so `Toolbar` and `PageContent` retain official offset ownership; move custom spacing to `--f7-page-content-extra-padding-*` or inner shell padding and remove conflicting `env(...)` whole-padding overrides.
- [x] 3.8 Rework message action affordance spacing so compact sent/received bubbles do not reserve wrong-side padding; use ownership-aware placement or overlay geometry.
- [x] 3.9 Add concise intent comments only at critical boundary points where future readers could confuse grant provenance with sender identity or Framework7 offset ownership with custom safe-area layout.
- [x] 3.10 Update only current-context completed task checkboxes and commit them with matching implementation/BDD evidence.

## 4. Verification

- [x] 4.1 Run targeted unit/contract tests for Web Chat comment resources, message row layout, source popup layout, and app-view room profile projection.
- [x] 4.2 Run `bun run --filter '@agenter/web-chat-view' typecheck`.
- [x] 4.3 Run `bun run --filter '@agenter/web-chat-view' test:unit` or targeted equivalent if the full unit suite is too broad for the current turn; record any skipped full-suite risk.
- [x] 4.4 Use agent-browser after implementation to capture after-fix desktop and iPhone 14 screenshots for sender/avatar, message action geometry, comment anchor/detail, and source-comment edit textarea visibility.
- [x] 4.5 Save before/after CSS-rule evidence and screenshots under `openspec/changes/fix-web-chat-view-message-comment-polish/review/evidence/`.
- [x] 4.6 Run `bun run openspec:vision -- validate fix-web-chat-view-message-comment-polish`.
- [ ] 4.7 Run `bun run openspec:vision -- commit-check fix-web-chat-view-message-comment-polish --phase self-review` before writing final review evidence.

## 5. Self-Review Loop

- [ ] 5.1 Generate `review/self-review.md` comparing implementation against `plans/plan.md`, specs, and task evidence.
- [ ] 5.2 Generate `review/self-review.html` as the screenshot / CSS-rule / interaction evidence presentation.
- [ ] 5.3 Include an explicit deviation list and future task list in the review artifacts, written in plain language.
- [ ] 5.4 If review finds a spec or plan drift, run `bun run openspec:vision -- review-state fix-web-chat-view-message-comment-polish`, back up/update `plans/plan.md`, and commit OpenSpec updates before another apply loop.
- [ ] 5.5 If review cannot exit normally, run `bun run openspec:vision -- handoff fix-web-chat-view-message-comment-polish` and commit the handoff evidence before returning to user discussion.
- [ ] 5.6 If review exits normally, run `bun run openspec:vision -- check fix-web-chat-view-message-comment-polish` and decide whether to archive after user acceptance.
