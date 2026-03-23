## 1. OpenSpec and review contract

- [x] 1.1 Add the `webui-layout-review-rubric` spec plus the modified shell/chat/layout delta specs for this change.
- [x] 1.2 Add the repository-level WebUI layout prompt/rubric document and define the expected review evidence payload.

## 2. Shell and route density

- [x] 2.1 Refactor `TopHeader` and `WorkspaceShellFrame` so the header stays passive, compact, and basename-first, with route-local actions removed.
- [x] 2.2 Introduce a shared route-local `SessionStatusPillMenu` and wire it into Chat without regressing Start/Stop/Abort behavior.
- [x] 2.3 Tighten shell/chat padding ownership so compact routes no longer stack unnecessary outer and inner spacing.

## 3. Composer layout

- [x] 3.1 Split the Chat composer toolbar into a single-line action bar and a thinner status/help bar.
- [x] 3.2 Reduce editor/composer default height and keep adaptive secondary actions/help behavior aligned with the new two-row contract.

## 4. Verification

- [x] 4.1 Add primitive-first Storybook stories and DOM contracts for `AdaptiveIconButton`, `StatusSignal`, `SessionStatusPillMenu`, `ComposerActionBar`, and `ComposerStatusBar`.
- [x] 4.2 Add a route assembly Storybook story that verifies the composed Chat/Shell first viewport on desktop and iPhone SE widths.
- [x] 4.3 Update the repository-level layout prompt/rubric so Storybook verification order is explicit: primitive first, composite second, route assembly last.
- [x] 4.4 Run targeted `@agenter/webui` DOM/unit/build checks, update this task list from verified results, and capture any residual warnings in the final summary.
