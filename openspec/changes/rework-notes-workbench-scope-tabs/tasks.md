## 1. Alignment / Investigation

- [x] 1.1 Confirm the latest `plans/plan.md` reflects the relevant code survey, existing OpenSpec survey, and user Q&A.
- [x] 1.2 Create the change-local HTML sketch at `demos/notes-workbench-scope-tabs.html` to make the intended visible result discussable before implementation.
- [x] 1.3 Confirm with the user whether `/notes` should remain an Overview tab or redirect directly to the default avatar Notes tab.
- [x] 1.4 Confirm with the user whether read-only SQL should remain a dedicated `Query` page-toolbar tab or move behind an advanced toolbar action.
- [x] 1.5 Confirm with the user that workspace/source roots are only grouping/filtering metadata inside one avatar tab, not a second tab identity axis.

## 2. BDD Contract

- [x] 2.1 Add route/source contract coverage: Given `/notes` is a primary navigation item When nested Notes routes are used Then active app-shell state follows `/notes/**` and Studio still consumes only client runtime-store NoteSystem facades.
- [x] 2.2 Add tab-state coverage: Given avatar `default` is opened from Notes When the tab list is reconciled Then `notes-avatar:default` is present once, closable, and device-local.
- [x] 2.3 Add no-body-selector coverage: Given a Notes avatar tab is rendered When reviewers inspect visible controls Then no body-level `Notes avatar` selector exists.
- [x] 2.4 Add mode-routing coverage: Given `/notes/avatar/default/search` is opened When the route hydrates Then the `default` avatar tab and `Search` page-toolbar tab are active.
- [x] 2.5 Add search-surface coverage: Given seeded notes and tags When Search mode is active Then query, tag filters, result count/state, result rows, and result-to-detail selection work without switching avatar scope.
- [x] 2.6 Add browse-surface coverage: Given seeded notes When Browse mode is active Then notebook/section/page hierarchy and detail metadata still show stable IDs, MIME, tags, references, and source metadata.
- [x] 2.7 Add query-surface coverage if Query remains visible: Given read-only SQL mode When a bounded query runs Then rows render and mutating SQL errors remain bounded NoteSystem errors.
- [x] 2.8 Add mobile route coverage: Given iPhone 14 viewport When Notes avatar Browse/Search modes are used Then toolbar tabs remain accessible and detail uses the shared compact detail law without overlapping controls.
- [x] 2.9 Confirm each task checkbox is updated only by the agent that completed and verified that task in the current working context.

## 3. Implementation

- [x] 3.1 Run `bun run openspec:vision -- commit-check rework-notes-workbench-scope-tabs --phase apply` before app-code work starts and commit ready OpenSpec artifacts if implementation is approved.
- [x] 3.2 Add Notes location helpers for canonical `/notes`, `/notes/avatar/[avatarNickname]`, `/notes/avatar/[avatarNickname]/search`, and `/notes/avatar/[avatarNickname]/query` URLs, including legacy `/notes?avatar=...` canonicalization.
- [x] 3.3 Add Notes avatar tab state modeled after Skills avatar tabs, with IDs keyed only by avatar nickname and close semantics that remove local workbench presence only.
- [x] 3.4 Replace the monolithic Notes route with a Notes workbench layout that owns fixed Overview plus dynamic avatar tabs through `WorkbenchWindow`.
- [x] 3.5 Add an Overview route/body that lists avatars with NoteSystem capability summary and opens avatar-scoped Notes tabs.
- [x] 3.6 Add an avatar Notes route shell that owns avatar-scoped data loading, `WorkbenchPageToolbar`, identity/status rendering, and local page-toolbar tabs.
- [x] 3.7 Split Browse mode from the current Notes body, preserving catalog hierarchy, detail drawer, stable metadata, tags, references, empty/loading/error/no-capability states, and shared scroll ownership.
- [x] 3.8 Split Search into its own mode body with query entry, tag filters, search result state, result selection, and no avatar selector.
- [x] 3.9 Split Query into its own advanced page-toolbar tab, preserving read-only SQL facade use and bounded errors.
- [x] 3.10 Add concise intent comments only at critical scope-boundary points, especially where avatar tab identity is deliberately separated from workspace/source grouping.
- [x] 3.11 Update current-context completed task checkboxes and commit them with matching implementation / BDD evidence.

## 4. Verification

- [x] 4.1 Run `bun run --filter 'agenter-app-studio' test:unit` or narrower targeted Vitest specs covering Notes state/location/tab contracts.
- [ ] 4.2 Run `bun run --filter 'agenter-app-studio' test:dom` if Storybook DOM stories are added or reused for Notes mode interactions.
- [x] 4.3 Run the Notes Playwright smoke path on desktop and iPhone 14 after implementation, seeded through client SDK NoteSystem facades.
- [x] 4.4 Run `bun run openspec:vision -- validate rework-notes-workbench-scope-tabs`.
- [x] 4.5 Verify `git diff --check` before any implementation commit.

## 5. Self-Review Loop

- [x] 5.1 Generate `review/self-review.md` comparing the implementation against `plans/plan.md`, the delta spec, and the HTML sketch.
- [x] 5.2 Generate `review/self-review.html` or equivalent screenshot/interaction evidence if the implementation changes visible layout.
- [ ] 5.3 If self-review changes OpenSpec artifacts or reopens tasks, commit those artifact changes before the next apply loop.
- [ ] 5.4 If the review is entering a real loop, run `bun run openspec:vision -- review-state rework-notes-workbench-scope-tabs` to persist iteration / recurrence state.
- [ ] 5.5 If review cannot exit normally, run `bun run openspec:vision -- handoff rework-notes-workbench-scope-tabs` and commit the handoff evidence before returning to user discussion.
- [ ] 5.6 If review exits normally, run `openspec archive rework-notes-workbench-scope-tabs` and commit the archive result.
- [ ] 5.7 Run `bun run openspec:vision -- check rework-notes-workbench-scope-tabs` and decide whether to exit or return to `research-plan` with a backed-up plan revision.
