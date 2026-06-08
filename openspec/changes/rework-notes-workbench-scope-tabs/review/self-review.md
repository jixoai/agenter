# Self Review

## Scope

Compared implementation against `plans/plan.md`, `specs/studio-notes-workbench/spec.md`, and `demos/notes-workbench-scope-tabs.html`.

## Findings

### Round 2 Browse Pagination

- Pass: NoteSystem now exposes paged notebook, section, and page-list projections while preserving the existing catalog facade for Overview and compatibility.
- Pass: app-server tRPC and client runtime-store project the new `note.notebooks`, `note.sections`, and `note.pages` facades without Studio importing NoteSystem internals.
- Pass: Browse route state now follows `notebooks -> selected notebook -> sections -> selected section -> pages -> selected page`; current selections remain stable when still visible.
- Pass: Browse no longer renders notebooks with embedded always-expanded sections. It has three explicit scroll owners: `notes-notebooks-scroll`, `notes-sections-scroll`, and `notes-pages-scroll`.
- Pass: Each Browse list is backed by `ScrollView` virtual rendering and has a bounded load-more cursor for the next page.

### Round 3 Vision Correction / Bug Loop

- Pass: `plans/plan.md` now preserves the Round 2 and Round 3 requirement-bearing user inputs verbatim before further development.
- Pass: `plans/plan-v1.md` was created before the Round 3 material plan correction.
- Pass: The Browse bug was identified as spec drift plus UI behavior drift: the previous implementation had virtual list owners and manual cursor buttons, but did not make scrolling near the end request the next page.
- Pass: `specs/studio-notes-workbench/spec.md` now states that scrolling near the end of a stage with a next cursor requests the next page for that same stage.
- Pass: `NotesBrowseMode` now wires each stage's `ScrollView` viewport scroll event to the matching stage load-more callback through a Notes-local scroll pagination helper.
- Pass: BDD coverage now includes scroll pagination metrics/event behavior and the Browse source contract asserts the three scroll handlers.

### Round 4 OneNote Browse Layout

- Pass: `plans/plan.md` now preserves the OneNote layout correction verbatim.
- Pass: `plans/plan-v2.md` was created before the Round 4 material plan correction.
- Pass: `specs/studio-notes-workbench/spec.md` now requires notebook/page-scope switching above the body and `Sections` / `Pages` as the two body columns.
- Pass: `NotesBrowseMode` no longer renders notebooks, sections, and pages as three equal body columns. Notebook switching is a top horizontal `ScrollView`, while sections and pages remain the body columns.
- Pass: The Notes scroll pagination helper now supports horizontal scroll metrics so the top notebook switcher can page when scrolled near its end.
- Pass: Source-contract BDD now asserts the top notebook switcher, horizontal orientation, and two-column body class.

### Round 5 Runtime Two-Column Correction

- Pass: `plans/plan.md` now preserves the runtime correction inputs: the local `127.0.0.1:4173` server had just been restarted, the page still appeared as three columns, and URL/screenshot evidence was requested.
- Pass: Runtime DOM evidence from `http://127.0.0.1:4173/notes/avatar/default` identified the top notebook `ScrollView` viewport as `1132 x 92` after the fix, with two visible notebook buttons and two virtual items sized `184 x 92`.
- Pass: The root cause of the collapsed notebook switcher was shared `ScrollView` horizontal virtual content not owning a real block size. `ScrollView` now gives horizontal content `block-size: 100%`, and the shared layout contract covers this law.
- Superseded in Round 6: Round 5 forced selected-note detail through the compact layer so the default Browse body showed only `Sections` / `Pages`.
- Superseded in Round 6: Round 5 detail opened in the sheet layer with the split root remaining `data-compact="true"` and `data-detail-visible="false"`.

### Round 6 List-Detail / List-Mode Correction

- Pass: `plans/plan.md` now preserves the new acceptance input verbatim: Browse must still use list-detail, the list header must become `<NoteBookName> (?) ↓`, and the list body must switch between `Notebooks` and `SectionsAndPages` list projections.
- Pass: `specs/studio-notes-workbench/spec.md` now states the corrected law: the outer Browse surface remains list-detail; the list pane owns `Notebooks` / `SectionsAndPages` projections; selected-page detail remains the detail side.
- Pass: `NotesBrowseMode` no longer uses a top horizontal notebook switcher. The list pane header renders the selected notebook scope toggle plus source-root HelpHint, and clicking the toggle switches to a single-column virtual notebooks list.
- Pass: The default list projection is `SectionsAndPages`, with sections and pages as the two list-pane columns. Each column owns its own `ScrollView` and footer action area.
- Pass: Footer actions are visible as requested: `添加笔记本`, `添加章节`, and `添加页面`. They are disabled placeholders because the current NoteSystem facade creates notebook/section/page through write flows, not standalone create actions.
- Pass: `NotesAvatarRoute` restores persistent split-detail behavior for page detail with normal split sizing. Live 4173 DOM proof after selecting a page shows `data-compact="false"` and `data-detail-visible="true"`, with no detail sheet.

### Round 7 Browse Sort / Search Stack Refinement

- Pass: `NoteListSort` is now a NoteSystem/API/client-sdk list facade input. Notebook, section, and page list facades apply the requested sort before cursor slicing, so virtual scrolling and pagination keep one ordering law.
- Pass: Browse defaults to selecting and reading the first visible page when the current selected page is absent. Live 4173 proof shows the default Browse surface as list-detail with the first page opened in the persistent detail side.
- Pass: Browse exposes sort icon-buttons for Sections and Pages in the default `SectionsAndPages` projection and for Notebooks in the opened `Notebooks` projection. The sort selector title/options are `排序页面`, `无`, `字母排序`, `创建时间`, and `修改时间`.
- Pass: Search no longer uses the previous filter/results two-column scaffold. It is a single stack: search input, tags accordion, and result list.
- Pass: Notes search uses a small parser atom for `tag:<name>` tokens. Route execution sends parsed free text and parsed tags through the same `runtimeStore.searchNotes` path; tag clicks mutate the input instead of invoking a parallel tag-only RPC path.
- Pass: Search visible tags derive from non-empty result rows. When the input is empty, no result projection exists, or the result set is empty, the tag accordion falls back to the full tag catalog.
- Pass: Live 4173 proof for empty-result fallback used input `zzzxxyyqqq`, observed `No matching notes.`, clicked `architecture`, and confirmed the input became `tag:architecture` before the tag-backed result list loaded.

### Round 8 Detail / Query Polish

- Pass: `plans/plan.md` preserves the Round 8 requirement-bearing user input verbatim and the spec now covers loading badge suppression, Search/Query Empty detail, CodeMirror SQL input, and structured Query result rows.
- Pass: `@jixo/codemirror` now exports `SqlEditor`, an editable CodeMirror SQL surface with SQL language support, readonly/disabled handling, and textarea fallback only if CodeMirror initialization fails.
- Pass: Notes Query mode consumes `SqlEditor` from `@jixo/codemirror`; the feature route no longer owns direct CodeMirror setup for SQL input.
- Pass: Studio now has a local shadcn-style `Empty` UI primitive. `NotesPageDetailDrawer` renders it when Search or Query has no selected page.
- Pass: Query rows are normalized into `NotePageResultItem` records and rendered through the same `NotesPageResultList` structure used by Search. Rows with `notebook`, `section`, and `page` are selectable and open the shared page detail; rows without complete identity remain structured rows and are not rendered as JSON blocks.
- Pass: Browse default-first-page selection is scoped to `Browse` mode so direct Search/Query routes can show the Empty detail state instead of being hijacked by Browse's data-loading side effect.
- Pass: Notes page-toolbar badges and local Sections/Pages counts now suppress absent/loading zero counts; badges appear only for known positive counts.

### Round 9 Query Scroll Bug Loop

- Pass: `plans/plan.md` preserves the Query scroll bug report verbatim and the spec now states that Query result rows must use the same Stack/scroll-owner law as Search.
- Pass: `NotesQueryMode` no longer imports or wraps its body in `WorkbenchScaffold`. Its root now matches Search's `grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)]` structure.
- Pass: Query results remain rendered through `NotesPageResultList`, whose internal `ScrollView` owns the `notes-query-scroll` viewport.
- Pass: Focused source contract now asserts the Query scroll viewport and absence of the scaffold wrapper.

### Round 10 Query Density / Default Selection

- Pass: `plans/plan.md` preserves the Query row-density/default-selection feedback verbatim and the spec now states that Query rows must not repeat the same metadata.
- Pass: SQL result mapping now consumes identity columns, MIME, updated time, and preview/body columns before building auxiliary fields. For the default SQL, title/subtitle carry identity, MIME appears once as a badge, and `updatedAt` appears once as a field.
- Pass: Query's default read-only SQL auto-runs when Query mode opens with capability available and the default SQL unchanged.
- Pass: When SQL output arrives in Query mode, the first identity-bearing row is selected and the detail side opens. If no identity-bearing row exists, selected page remains null while the detail side stays open, so the Query Empty state is visible.
- Pass: Focused Notes state/source contracts cover the non-duplicated Query row projection and the default Query auto-run/auto-select source path.

### Round 11 Skeleton Pending States

- Pass: `plans/plan.md` preserves the Skeleton pending-state feedback verbatim and the spec now reserves Empty for completed no-selection/no-result states.
- Pass: `NotesPageResultList` owns a shared loading projection. Search and Query pass `searching` / `runningSql` into that atom, so pending result lists render Skeleton rows instead of Empty or placeholder content.
- Pass: `NotesPageDetailDrawer` owns a shared detail Skeleton projection. Search/Query pending states with no selected page render Skeleton before Empty, and selected page content loading also renders Skeleton instead of a text-only loading banner.
- Pass: `NotesAvatarRoute` computes the mode-aware pending detail signal once and passes it into the detail drawer, keeping Search/Query request knowledge out of the drawer.
- Pass: Focused source contracts assert the Skeleton imports, loading props, result-list skeleton rows, detail skeleton body, and mode-aware pending signal.

### Round 1 Scope Tabs

- Pass: `/notes` is now a fixed Overview workbench tab, and `/notes/avatar/[avatarNickname]` opens one dynamic avatar-scoped Notes tab.
- Pass: legacy `/notes?avatar=<nickname>` canonicalizes through route load to `/notes/avatar/<nickname>`.
- Pass: avatar selection moved out of the Notes body. Source roots remain metadata inside the selected avatar surface.
- Pass: avatar-local modes are page-toolbar tabs: `Browse`, `Search`, and `Query`.
- Pass: Browse preserves notebook/section/page hierarchy, detail metadata, tags, references, MIME, body preview, capability/empty/error states, and shared split-detail behavior.
- Pass: Search owns query input, tag filters, result count/state, and result-to-detail selection without switching avatar scope.
- Pass: Query remains read-only, scoped to the selected avatar, and uses the client runtime-store NoteSystem facade.
- Pass: Studio Notes source imports NoteSystem data only through `controller.runtimeStore` / `@agenter/client-sdk` types; no app-server or note-system implementation imports were introduced.
- Pass: mobile e2e exposed a shared shell issue where docked navigation could keep the sidebar expanded and squeeze the page body. Fixed it in the shared Sidebar so compact docked navigation returns to icon rail on route changes.
- Pass: follow-up refinement keeps source roots and page metadata inspectable through HelpHint affordances, while Note page content now renders through the shared `filePreviewer` shell via an authenticated HTTP source instead of a Notes-local `<pre>` renderer.

## Evidence

- `bun run --filter '@agenter/note-system' typecheck`
- `bun run --filter '@agenter/note-system' test`
- `bun test packages/app-server/test/trpc-router.test.ts --test-name-pattern "NoteSystem"`
- `bun test packages/client-sdk/test/runtime-store.test.ts --test-name-pattern "NoteSystem TRPC outputs"`
- Round 1 evidence retained: `bun run --filter 'agenter-app-studio' typecheck`
- `bun run --filter 'agenter-app-studio' test:unit -- src/lib/features/notes/notes-state.spec.ts src/lib/features/notes/notes-workbench-location.spec.ts src/lib/features/notes/notes-avatar-tabs-state.spec.ts src/lib/features/notes/notes-route-contract.spec.ts src/lib/components/ui/sidebar/sidebar-contract.spec.ts`
- `bun run --filter 'agenter-app-studio' test:unit -- src/lib/features/notes/notes-state.spec.ts src/lib/features/notes/notes-workbench-location.spec.ts src/lib/features/notes/notes-avatar-tabs-state.spec.ts src/lib/features/notes/notes-route-contract.spec.ts src/lib/components/file-preview/file-preview-state.spec.ts src/lib/dev/vite-dependency-optimization.spec.ts`
- Round 3 evidence: `bun run --filter 'agenter-app-studio' test:unit -- src/lib/features/notes/notes-scroll-pagination.spec.ts src/lib/features/notes/notes-route-contract.spec.ts src/lib/features/notes/notes-state.spec.ts`
- Round 4 evidence: `bun run --filter 'agenter-app-studio' test:unit -- src/lib/features/notes/notes-scroll-pagination.spec.ts src/lib/features/notes/notes-route-contract.spec.ts src/lib/features/notes/notes-state.spec.ts`
- Round 5 evidence: `bun run --filter 'agenter-app-studio' test:unit -- src/lib/features/notes/notes-scroll-pagination.spec.ts src/lib/features/notes/notes-route-contract.spec.ts src/lib/features/notes/notes-state.spec.ts`
- Round 5 evidence: `bun run --filter '@agenter/svelte-components' test -- src/layout-contract.spec.ts`
- Round 5 evidence: `bun run --filter '@agenter/svelte-components' typecheck`
- Round 5 evidence: `bunx svelte-check --workspace . --no-tsconfig --ignore "src/lib/features/mcp,src/routes/(app)/mcp,scripts" --threshold error --no-color` from `apps/studio`
- Round 5 evidence: `/tmp/agenter-notes-default-live-4173-after-v2.png`
- Round 5 evidence: `/tmp/agenter-notes-default-live-4173-detail-sheet.png`
- Round 6 evidence: `bun run --filter 'agenter-app-studio' test:unit -- src/lib/features/notes/notes-scroll-pagination.spec.ts src/lib/features/notes/notes-route-contract.spec.ts src/lib/features/notes/notes-state.spec.ts`
- Round 6 evidence: `bunx svelte-check --workspace . --no-tsconfig --ignore "src/lib/features/mcp,src/routes/(app)/mcp,scripts" --threshold error --no-color` from `apps/studio`
- Round 6 evidence: `bun run openspec:vision -- validate rework-notes-workbench-scope-tabs`
- Round 6 evidence: `/tmp/agenter-notes-round6-sections-pages.png`
- Round 6 evidence: `/tmp/agenter-notes-round6-notebooks-list.png`
- Round 6 evidence: `/tmp/agenter-notes-round6-list-detail.png`
- Round 7 evidence: `bun test packages/note-system/test/note-system.test.ts --test-name-pattern "NoteSystem"`
- Round 7 evidence: `bun test packages/app-server/test/trpc-router.test.ts --test-name-pattern "NoteSystem"`
- Round 7 evidence: `bun test packages/client-sdk/test/runtime-store.test.ts --test-name-pattern "NoteSystem"`
- Round 7 evidence: `bun run --filter 'agenter-app-studio' test:unit -- src/lib/features/notes/notes-search-syntax.spec.ts src/lib/features/notes/notes-route-contract.spec.ts src/lib/features/notes/notes-scroll-pagination.spec.ts src/lib/features/notes/notes-state.spec.ts`
- Round 7 evidence: `bunx svelte-check --workspace . --no-tsconfig --ignore "src/lib/features/mcp,src/routes/(app)/mcp,scripts" --threshold error --no-color` from `apps/studio`
- Round 7 evidence: `/tmp/agenter-notes-round7-browse-live.png`
- Round 7 evidence: `/tmp/agenter-notes-round7-notebooks-live.png`
- Round 7 evidence: `/tmp/agenter-notes-round7-search-live.png`
- Round 8 evidence: `bun run --cwd packages/codemirror test`
- Round 8 evidence: `bun run --cwd packages/codemirror typecheck`
- Round 8 evidence: `bun run --cwd apps/studio test:unit -- src/lib/features/notes/notes-state.spec.ts src/lib/features/notes/notes-route-contract.spec.ts src/lib/dev/vite-dependency-optimization.spec.ts`
- Round 8 evidence: `bun run openspec:vision -- validate rework-notes-workbench-scope-tabs`
- Round 8 evidence: `git diff --check`
- Round 9 evidence: `bun run --cwd apps/studio test:unit -- src/lib/features/notes/notes-route-contract.spec.ts`
- Round 9 evidence: `bun run openspec:vision -- validate rework-notes-workbench-scope-tabs`
- Round 9 evidence: `git diff --check`
- Round 10 evidence: `bun run --cwd apps/studio test:unit -- src/lib/features/notes/notes-state.spec.ts src/lib/features/notes/notes-route-contract.spec.ts`
- Round 10 evidence: `bunx svelte-check --workspace . --no-tsconfig --ignore "src/lib/features/mcp,src/routes/(app)/mcp,scripts" --threshold error --no-color` from `apps/studio`
- Round 10 evidence: `bun run openspec:vision -- validate rework-notes-workbench-scope-tabs`
- Round 10 evidence: `git diff --check`
- Round 11 evidence: `bun run --cwd apps/studio test:unit -- src/lib/features/notes/notes-state.spec.ts src/lib/features/notes/notes-route-contract.spec.ts`
- Round 11 evidence: `bunx svelte-check --workspace . --no-tsconfig --ignore "src/lib/features/mcp,src/routes/(app)/mcp,scripts" --threshold error --no-color` from `apps/studio`
- Round 11 evidence: `bun run openspec:vision -- validate rework-notes-workbench-scope-tabs`
- Round 11 evidence: `git diff --check`
- Round 2 evidence retained: `bun run --filter 'agenter-app-studio' e2e -- tests/e2e/notes-workbench.e2e.ts`
- `bun test packages/cli/test/trpc-server.test.ts --test-name-pattern "NoteSystem page content"`
- `bun run openspec:vision -- validate rework-notes-workbench-scope-tabs`
- `git diff --check`

## Not Run

- `bun run --filter 'agenter-app-studio' test:dom`: no Storybook DOM story was added or reused for this change.
- Current Round 2 full `bun run --filter 'agenter-app-studio' typecheck`: blocked by unrelated MCP form source passing `data-testid` to `ScrollView`, while targeted Notes Svelte check passed with MCP/perf harness excluded.
- Current Round 3 `bun run --filter 'agenter-app-studio' e2e -- tests/e2e/notes-workbench.e2e.ts`: blocked before page launch by current dirty `packages/app-server/src/trpc/router.ts` MCP route using reserved tRPC router key `call`.
- Current Round 4 browser smoke was not rerun because the same dirty `packages/app-server/src/trpc/router.ts` MCP route blocker prevents the Studio e2e web server from starting.
- Root workspace `bunx svelte-check --workspace . --no-tsconfig ...`: not used as the gate because it scans unrelated packages/perf harnesses and reports existing auth-service, MCP, workspace, and snippet-type diagnostics. The focused Studio command was run from `apps/studio` and passed.
- Current Round 8 full `bun run --cwd apps/studio typecheck`: blocked by existing dirty errors outside the Notes/Query/Codemirror path: missing `AppAvatarMemoryPackEnsureOutput` export, stale `RuntimeClientState` heartbeat fields in `runtime-shell-state.spec.ts`, and nullable MCP rows in `mcp-route.svelte`.
- Current Round 8 4173 live row proof: blocked by local backend `auth.autoLogin` returning HTTP 502 from `127.0.0.1:19190` after one earlier unauthenticated 4173 check confirmed the SQL editor asset could load. The authenticated Query flow could not be completed while auth was unavailable.

## Review Result

Round 11 keeps the Round 6/7 Browse and Search laws plus the Round 8/10 Query/detail polish, and adds the missing pending-state law: Search/Query pending result lists and no-selection details render Skeleton, while Empty is reserved for completed empty projections. The remaining unverified item from earlier rounds is live 4173 authenticated row proof because the local auth backend returned 502; the implemented source, unit, focused Svelte, OpenSpec, and whitespace evidence covers CodeMirror SQL, Empty detail, Skeleton pending states, structured Query rows, badge suppression, Query list scroll ownership, and default Query selection behavior.
