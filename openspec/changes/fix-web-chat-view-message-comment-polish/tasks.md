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
- [x] 2.8 Add a Framework7 shell contract test: Given a component renders explicit `PageContent` inside Framework7 `Page` When reading the Svelte source Then the parent `Page` disables automatic `pageContent` to prevent nested `.page-content`.
- [x] 2.9 Add an icon-only toolbar contract test: Given source popup toolbar actions render icons When reading the implementation Then `Actions` and `Comment` text is not visible inside the dense toolbar controls.
- [x] 2.10 Add an empty-comment deletion contract test: Given a pending/source comment edit is saved with an empty body When handlers run Then the local anchor or pending comment resource is removed instead of leaving an empty resource.

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
- [x] 3.11 Set `pageContent={false}` on Web Chat Framework7 `Page` instances that manually own explicit `PageContent`.
- [x] 3.12 Convert source popup selection toolbar actions to visual icon-only controls while preserving `aria-label` and `title`.
- [x] 3.13 Change source and pending comment save behavior so empty saved content deletes/cancels the comment resource rather than disabling save and leaving an empty artifact.

## 4. Verification

- [x] 4.1 Run targeted unit/contract tests for Web Chat comment resources, message row layout, source popup layout, and app-view room profile projection.
- [x] 4.2 Run `bun run --filter '@agenter/web-chat-view' typecheck`.
- [x] 4.3 Run `bun run --filter '@agenter/web-chat-view' test:unit` or targeted equivalent if the full unit suite is too broad for the current turn; record any skipped full-suite risk.
- [x] 4.4 Use agent-browser after implementation to capture after-fix desktop and iPhone 14 screenshots for sender/avatar, message action geometry, comment anchor/detail, and source-comment edit textarea visibility.
- [x] 4.5 Save before/after CSS-rule evidence and screenshots under `openspec/changes/fix-web-chat-view-message-comment-polish/review/evidence/`.
- [x] 4.6 Run `bun run openspec:vision -- validate fix-web-chat-view-message-comment-polish`.
- [x] 4.7 Run `bun run openspec:vision -- commit-check fix-web-chat-view-message-comment-polish --phase self-review` before writing final review evidence.
- [x] 4.8 Re-run targeted Web Chat unit/layout tests for Round 2 contracts.
- [x] 4.9 Re-run `bun run --filter '@agenter/web-chat-view' typecheck`.
- [x] 4.10 Re-run OpenSpec vision validate/check after Round 2 updates.

## 5. Self-Review Loop

- [x] 5.1 Generate `review/self-review.md` comparing implementation against `plans/plan.md`, specs, and task evidence.
- [x] 5.2 Generate `review/self-review.html` as the screenshot / CSS-rule / interaction evidence presentation.
- [x] 5.3 Include an explicit deviation list and future task list in the review artifacts, written in plain language.
- [x] 5.4 If review finds a spec or plan drift, run `bun run openspec:vision -- review-state fix-web-chat-view-message-comment-polish`, back up/update `plans/plan.md`, and commit OpenSpec updates before another apply loop.
- [x] 5.5 If review cannot exit normally, run `bun run openspec:vision -- handoff fix-web-chat-view-message-comment-polish` and commit the handoff evidence before returning to user discussion.
- [x] 5.6 If review exits normally, run `bun run openspec:vision -- check fix-web-chat-view-message-comment-polish` and decide whether to archive after user acceptance.
- [x] 5.7 Update self-review artifacts with Round 2 acceptance feedback, deviation list, and future tasks before asking for another visual acceptance pass.

## 6. Round 3 Acceptance Feedback

- [x] 6.1 Record Round 3 user feedback verbatim in `plans/plan.md` and extend specs/tasks before code edits.
- [x] 6.2 Add BDD/source contracts proving empty comment save, close/cancel, and Framework7 `onSheetClosed` share one delete-and-close finalizer.
- [x] 6.3 Add BDD/source contracts proving comment edit sheets retain official Framework7 `Sheet -> Toolbar -> PageContent` topology and do not repaint Sheet/Toolbar chrome as custom translucent panels.
- [x] 6.4 Implement source comment editor finalization so empty save deletes the anchor and closes the panel, empty close/cancel deletes and closes, and `onSheetClosed` cannot leave an empty editor open.
- [x] 6.5 Implement pending comment preview finalization so empty save or close removes the pending resource and closes the preview.
- [x] 6.6 Remove over-custom Framework7 Sheet/Toolbar chrome overrides from the source and comment inspector edit sheets while preserving inner editor layout and accessible icon actions.
- [x] 6.7 Re-run targeted Web Chat unit/layout tests and `@agenter/web-chat-view` typecheck.
- [x] 6.8 Re-run OpenSpec vision validate/check and update self-review with Round 3 deviation/future-task notes.

## 7. Round 4 Acceptance Feedback

- [x] 7.1 Record the reported `sheet.params` undefined runtime stack in `plans/plan.md` and extend the comment/Framework7 specs before code edits.
- [x] 7.2 Add BDD/source contracts proving source comment and pending comment edit Sheets are retained until Framework7 `onSheetClosed`.
- [x] 7.3 Implement retained Sheet mount state for source popup comment editing so empty save/close deletes data, drives `opened=false`, and releases the Sheet only after `onSheetClosed`.
- [x] 7.4 Implement retained Sheet mount state for pending/comment inspector editing so resource removal or popup close cannot directly destroy a live Sheet.
- [x] 7.5 Tighten Sheet backdrop parameters and remove remaining Sheet chrome overrides that fight official Framework7 defaults.
- [x] 7.6 Re-run targeted Web Chat unit/layout tests and `@agenter/web-chat-view` typecheck.
- [x] 7.7 Update self-review with Round 4 deviation/future-task notes and explain why the official Framework7 Sheet style is the correct default.
- [x] 7.8 Run live Studio iframe/app-view browser verification for empty source comment save and cancel, confirming the Sheet visibly closes and no `sheet.params` / `swipeToClose` / `closeByBackdropClick` runtime error is emitted.

## 8. Round 5 Acceptance Feedback

- [x] 8.1 Record the reported composer resource rail layout issue in `plans/plan.md` and extend Framework7 visual-law specs.
- [x] 8.2 Add BDD coverage proving pending resources belong to `.messagebar-area` and are not contained by the send button toolbar pane.
- [x] 8.3 Move `PendingAssetStrip` into the Framework7 `Messagebar` `beforeArea` slot so dynamic image/file/comment resources render in the resource rail above the draft field.
- [x] 8.4 Re-run targeted Web Chat unit tests, `@agenter/web-chat-view` typecheck, OpenSpec validate/check, and live visual verification.
- [x] 8.5 Update self-review with Round 5 evidence before asking for another visual acceptance pass.

## 9. Round 6 Framework7 Modal Encapsulation

- [x] 9.1 Record the latest user feedback in `plans/plan.md` and extend Framework7 visual-law specs before product-code edits.
- [x] 9.2 Add BDD/source contracts proving composer tool trays use a shared Framework7 `MessagebarSheet` wrapper and do not repaint `.messagebar-sheet` chrome.
- [x] 9.3 Add BDD/source contracts proving message/source contextual actions use one shared Framework7 Actions adapter instead of repeated `app.f7.actions.create(...)` implementations and blurred custom fallback surfaces.
- [x] 9.4 Add BDD/source contracts proving resource/source popup shells do not repaint `.popup`, bottom `.toolbar`, or navbar slot chrome with custom blur/safe-area inline styles.
- [x] 9.5 Implement the shared composer tool-sheet wrapper and migrate `default-composer.svelte` to Framework7 `MessagebarSheetItem` semantics.
- [x] 9.6 Implement the shared Framework7 Actions adapter and migrate message action menu, context menu, and source selection action surface to it.
- [x] 9.7 Remove direct modal chrome repainting from resource preview/source popup toolbar and navbar slots while preserving inner content layout.
- [x] 9.8 Re-run targeted Web Chat unit/source contracts and `@agenter/web-chat-view` typecheck.
- [x] 9.9 Re-run OpenSpec vision validate/check and update self-review with Round 6 deviation/future-task notes.
