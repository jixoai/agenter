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
- [ ] 7.7 Resolve any pre-existing unrelated dirty workspace state explicitly so final `git status --short` is clean.
