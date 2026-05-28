## 1. OpenSpec And Reference Audit

- [x] 1.1 Validate `stabilize-shell-next-button-copy` artifacts before implementation.
- [x] 1.2 Confirm `git diff -- extensions/cli-shell` is empty and keep cli-shell read-only.
- [x] 1.3 Read legacy cli-shell selection/copy/paste paths and record the shell-next code that must copy the behavior.
- [x] 1.4 Record why OpenTUI does not give us a product Button and why shell-next needs its own Button primitive.

## 2. BDD Regression Coverage

- [x] 2.1 Add failing BDD scenarios for one shared Button primitive: bold-only hover, underline-only active, no hover color shift, and visible-cell hit testing.
- [x] 2.2 Add failing BDD scenarios for ShellPane drag selection, visible overlay projection, backend copy, and async selected-text OSC52 delivery.
- [x] 2.3 Add failing BDD scenarios for ShellPane paste delivering one backend input write and one follow-cursor call.
- [x] 2.4 Add failing BDD scenarios for Chat/renderer primary selection not clearing visible selection or handling middle-click locally.
- [x] 2.5 Add failing BDD scenarios for terminal resize debounce plus conflated newest-size delivery.

## 3. Button Platform Implementation

- [x] 3.1 Implement a typed shell-next Button primitive for bracketed labels, hit regions, hover, active, disabled, and event consumption.
- [x] 3.2 Migrate ShellPane titlebar, ChatPane titlebar, statusbar actions, and CloseConfirmDialog buttons to consume the shared Button primitive or adapter.
- [x] 3.3 Remove statusbar hover color changes and enforce bold-only hover everywhere.
- [x] 3.4 Fix active underline rendering so Chat layout actions and statusbar actions visibly use underline state.
- [x] 3.5 Add CloseConfirmDialog button hover and titlebar close hover through the same primitive.

## 4. ShellPane Selection Copy Paste

- [x] 4.1 Copy the needed legacy terminal selection/copy/paste behavior into shell-next without importing from or editing cli-shell.
- [x] 4.2 Fix ShellPane drag selection coordinates and selection overlay refresh.
- [x] 4.3 Fix ShellPane copy shortcuts so selected text is delivered through OSC52 once and terminal input is not polluted.
- [x] 4.4 Fix ShellPane paste ownership so one paste event reaches the terminal backend exactly once.
- [x] 4.5 Fix Chat/renderer primary selection mirroring so it does not clear visible selection.

## 5. Resize Delivery

- [x] 5.1 Replace resize debounce-only behavior with an explicit debounce plus conflated pending-size queue.
- [x] 5.2 Verify rapid resize delivers only the newest backend size and stable resize still delivers once.

## 6. Multi-turn Self Review And Drift Control

- [x] 6.1 Self review round 1: compare implementation against the user's latest six feedback bullets and record the result.
- [x] 6.2 Self review round 2: compare implementation against earlier shell-next requirements for Button, copy/paste, resize, and clean workspace.
- [x] 6.3 Produce a plain-language drift list of what was previously over-claimed or incorrectly modeled.
- [x] 6.4 Produce a future task list for anything intentionally deferred after this change.

## 7. Verification Commit And Clean Workspace

- [x] 7.1 Run `openspec validate stabilize-shell-next-button-copy --strict`.
- [x] 7.2 Run focused BDD tests for shell-next button, copy/paste, resize, statusbar, and top-layer behavior.
- [x] 7.3 Run `bun run --filter 'agenter-ext-shell-next' test`.
- [x] 7.4 Run `bun run --filter 'agenter-ext-shell-next' typecheck`.
- [x] 7.5 Run `git diff --check`.
- [x] 7.6 Commit OpenSpec artifacts separately from implementation.
- [x] 7.7 Resolve any pre-existing unrelated dirty workspace state explicitly so final `git status --short` is clean.

## 8. Reopen From Manual Acceptance

- [x] 8.1 Record the 2026-05-28 manual acceptance failures in proposal, design, spec, and audit artifacts.
- [x] 8.2 Re-validate `stabilize-shell-next-button-copy` after reopening the change.
- [x] 8.3 Confirm `extensions/cli-shell` remains read-only before rework implementation.

## 9. BDD Rework Coverage

- [x] 9.1 Add failing BDD scenarios proving ChatPane titlebar actions use the shared Button primitive for bold hover and underline active state on visible titlebar cells.
- [x] 9.2 Add failing BDD scenarios proving ShellPane and ChatPane selection completion call OSC52 `ClipboardTarget.Primary` without clearing visible selection.
- [x] 9.3 Add failing BDD scenarios for ShellPane Option+Left/Right word movement, Shift+Left/Right cell selection, and Shift+Option+Left/Right word selection.
- [x] 9.4 Add failing BDD scenarios for a blocked terminal source resize dispatcher that debounces, conflates, and delivers only the newest pending backend size.
- [x] 9.5 Add failing BDD scenarios for horizontal and vertical resize handle click micro-adjustment by clicked glyph direction.

## 10. Rework Implementation

- [x] 10.1 Replace local titlebar overlay behavior with a direct shared Button renderable adapter so ChatPane, ShellPane, Room, Help, Statusbar, and Dialog buttons share hover/active/click semantics.
- [x] 10.2 Use typed OSC52 target constants in shell-next clipboard helpers and route primary selection mirroring through that target without importing OpenTUI private subpaths.
- [x] 10.3 Copy legacy terminal word navigation and keyboard range-selection behavior into shell-next-owned modules without importing or editing cli-shell.
- [x] 10.4 Add source/backend-boundary resize scheduling for Bun terminal protocol source and live terminal source using debounce plus conflated pending-size delivery.
- [x] 10.5 Fix resize handle click direction so `◀/▲` apply `-1` and `▶/▼` apply `+1`.

## 11. Rework Self Review Verification And Commit

- [x] 11.1 Self review round 3: compare implementation against the latest seven manual feedback bullets in plain language.
- [x] 11.2 Self review round 4: compare implementation against prior Button/copy/paste/resize requirements and record remaining environment-dependent risks.
- [x] 11.3 Run `openspec validate stabilize-shell-next-button-copy --strict`.
- [x] 11.4 Run focused BDD tests for button chrome, host copy/primary selection, terminal key selection, source resize scheduling, and resize handle clicks.
- [x] 11.5 Run `bun run --filter 'agenter-ext-shell-next' test`.
- [x] 11.6 Run `bun run --filter 'agenter-ext-shell-next' typecheck`.
- [x] 11.7 Run `git diff --check`.
- [x] 11.8 Commit the completed rework and leave `git status --short` clean.

## 12. Second Rework Architecture

- [x] 12.1 Record the second manual acceptance failure: only resize glyph direction and Option+arrow cursor movement were actually solved.
- [x] 12.2 Update proposal/design/spec so terminal behavior belongs to a shell-next internal Terminal Engine, not OpenCompose.
- [x] 12.3 Record the KISS clipboard decision: one primary capability path, no app-owned primary register, no dual-track fallback.
- [x] 12.4 Validate `stabilize-shell-next-button-copy` after reopening the change again.
- [x] 12.5 Commit the second rework OpenSpec artifacts before implementation.

## 13. Terminal Engine BDD

- [x] 13.1 Add failing BDD scenarios for terminal input transaction: clear backend selection, write once, follow cursor once after accepted input.
- [x] 13.2 Add failing BDD scenarios proving rejected terminal input does not follow cursor.
- [x] 13.3 Add failing BDD scenarios proving Shift/Option selection movement preserves the keyboard anchor and does not clear backend selection.
- [x] 13.4 Add failing BDD scenarios proving scrolled terminal input and paste request backend follow-cursor.
- [x] 13.5 Add failing BDD scenarios proving Room-backed Chat titlebar hover/active uses the shared pane chrome Button overlay.
- [x] 13.6 Add failing BDD scenarios proving primary copy uses a single capability path and does not write a local primary fallback.

## 14. Terminal Engine Implementation

- [x] 14.1 Introduce a shell-next internal Terminal Engine boundary for input, selection, viewport, copy, paste, and follow-cursor behavior.
- [x] 14.2 Move terminal key input routing out of ShellNextApp into the Terminal Engine boundary.
- [x] 14.3 Route normal input, paste input, and cursor movement through one terminal input transaction.
- [x] 14.4 Preserve selection only for explicit selection movement operations.
- [x] 14.5 Keep primary clipboard as one host clipboard/OSC52 capability path and surface unsupported results without fallback.
- [x] 14.6 Move Room-backed Chat host chrome to the same pane chrome overlay/controller path as direct Chat panes.

## 15. Second Rework Verification And Commit

- [x] 15.1 Self review round 5: compare implementation against the second manual acceptance feedback and architecture boundary correction.
- [x] 15.2 Run `openspec validate stabilize-shell-next-button-copy --strict`.
- [x] 15.3 Run focused BDD tests for Terminal Engine input transaction, follow-cursor, selection preservation, primary capability, and Room-backed Chat chrome.
- [x] 15.4 Run `bun run --filter 'agenter-ext-shell-next' test`.
- [x] 15.5 Run `bun run --filter 'agenter-ext-shell-next' typecheck`.
- [x] 15.6 Run `git diff --check`.
- [x] 15.7 Confirm `git diff -- extensions/cli-shell` is empty.
- [x] 15.8 Commit the completed second rework and leave `git status --short` clean.

## 16. Third Rework Reopen And BDD

- [x] 16.1 Record the 2026-05-29 original intent verbatim in proposal/design/spec/audit, including: selection must not be owned in Shell view, Help/Chat active state drift, active style must not decorate bracket borders, and dual-layer resize law.
- [x] 16.2 Re-open the change state explicitly instead of pretending the previous all-done status still matches the user intent.
- [x] 16.3 Add failing BDD scenarios for top-layer `200ms` resize debounce combined with bottom-layer latest-only conflation.
- [x] 16.4 Add failing BDD scenarios proving active button styling decorates inner content only, not bracket borders.
- [x] 16.5 Add failing BDD scenarios proving ShellPane selection ownership no longer relies on Shell/OpenTUI view-layer state as durable truth.

## 17. Third Rework Implementation

- [x] 17.1 Introduce a product-facing resize send scheduler with `200ms` debounce above terminal source/backend conflation.
- [x] 17.2 Keep bottom-layer latest-only resize conflation at the backend boundary and verify the two layers do not collapse into one responsibility.
- [x] 17.3 Move remaining ShellPane selection gesture/state ownership out of the Shell/OpenTUI frame layer and into shell-next terminal-kernel-owned modules.
- [x] 17.4 Fix shared Button rendering so hover/active styling decorates inner content only while brackets remain plain.
- [x] 17.5 Apply that corrected Button law consistently to statusbar Help/Chat and pane/dialog title actions.

## 18. Third Rework Verification And Self Review

- [x] 18.1 Self review round 1: compare implementation against the user's five 2026-05-29 bullets in plain language.
- [x] 18.2 Self review round 2: compare resize implementation against the exact top-layer debounce plus bottom-layer conflation wording.
- [x] 18.3 Self review round 3: compare selection ownership against the "cannot solve scroll semantics in Shell layer" requirement.
- [x] 18.4 Self review round 4: compare shared Button behavior across statusbar, pane titlebars, and dialogs.
- [x] 18.5 Self review round 5: merge the round notes into one drift list and one encountered-problems list.
- [x] 18.6 Run `openspec validate stabilize-shell-next-button-copy --strict`.
- [x] 18.7 Run focused shell-next BDD covering resize, button rendering, and selection ownership.
- [x] 18.8 Run `bun run --filter 'agenter-ext-shell-next' test`.
- [x] 18.9 Run `bun run --filter 'agenter-ext-shell-next' typecheck`.
- [x] 18.10 Run `git diff --check`.
- [x] 18.11 Confirm `git diff -- extensions/cli-shell` is empty.
- [ ] 18.12 Commit spec updates separately from implementation and leave `git status --short` clean after the final implementation commit.
