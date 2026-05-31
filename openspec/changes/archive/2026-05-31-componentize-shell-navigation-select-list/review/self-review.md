# Vision-Driven Self Review

## Review State

- Change: `componentize-shell-navigation-select-list`
- Iteration: 1
- Recurring issue counts: none
- Exit-condition judgment: Normal exit after archive/spec sync
- Next loop action: Archive if final check passes

## Intent Alignment

| Intent point | Evidence | Verdict |
| ------------ | -------- | ------- |
| Select Terminal rows do not show `running` and keep `id / pwd / pty-title / room-users` | Existing `navigation-model.test.ts` still asserts no `running`; `terminal-selection-row.ts` owns the ordered fields and uses `stringWidth` clipping/wrapping. | Pass |
| Multi-line rows keep item-based keyboard/mouse behavior | `selectable-wrapped-list.test.ts` covers bordered multi-line click mapping; `navigation-app.test.ts` covers wrapped Terminal mousedown and release confirmation. | Pass |
| Mouse coordinate offset is encapsulated | `screen-region.ts` contains the screen-region mapper and bordered-content inset law; `ShellNavigationApp` no longer computes bordered child offsets. | Pass |
| Shell entry controller is no longer the row/list mechanics owner | `ShellNavigationApp` composes `SelectableWrappedList` and `buildShellNavigationTerminalRow`; row renderables and hit regions live in the component. | Pass |
| Live title/path refresh remains intact | `navigation-app.test.ts` still passes the runtime-store update scenario for pty title refresh. | Pass |

## Deviations From Intent

1. The new components are local to `apps/shell/src/app-navigation` rather than promoted to a cross-app OpenTUI package. This is intentional: there is only one current consumer, and the API is still reusable enough to promote when a second shell surface needs it.

## New Questions For User

1. None blocking this change. A future decision is whether to move the app-local OpenTUI primitives into a shared shell UI component namespace after another consumer appears.

## Evidence

- HTML report: `review/self-review.html`
- Commands:
  - `bun test apps/shell/test/selectable-wrapped-list.test.ts apps/shell/test/navigation-app.test.ts apps/shell/test/navigation-model.test.ts` -> 11 pass
  - `bun run --filter 'agenter-app-shell' typecheck` -> pass
  - `bun run openspec:vision -- validate componentize-shell-navigation-select-list` -> valid
  - `git diff --check -- apps/shell/src/app-navigation/navigation-app.ts apps/shell/src/app-navigation/navigation-model.ts apps/shell/src/app-navigation/screen-region.ts apps/shell/src/app-navigation/selectable-wrapped-list.ts apps/shell/src/app-navigation/terminal-selection-row.ts apps/shell/test/selectable-wrapped-list.test.ts openspec/changes/componentize-shell-navigation-select-list/tasks.md openspec/changes/componentize-shell-navigation-select-list/specs/cli-shell-product/spec.md openspec/changes/componentize-shell-navigation-select-list/plans/plan.md` -> pass
- Git commits reviewed:
  - `b6c507c9 docs(spec): propose shell navigation list componentization`
  - `196827c3 refactor(shell): extract selectable navigation list`
- Uncommitted paths, if any: unrelated `openspec/changes/complete-note-system-product-surface/tasks.md` remains outside this change scope.
- Task checkboxes updated by this working context: tasks `1.4`, `2.1`-`2.5`, `3.1`-`3.7`, and `4.1`-`4.5`.

## HTML Review Report

See `review/self-review.html`.

## Exit Handling

- Normal exit path: run final OpenSpec check, sync/archive the change, then commit archive evidence.
