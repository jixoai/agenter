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

## 6. Round 2 Browse Pagination

- [x] 6.1 Add NoteSystem/client-sdk/app-server facades for paged notebooks, selected-notebook sections, and selected-section pages while preserving the existing catalog facade for overview/compatibility.
- [x] 6.2 Refactor the avatar Browse route state so notebook, section, and page selection are independent scopes and current selection remains stable across refreshes when still visible.
- [x] 6.3 Replace the full notebook(with sections) tree body with three explicit virtual scroll owners: notebooks, sections, and pages.
- [x] 6.4 Update BDD/unit/e2e coverage so Browse contract asserts the new paged facades, separate scroll owners, and absence of embedded always-expanded sections.
- [x] 6.5 Run focused NoteSystem, Studio typecheck/unit, Notes e2e, OpenSpec validation, and diff whitespace checks for this reopened Browse scope.

## 7. Round 3 Vision Correction / Bug Loop

- [x] 7.1 Back up the current `plans/plan.md` with `bun run openspec:vision -- backup-plan rework-notes-workbench-scope-tabs` before materially correcting the plan.
- [x] 7.2 Preserve the Round 2 and Round 3 requirement-bearing user inputs verbatim in `plans/plan.md` before further development.
- [x] 7.3 Run `bun run openspec:vision -- validate rework-notes-workbench-scope-tabs` after the requirement-record correction.
- [x] 7.4 Investigate the reported BUG against the recorded Browse intent and identify whether it is a spec drift, UI behavior bug, data paging bug, or test fixture gap.
- [x] 7.5 Fix the bug through the smallest platform-consistent change and update BDD coverage before marking the bug loop complete.

## 8. Round 4 OneNote Browse Layout

- [x] 8.1 Back up the current `plans/plan.md` with `bun run openspec:vision -- backup-plan rework-notes-workbench-scope-tabs` before materially correcting the layout plan.
- [x] 8.2 Preserve the OneNote layout requirement verbatim in `plans/plan.md`.
- [x] 8.3 Update the Browse spec and BDD contracts so notebook/page-scope switching is above the body and the body columns are `Sections` and `Pages`.
- [x] 8.4 Refactor `NotesBrowseMode` from three equal body columns into a top notebook/page-scope switcher plus two body columns.
- [x] 8.5 Run focused Studio Notes unit/source contracts, Svelte check, OpenSpec validation, and whitespace checks.

## 9. Round 5 Runtime Two-Column Correction

- [x] 9.1 Back up `plans/plan.md` with `bun run openspec:vision -- backup-plan rework-notes-workbench-scope-tabs` before recording runtime correction facts.
- [x] 9.2 Preserve the restarted `127.0.0.1:4173` runtime evidence inputs verbatim in `plans/plan.md`.
- [x] 9.3 Diagnose the live route with DOM evidence from `http://127.0.0.1:4173/notes/avatar/default`.
- [x] 9.4 Fix the zero-height notebook switcher so notebook buttons are visible in the top switcher.
- [x] 9.5 Keep selected-note detail out of the persistent Browse body columns by using the shared compact detail layer.
- [x] 9.6 Run focused Notes unit/source contracts, Svelte check, OpenSpec validation, whitespace checks, and a fresh 4173 screenshot/DOM proof.

## 10. Round 6 List-Detail / List-Mode Correction

- [x] 10.1 Back up `plans/plan.md` with `bun run openspec:vision -- backup-plan rework-notes-workbench-scope-tabs` before recording the list-detail acceptance correction.
- [x] 10.2 Preserve the Round 6 requirement-bearing user input verbatim in `plans/plan.md`.
- [x] 10.3 Update the Browse spec so outer Browse remains list-detail and the list pane owns `Notebooks` / `SectionsAndPages` projections.
- [x] 10.4 Refactor `NotesBrowseMode` so the list header renders `<NotebookName> (?) ↓` and clicking it switches the list body to a virtual single-column Notebooks List.
- [x] 10.5 Keep `SectionsAndPages` as the default list body projection with sections/pages columns and footer actions for add section/add page.
- [x] 10.6 Restore selected-page detail as the persistent detail side of the list-detail layout.
- [x] 10.7 Update focused BDD/source contracts and live 4173 proof for the corrected list-detail/list-mode layout.

## 11. Round 7 Browse Sort / Search Stack Refinement

- [x] 11.1 Back up `plans/plan.md` with `bun run openspec:vision -- backup-plan rework-notes-workbench-scope-tabs` before recording Round 7 requirements.
- [x] 11.2 Preserve Round 7 requirement-bearing user input verbatim in `plans/plan.md`.
- [x] 11.3 Update the Browse/Search spec so sorting is facade-level, first page opens by default, Search is stack layout, and tag syntax drives filtering.
- [x] 11.4 Add NoteSystem/client-sdk/app-server typed sort options for notebook, section, and page list facades before pagination slicing.
- [x] 11.5 Add Browse sort icon-buttons/selectors for Notebooks, Sections, and Pages with labels `排序笔记本`, `排序章节`, and `排序页面`.
- [x] 11.6 Ensure Browse selects/reads the first visible page by default when the current selected page is absent.
- [x] 11.7 Add a Notes search syntax parser for `tag:<name>` tokens and route tag clicks through input mutation plus the same parser-backed search path.
- [x] 11.8 Refactor Search mode to Stack layout: search input, two-row tags accordion, and result list.
- [x] 11.9 Derive visible tags from non-empty search results and fall back to all tags when the input is empty or results are empty.
- [x] 11.10 Run focused NoteSystem/client-sdk/app-server tests, Studio Notes contracts, Svelte check, OpenSpec validate, git diff check, and live 4173 proof.

## 12. Round 8 Detail / Query Polish

- [x] 12.1 Back up `plans/plan.md` with `bun run openspec:vision -- backup-plan rework-notes-workbench-scope-tabs` before recording Round 8 requirements.
- [x] 12.2 Preserve Round 8 requirement-bearing user input verbatim in `plans/plan.md`.
- [x] 12.3 Update the Notes spec so loading badge suppression, Search/Query Empty detail, Query CodeMirror SQL editor, and structured Query result rows are explicit acceptance requirements.
- [x] 12.4 Add the shared CodeMirror SQL editor capability through `@jixo/codemirror` and consume it from the Notes Query mode.
- [x] 12.5 Add or reuse the local shadcn `Empty` UI component and render it in the Notes detail side when Search or Query has no selected page.
- [x] 12.6 Refactor Query output into structured result rows aligned with Search, including selectable rows when notebook/section/page identity columns exist.
- [x] 12.7 Suppress absent/loading zero badges in Notes page-toolbar tabs and local loading counts.
- [x] 12.8 Update focused Notes contracts/e2e assertions for Empty detail, CodeMirror SQL input, structured Query rows, and loading badge suppression.
- [ ] 12.9 Run focused CodeMirror/Studio Notes tests, Svelte check, OpenSpec validate, git diff check, and live 4173 proof if the local preview server is available.

## 13. Round 9 Query Scroll Bug Loop

- [x] 13.1 Back up `plans/plan.md` with `bun run openspec:vision -- backup-plan rework-notes-workbench-scope-tabs` before recording the Query scroll bug report.
- [x] 13.2 Preserve the Query scroll bug report verbatim in `plans/plan.md`.
- [x] 13.3 Update the Notes spec so Query result scrolling follows the same Stack/scroll-owner law as Search.
- [x] 13.4 Refactor `NotesQueryMode` to remove the extra scaffold/body wrapper and use the same root height/min-height structure as `NotesSearchMode`.
- [x] 13.5 Update focused source contracts so Query asserts the shared result-list scroll viewport and absence of the scaffold wrapper.
- [x] 13.6 Run focused Studio Notes contracts, OpenSpec validate, and diff whitespace checks.

## 14. Round 10 Query Density / Default Selection

- [x] 14.1 Back up `plans/plan.md` with `bun run openspec:vision -- backup-plan rework-notes-workbench-scope-tabs` before recording the Query row-density/default-selection feedback.
- [x] 14.2 Preserve the Query row-density/default-selection feedback verbatim in `plans/plan.md`.
- [x] 14.3 Update the Notes spec so Query rows avoid duplicated metadata and default SQL auto-runs into an open detail side.
- [x] 14.4 Refine SQL result mapping so identity, MIME, and updated time are each rendered once in Query rows.
- [x] 14.5 Auto-run the default Query SQL on Query entry, select the first identity-bearing row when present, and keep detail open with Empty when absent.
- [x] 14.6 Update focused Notes state/source contracts for Query row density and default SQL selection behavior.
- [x] 14.7 Run focused Studio Notes contracts, OpenSpec validate, and diff whitespace checks.

## 15. Round 11 Skeleton Pending States

- [x] 15.1 Back up `plans/plan.md` with `bun run openspec:vision -- backup-plan rework-notes-workbench-scope-tabs` before recording the Skeleton pending-state feedback.
- [x] 15.2 Preserve the Round 11 requirement-bearing user input verbatim in `plans/plan.md`.
- [x] 15.3 Update the Notes spec so Search/Query pending states render Skeleton while Empty remains a completed empty projection.
- [x] 15.4 Add a shared Skeleton pending state to `NotesPageResultList`.
- [x] 15.5 Add a shared Skeleton pending state to `NotesPageDetailDrawer` for Search/Query pending and page-detail loading.
- [x] 15.6 Update focused Notes source contracts for Skeleton pending states.
- [x] 15.7 Run focused Studio Notes contracts, OpenSpec validate, and diff whitespace checks.
- [x] 15.8 Stage and commit only related OpenSpec/Notes files.
