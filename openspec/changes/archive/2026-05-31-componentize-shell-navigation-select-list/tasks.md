## 1. Alignment / Investigation

- [x] 1.1 Confirm `plans/plan.md` records the user requirements for removing `running`, ordered fields, width-aware wrapping, multi-line selection, mouse click entry, and OpenTUI componentization.
- [x] 1.2 Inspect current Shell navigation implementation and existing navigation tests before app-code work.
- [x] 1.3 Inspect existing durable cli-shell product spec and update the stale `status/running` row contract through this change.
- [x] 1.4 Run `bun run openspec:vision -- commit-check componentize-shell-navigation-select-list --phase apply` before app-code work starts.

## 2. BDD Contract

- [x] 2.1 Add/keep a behavior scenario: Given a bordered OpenTUI parent and a visible multi-line item When the row is clicked Then hit testing resolves to the intended logical item.
- [x] 2.2 Add/keep a behavior scenario: Given a wrapped Terminal row When mouse is pressed Then it selects only, and release on the same logical item confirms entry.
- [x] 2.3 Add/keep a behavior scenario: Given a narrow Terminal width When rendering a Terminal row Then fields wrap only between fields and each field clips by `stringWidth`.
- [x] 2.4 Add/keep a behavior scenario: Given current superadmin and room grants/participants When rows render Then room-users display as `@AAA, @BBB` and exclude superadmin.
- [x] 2.5 Confirm each task checkbox is updated only by the agent that completed and verified that exact task in the current working context.

## 3. Implementation

- [x] 3.1 Extract a `ScreenRegionMapper`/hit-region primitive that converts renderable-local child regions to screen coordinates with explicit parent border/content insets.
- [x] 3.2 Extract a reusable `SelectableWrappedList<T>` OpenTUI component that owns row renderables, multi-line item layout, visible-window calculation, selected item updates, hit regions, mousedown selection, and release confirmation.
- [x] 3.3 Extract Terminal row presentation into a `TerminalSelectionRow` renderer/component that owns field order, style roles, `stringWidth` clipping, and field-level wrapping.
- [x] 3.4 Refactor `ShellNavigationApp` so it composes the list and row components while keeping only navigation step/state and completion logic.
- [x] 3.5 Keep the existing runtime-store refresh path so live `pwd` and `pty-title` updates still re-render through the componentized row path.
- [x] 3.6 Update durable spec truth for Select Terminal rows from `status/running` to `id / pwd / pty-title / room-users`.
- [x] 3.7 Add concise comments only where they explain the coordinate projection law or why the list primitive owns pointer confirmation.

## 4. Verification

- [x] 4.1 Run `bun test apps/shell/test/navigation-app.test.ts apps/shell/test/navigation-model.test.ts`.
- [x] 4.2 Run any new focused component test added for the OpenTUI list primitive.
- [x] 4.3 Run `bun run --filter 'agenter-app-shell' typecheck`.
- [x] 4.4 Run `bun run openspec:vision -- validate componentize-shell-navigation-select-list`.
- [x] 4.5 Run `git diff --check`.
- [x] 4.6 Run `bun run openspec:vision -- check componentize-shell-navigation-select-list` before archive.

## 5. Self-Review Loop

- [x] 5.1 Generate `review/self-review.md` comparing implementation against `plans/plan.md`, specs, and tasks.
- [x] 5.2 Generate `review/self-review.html` with structured command/test evidence.
- [x] 5.3 If self-review reopens tasks or changes specs/tasks, commit those artifact updates before the next apply loop.
- [x] 5.4 If review exits normally, archive the change and commit the archive result.
