## 1. Change And Spec Sync

- [x] 1.1 Add this change and sync the durable cli-shell product spec summary for product config, textarea composer, slash panels, and cursor reliability.

## 2. Cursor Reliability

- [x] 2.1 Replace source-string shell-pane cursor tests with runtime projection tests.
- [x] 2.2 Add a regression test for non-zero viewport start proving a scrolled absolute cursor still lands in the visible local viewport.
- [x] 2.3 Add a regression test for non-zero screen origin proving native cursor placement still uses 1-based screen coordinates from renderable screen origin.
- [x] 2.4 Keep an explicit code comment at the native cursor commit site documenting the historical `(-1,-1)` offset failure and why the `+1` belongs only there.

## 3. Product Config

- [x] 3.1 Add cli-shell product config loading/saving under `~/.agenter/cli-shell/settings.json`.
- [x] 3.2 Add cli-shell keybinding loading under `~/.agenter/cli-shell/keybindings.json`.
- [x] 3.3 Persist Chat default layout and use it when reopening Chat from the bottom bar singleton toggle.
- [x] 3.4 Add tests for default config, missing files, empty files, and persisted Chat layout.

## 4. Room Composer

- [x] 4.1 Replace the Room input with `TextareaRenderable`.
- [x] 4.2 Add a composer host with `textarea`, `panel`, and `confirm` modes.
- [x] 4.3 Implement configurable submit/newline/undo/redo/copy/paste keybinding actions.
- [x] 4.4 Implement `/history` using the existing paged room message API.
- [x] 4.5 Add tests for empty-draft history insert, non-empty draft confirm-and-replace, and non-empty draft insert-at-cursor.

## 5. Send And Refresh

- [x] 5.1 Separate send success from refresh failure in Room submit flow.
- [x] 5.2 Clear the draft immediately after send success, before any follow-up hydrate.
- [x] 5.3 Surface refresh failure as a distinct recoverable status.
- [x] 5.4 Add BDD tests proving a successful send is not reported as failed when refresh throws.

## 6. Validation

- [x] 6.1 Run focused cli-shell tests.
- [x] 6.2 Run `bun run --filter '@agenter/cli-shell' typecheck`.
- [x] 6.3 Run `openspec validate finish-cli-shell-room-composer-and-cursor-reliability --strict`.
