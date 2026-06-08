# Intent Document

## Current Round

- Round: 9
- Status: User reported a Query layout bug: the Query result list cannot scroll, which confirms Query must follow the Search page structure rather than keep a separate scaffold wrapper.
- Previous plan backup: `plans/plan-v8.md` was created before this Round 9 Query scroll bug loop.

## Workflow Command Surface

- Create change: `bun run openspec:vision -- new <change>`
- Check status: `bun run openspec:vision -- status <change>`
- Get artifact instructions: `bun run openspec:vision -- instructions <artifact> <change>`
- Strictly validate change files: `bun run openspec:vision -- validate <change>`
- Check commit evidence: `bun run openspec:vision -- commit-check <change> --phase <phase>`
- Rename after intent realignment: `bun run openspec:vision -- rename <old-change> <new-change>`
- Write abnormal-exit handoff: `bun run openspec:vision -- handoff <change>`
- Final workflow proof gate: `bun run openspec:vision -- check <change>`

## Original User Input

> 我看到 notes 页面的效果了，我提两点大方向的改进，首先搜索功能把它独立出来，参考AvatarDetail页面， 顶部 page toolbar 这里会支持多个 tab，还有，不要在页面里面挂角色选择器。请你参考 skills 这套页面，因为我们既有角色又有工作空间，两个是交织在一起的，所以一个 tap 应该只专注一个角色。
>
> 不要急着开始，好好调查，然后写 changes，跟我讨论一下你的想法和方案，最好是用 HTML 把草图画出来（在 change 中）

## Objective Record

### Requirement-Bearing Q&A

#### Verbatim Requirement Ledger

The following records preserve requirement-bearing user inputs verbatim. They are not normalized, typo-corrected, or converted into implementation language.

##### Turn 1

> 我看到 notes 页面的效果了，我提两点大方向的改进，首先搜索功能把它独立出来，参考AvatarDetail页面， 顶部 page toolbar 这里会支持多个 tab，还有，不要在页面里面挂角色选择器。请你参考 skills 这套页面，因为我们既有角色又有工作空间，两个是交织在一起的，所以一个 tap 应该只专注一个角色。
>
> 不要急着开始，好好调查，然后写 changes，跟我讨论一下你的想法和方案，最好是用 HTML 把草图画出来（在 change 中）

##### Turn 2

> 1 Overview
> 2 独立 tab
> 3 yes

##### Turn 3

> 有一个点要改进：Notebooks这里，需要支持虚拟滚动，因为我们的notebook可能非常多。同时你们还把sections也混进来了。所以你可能没有考虑过分页要怎么做。我个人的想法是吧这里做成三段式：就是两个list-detail 嵌套。
>
> notebooks->setions->page
>
> 你觉得呢？还是觉得就还是现在这套notebooks(with sections)->page ?
> 关键是我不知道 notebooks(with sections) 怎么设计分页和滚动会比较好。
> 如果要坚持 notebooks(with sections) 这样的世界，那么notebook就要设计成一个卡片，默认是不展开的，点击展开卡片，里面是一套分页加载的。打开就意味着订阅。从而实现实时推送（我们整个页面都是实时的，没错吧）

##### Turn 4

> continue apply this change

##### Turn 5

> 有BUG，你是不是没用openspec vision去推进任务？先把我给你提的要求客观记录到 change中，再去迭代开发

##### Turn 6

> 改掉目前的布局，参考OneNote的布局：
>
> [Image #1]
> page的切换在正上方。
> 然后两列分别是sections+pages，这样比你用三列来的合理

##### Turn 7

> 我没看到你的改动效果啊，现在还是三列布局

##### Turn 8

> 这和 NotesPageDetailDrawer 有什么关系呢，你有截图证明你改了吗？或者有url给我看看

##### Turn 9

> 我现在这个url（ 127.0.0.1:4173）是我刚刚重启的，我已经排除了我能排除的各种异常可能的

##### Turn 10

> 你的首先还是没有符合我的要求，我直接说明几个重要的验收点：
> 1. 首先仍然要使用list-detail布局
> 2. list页面顶部的`Notebooks (?)  (N pages)` 这里，直接改成 `<NoteBookName>  (?) ↓` ，点击可以把下方的双列区域的视图改成 Notebooks List单列列表。是的，不是Select-Popover组件，而是直接使用List来显示
> 3. list页面的正文部分，有两种模式，一种是 NoteBooks List；一种是 SectionsAndPages List
> ```
> <header>
> ---------
> NoteBook1
> NoteBook2
>
>
> ---------
> <footer>
> ```
> 这里footer就是一个Actions，目前只需要提供“添加笔记本”这个按钮
>
> ```
> <header>
> ----------------
> Section1 | Page1
> Section2 | Page2
>          | Page3
>          |
> ----------------
> <Fot1>   | <Fot2>
> ```
> 同理Fot1只有一个“添加章节”的按钮，Fot2只有一个“添加页面”的按钮

##### Turn 11

> 在打开NotebookList的时候，顶部Header变成“Notebooks (?) ⬆️”，因为我们的当前选中的Notebook会出现在列表中，并显示选中的样式

##### Turn 12

> `<NOTEBOOK_TITLE> (?) (n pages)`，这里没必要显示`(n pages)`

##### Turn 13

> 0. 这个页面的结构基本可以，最后再补充一些体验：
> 0.1. 默认打开第一页
> 0.2.  `Pages   (n)` 改成 `Pages (n)    (ORDER)`，这里补充一个排序icon-button，点击出现一个选择器，标题是“排序页面”，可以选择排序时间：无、字母排序、创建时间、修改时间
> 0.3. 同理`Sections (n)    (ORDER)`；`Notebooks (n) (?)    (ORDER)`
>
>
> 1. 搜索页面，使用Stack布局，分别是搜索框、tags、list。其中tags是一个手风琴，最大就显示2行。多的就收起来。
>
> 2. 搜索语法，参考项目中已有的一些搜索框的逻辑。
>
> 2.1. 理论上可以搜索元数据+正文的内容。元数据就包含pagename、sectionname、nookbookname
> 2.2. 还可以支持标签化搜索：比如 `tag:ux 哈哈哈`
>
> 2.3. 也就是说，点击tags，本质是是在输入框中，添加`tag:XXX` 的语法（不绝对，下面还有另外一种情况）。
>
> 3. tags会根据目前搜索出来的列表自动变更。比如现在搜索出来20条，那么tags只会显示这20条数据的所有tags。
>
> 4. 在没有搜索语句或者搜索结果为空的情况下，会显示所有的tags
> 4.1. 如果搜索结果为空，点击tag，会清空input然后再添加`tag:XXX`，接着才会重新开始搜索

##### Turn 14

> 0. 差不多了，最后一些小细节，loading的，不要显示'(0)'
> 1. Search面板没有选中任何Page的时候，右侧就显示一个Empty（ShadcnUI的组件）就好
> 2. 同理Query面板也是同上
> 3. Query面板的SQL输入框应该是 基于codemirror的，有高亮支持的。
> 4. Query面板搜索出来的条目现在只是展示成JSON。请参考Search面板的结构，进行重构开发

##### Turn 15

> Query 页面的列表无法滚动（所以一开始我就强调，你要参考Search页面）

| Turn | Speaker | Objective record                                                                                                                                         | Impact on intent                                                                                                                                              |
| ---- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | User    | "搜索功能把它独立出来"                                                                                                                                   | Search must stop being an inline panel inside the browse page. It becomes its own page-tab/surface.                                                           |
| 1    | User    | "参考AvatarDetail页面， 顶部 page toolbar 这里会支持多个 tab"                                                                                            | Notes should use the shared page-toolbar tab pattern for local modes, not only body-local controls.                                                           |
| 1    | User    | "不要在页面里面挂角色选择器"                                                                                                                             | Avatar selection must move out of the Notes body.                                                                                                             |
| 1    | User    | "参考 skills 这套页面"                                                                                                                                   | Skills workbench is the nearest pattern for avatar-scoped tabs.                                                                                               |
| 1    | User    | "既有角色又有工作空间，两个是交织在一起的，所以一个 tap 应该只专注一个角色"                                                                              | A tab is an avatar scope. Workspace grouping may exist inside that avatar scope, but a tab must not switch roles.                                             |
| 1    | User    | "不要急着开始，好好调查，然后写 changes，跟我讨论一下"                                                                                                   | This round creates OpenSpec artifacts and sketch only; no app implementation.                                                                                 |
| 1    | User    | "最好是用 HTML 把草图画出来（在 change 中）"                                                                                                             | Add a change-local HTML sketch under `demos/`.                                                                                                                |
| 2    | User    | "1 Overview"                                                                                                                                             | `/notes` remains a fixed Overview tab rather than redirecting directly to an avatar.                                                                          |
| 2    | User    | "2 独立 tab"                                                                                                                                             | Read-only SQL remains a dedicated `Query` page-toolbar tab.                                                                                                   |
| 2    | User    | "3 yes"                                                                                                                                                  | Workspace/source roots are only grouping/filtering metadata inside one avatar tab, not a second tab identity axis.                                            |
| 3    | User    | "Notebooks这里，需要支持虚拟滚动，因为我们的notebook可能非常多。同时你们还把sections也混进来了。"                                                        | Browse must not render one full notebook/section/page tree. Notebook navigation needs virtual scrolling and sections must become a separate navigation stage. |
| 3    | User    | "我的想法是吧这里做成三段式：就是两个list-detail 嵌套。notebooks->setions->page"                                                                         | Adopt a three-stage Browse model: notebooks select sections, sections select pages, pages select detail.                                                      |
| 3    | User    | "关键是我不知道 notebooks(with sections) 怎么设计分页和滚动会比较好。"                                                                                   | Reject the full expanded tree as the canonical model because pagination/scroll ownership becomes unclear.                                                     |
| 3    | User    | "如果要坚持 notebooks(with sections) 这样的世界，那么notebook就要设计成一个卡片，默认是不展开的，点击展开卡片，里面是一套分页加载的。打开就意味着订阅。" | If nested cards ever return, expansion must mean scoped pagination/subscription; for this round the three-stage law is the cleaner platform update.           |
| 4    | User    | "continue apply this change"                                                                                                                             | After the discussion, proceed from the recorded change into implementation.                                                                                   |
| 5    | User    | "有BUG，你是不是没用openspec vision去推进任务？先把我给你提的要求客观记录到 change中，再去迭代开发"                                                      | Stop implementation-first work, repair the OpenSpec vision record, validate the change, then investigate and fix the bug under the updated change record.     |
| 6    | User    | "改掉目前的布局，参考OneNote的布局"                                                                                                                      | The current Browse visual layout must be changed to follow OneNote's visible navigation hierarchy.                                                            |
| 6    | User    | "page的切换在正上方。"                                                                                                                                   | The notebook/page-scope switcher should move to the top of Browse, not remain as a full left body column.                                                     |
| 6    | User    | "然后两列分别是sections+pages，这样比你用三列来的合理"                                                                                                   | The Browse body should use two columns for sections and pages. Three visible body columns are rejected for this layout.                                       |
| 7    | User    | "现在还是三列布局"                                                                                                                                       | A persistent selected-note detail pane still counts against the visible layout if it makes Browse appear as three columns.                                     |
| 8    | User    | "你有截图证明你改了吗？或者有url给我看看"                                                                                                                | Runtime URL and screenshot/DOM evidence are required; component-level rationale is insufficient.                                                              |
| 9    | User    | "127.0.0.1:4173）是我刚刚重启的"                                                                                                                         | Treat the restarted local server at `127.0.0.1:4173` as the source of truth, not stale cache or an old server.                                                 |
| 10   | User    | "首先仍然要使用list-detail布局"                                                                                                                         | Reopen the Round 5 conclusion that forced selected-page detail into a sheet; the top-level Browse surface must remain list-detail.                             |
| 10   | User    | "`Notebooks (?)  (N pages)` 这里，直接改成 `<NoteBookName>  (?) ↓`"                                                                                       | The list header should show the selected notebook as the scope label, keep the HelpHint affordance, and expose a direct toggle affordance.                     |
| 10   | User    | "点击可以把下方的双列区域的视图改成 Notebooks List单列列表"                                                                                              | The list panel body has a local view mode: `sections-pages` by default and `notebooks` as a single-column list after clicking the notebook header.             |
| 10   | User    | "不是Select-Popover组件，而是直接使用List来显示"                                                                                                        | Notebook selection must not be a Select/Popover; it is a real list view inside the same list panel.                                                           |
| 10   | User    | "list页面的正文部分，有两种模式，一种是 NoteBooks List；一种是 SectionsAndPages List"                                                                    | The list pane body supports exactly two projections for Browse: notebook list or sections/pages list.                                                         |
| 10   | User    | "footer就是一个Actions，目前只需要提供“添加笔记本”这个按钮"                                                                                              | Notebook list has a footer action area with an add-notebook button.                                                                                           |
| 10   | User    | "Fot1只有一个“添加章节”的按钮，Fot2只有一个“添加页面”的按钮"                                                                                             | Sections and pages columns each have a footer action area with one add button.                                                                                |
| 11   | User    | "打开NotebookList的时候，顶部Header变成“Notebooks (?) ⬆️”"                                                                                              | When the notebook list projection is open, the list header label is the projection title `Notebooks`, not the selected notebook title.                         |
| 11   | User    | "当前选中的Notebook会出现在列表中，并显示选中的样式"                                                                                                     | The selected notebook state should be represented by the highlighted row inside the notebook list.                                                            |
| 12   | User    | "`<NOTEBOOK_TITLE> (?) (n pages)`，这里没必要显示`(n pages)`"                                                                                            | The outer list header must not show a page-count badge; counts belong in list rows or column headers.                                                         |
| 13   | User    | "默认打开第一页"                                                                                                                                         | When Browse pages load and no selected page is still visible, select/read the first page by default.                                                          |
| 13   | User    | "`Pages   (n)` 改成 `Pages (n)    (ORDER)`"                                                                                                               | Pages column header needs an icon-button sorting control next to its count.                                                                                    |
| 13   | User    | "标题是“排序页面”，可以选择排序时间：无、字母排序、创建时间、修改时间"                                                                                   | The page sorting selector title is `排序页面` and choices are none, alphabetic, created time, updated time.                                                    |
| 13   | User    | "同理`Sections (n)    (ORDER)`；`Notebooks (n) (?)    (ORDER)`"                                                                                           | Sections and Notebooks headers need equivalent sorting controls; Notebooks header also keeps HelpHint.                                                        |
| 13   | User    | "搜索页面，使用Stack布局，分别是搜索框、tags、list"                                                                                                      | Search mode should be vertical stack layout, not filter column + result column.                                                                                |
| 13   | User    | "tags是一个手风琴，最大就显示2行。多的就收起来"                                                                                                         | Tags area uses accordion/collapsible behavior with collapsed height capped to about two tag rows.                                                             |
| 13   | User    | "搜索语法，参考项目中已有的一些搜索框的逻辑"                                                                                                             | Use simple input-driven search syntax rather than parallel tag-only state paths.                                                                               |
| 13   | User    | "可以搜索元数据+正文的内容。元数据就包含pagename、sectionname、nookbookname"                                                                              | The search backend must cover page, section, notebook metadata and body.                                                                                       |
| 13   | User    | "支持标签化搜索：比如 `tag:ux 哈哈哈`"                                                                                                                   | Search input parser must extract `tag:<name>` tokens and submit remaining text as full-text query.                                                            |
| 13   | User    | "点击tags，本质是是在输入框中，添加`tag:XXX` 的语法"                                                                                                     | Tag clicks normally mutate the search input with `tag:<name>` and run the same parser-backed search path.                                                     |
| 13   | User    | "tags会根据目前搜索出来的列表自动变更"                                                                                                                   | Tag suggestions are result-derived when there are non-empty search results.                                                                                    |
| 13   | User    | "在没有搜索语句或者搜索结果为空的情况下，会显示所有的tags"                                                                                               | Tag suggestions fall back to all tags when the input is empty or the current search result is empty.                                                          |
| 13   | User    | "如果搜索结果为空，点击tag，会清空input然后再添加`tag:XXX`，接着才会重新开始搜索"                                                                          | In empty-result state, tag click replaces input with `tag:<name>` instead of appending.                                                                        |
| 14   | User    | "loading的，不要显示'(0)'"                                                                                                                                 | Page-toolbar/local count badges must not render a misleading zero while the backing projection is still loading or absent.                                      |
| 14   | User    | "Search面板没有选中任何Page的时候，右侧就显示一个Empty（ShadcnUI的组件）就好"                                                                              | The shared Notes detail side should render the shadcn `Empty` component when Search has no selected page.                                                      |
| 14   | User    | "同理Query面板也是同上"                                                                                                                                    | The same no-selected-page detail law applies to Query.                                                                                                        |
| 14   | User    | "Query面板的SQL输入框应该是 基于codemirror的，有高亮支持的。"                                                                                              | Query SQL entry should be a CodeMirror editor with SQL highlighting, not a plain input.                                                                        |
| 14   | User    | "Query面板搜索出来的条目现在只是展示成JSON。请参考Search面板的结构，进行重构开发"                                                                          | Query output should be normalized into structured result rows aligned with Search, with selectable page rows when SQL returns notebook/section/page identity. |
| 15   | User    | "Query 页面的列表无法滚动"                                                                                                                                | Query result list must have the same explicit Stack/scroll-owner structure as Search and must not be wrapped in a scaffold/body layer that breaks scrolling.  |
| 15   | User    | "所以一开始我就强调，你要参考Search页面"                                                                                                                  | The fix should reduce structural divergence from Search instead of adding Query-only overflow patches.                                                        |

### Evidence Read

| Source                                                                                                | Fact                                                                                                                                                                                                                                                                | Why it matters                                                                                                                           |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/studio/SPEC.md`                                                                                 | Notes is a first-class `/notes` system workbench and must consume NoteSystem through client-sdk runtime-store facades only. It must expose no-capability, empty, loading, error, search, tags, SQL, and page-detail states without reading markdown files directly. | The change must preserve the client-sdk facade law and all Notes states while reorganizing navigation.                                   |
| `apps/studio/src/lib/features/notes/notes-route.svelte`                                               | Current Notes page owns `selectedAvatar` as URL query/body state and renders an inline `<select aria-label="Notes avatar">` in the route header.                                                                                                                    | This is the direct conflict with "不要在页面里面挂角色选择器".                                                                           |
| `apps/studio/src/lib/features/notes/notes-route.svelte`                                               | Current search, tag filtering, read-only SQL, catalog browse, and detail drawer all live in one route body.                                                                                                                                                         | Search is not independent; local modes are mixed inside the same surface.                                                                |
| `apps/studio/src/lib/features/skills/skills-workbench-layout.svelte`                                  | Skills workbench owns top-level tabs: fixed Catalog tab plus closable avatar tabs persisted in localStorage.                                                                                                                                                        | This is the model for "one tab focuses one avatar".                                                                                      |
| `apps/studio/src/lib/features/skills/skill-avatar-tabs-state.ts`                                      | Skill avatar tabs are keyed only by avatar nickname and route to `/skills/avatar/[avatarNickname]`.                                                                                                                                                                 | Notes can reuse the same law: a tab ID represents one avatar scope, not a role selector embedded in content.                             |
| `apps/studio/src/lib/features/skills/skill-avatar-route.svelte`                                       | One avatar tab shows workspace-grouped skill browser under that avatar, and its toolbar identity is the avatar.                                                                                                                                                     | Workspace remains visible as grouping inside the avatar scope.                                                                           |
| `apps/studio/src/lib/features/runtime/runtime-shell.svelte` and `runtime-page-toolbar-content.svelte` | AvatarDetail/runtime pages mount `WorkbenchPageToolbar` and pass `pageTabs` into `WorkbenchToolbar`.                                                                                                                                                                | This is the shared local-tab chrome pattern requested by "顶部 page toolbar".                                                            |
| `apps/studio/src/lib/features/notes/notes-route-contract.spec.ts`                                     | Existing contract tests expect `/notes` route, runtime-store facades, search, SQL, References, ScrollView, and no app-server imports.                                                                                                                               | Tests need to evolve rather than be removed.                                                                                             |
| `apps/studio/tests/e2e/notes-workbench.e2e.ts`                                                        | E2E currently seeds notes through `note.write`, opens `/notes`, selects avatar via `Notes avatar`, then verifies detail metadata, tags, references, and SQL.                                                                                                        | Browser acceptance must be rewritten to open/avatar-tab instead of body selector while preserving metadata/tags/references/SQL evidence. |

### Git Evidence

| Checkpoint                      | Expected commit evidence                                                                            | Current status                                      |
| ------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| OpenSpec artifacts before apply | Commit containing `plans/plan.md`, specs, and `tasks.md` before app-code work starts                | Not committed yet; user requested discussion first. |
| Task-progress commits           | Commit containing current-context task checkbox updates plus matching code/BDD evidence             | Not started.                                        |
| Self-review updates             | Commit containing review output and any reopened or added OpenSpec tasks before the next apply loop | Not started.                                        |
| Normal archive                  | Commit containing `openspec archive <change>` result                                                | Not started.                                        |
| Abnormal handoff                | Commit containing `HANDOFF.md` / `vN.HANDOFF.md` evidence before returning to user discussion       | Not needed.                                         |

### Existing OpenSpec Survey

| File / change                                                | Existing law or pattern                                                                                     | Reuse, extend, or break                                                 |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `apps/studio/SPEC.md`                                        | Notes is a first-class system workbench and client-sdk projection consumer.                                 | Extend. The route architecture changes, the NoteSystem truth law stays. |
| `openspec/changes/add-studio-mcp-system-ui/design.md`        | System workbenches belong beside Skills/Terminals/Workspaces and should use list-detail plus toolbar scope. | Reuse the workbench-scoped thinking.                                    |
| `openspec/changes/add-heartbeat-record-pagination/plan.html` | HTML demos inside changes are acceptable confirmation artifacts.                                            | Reuse the change-local demo pattern.                                    |
| `apps/studio/src/lib/features/skills/*`                      | Workbench tabs can represent avatar scope, while workspace groups are content inside the selected avatar.   | Extend to Notes.                                                        |
| `apps/studio/src/lib/features/runtime/*page-toolbar*`        | Page toolbar owns local page tabs.                                                                          | Reuse for Browse/Search/Query modes inside one avatar tab.              |

### User Language System

| User phrase                                           | Working meaning                                                                         | Plain-language translation when needed                                                     |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| "搜索功能把它独立出来"                                | Search should be a dedicated local mode/surface, not a mixed inline utility panel.      | Search becomes a page tab.                                                                 |
| "参考AvatarDetail页面"                                | Use existing Studio page-toolbar/page-tabs chrome.                                      | Put local tabs in the top toolbar.                                                         |
| "不要在页面里面挂角色选择器"                          | The content body must not own role/avatar switching.                                    | Avatar switch belongs to workbench tabs or navigation.                                     |
| "参考 skills 这套页面"                                | Follow Skills' avatar-tab and workspace-grouped content law.                            | One tab per avatar.                                                                        |
| "一个 tap 应该只专注一个角色"                         | A tab's primary identity is exactly one avatar.                                         | Do not multiplex avatar state inside a tab.                                                |
| "Notebooks这里，需要支持虚拟滚动"                     | Notebook navigation must scale to many notebooks without rendering the whole hierarchy. | Use explicit scroll/paging boundaries for notebooks.                                       |
| "notebooks->setions->page"                            | The preferred Browse model is three-stage navigation.                                   | Notebook selects sections; section selects pages; page opens detail.                       |
| "notebooks(with sections)"                            | The rejected/uncertain alternative where sections are mixed into notebook rows.         | If ever used, notebooks must be collapsed cards with paged loaded sections.                |
| "打开就意味着订阅"                                    | Opening an expandable notebook would create a scoped live/paged data subscription.      | Do not subscribe/render every notebook's sections by default.                              |
| "先把我给你提的要求客观记录到 change中，再去迭代开发" | The change record must preserve requirements before further code iteration.             | Vision artifacts lead implementation; code changes must trace back to recorded user input. |
| "参考OneNote的布局"                                   | The visible navigation hierarchy should resemble OneNote.                               | Use a top switcher plus body columns rather than equal three-column panes.                 |
| "page的切换在正上方"                                  | The higher-level note scope switch belongs above the body columns.                      | Notebook/page-scope selection becomes a top horizontal switcher.                           |
| "两列分别是sections+pages"                            | The main Browse body should have exactly two navigation columns.                        | Body columns are Sections and Pages.                                                       |
| "现在还是三列布局"                                    | A persistent selected-note pane can still violate the visual intent.                    | Detail should not be a permanent third body column in Browse.                              |
| "127.0.0.1:4173 是我刚刚重启的"                       | Runtime evidence must use the restarted local server as truth.                          | Do not explain the issue as stale cache without evidence.                                  |
| "仍然要使用list-detail布局"                           | The outer Browse surface still has a list side and a detail side.                       | Do not remove the detail pane law; fix the list side structure.                            |
| "`<NoteBookName> (?) ↓`"                              | The list header's primary label is the selected notebook scope.                         | Replace the generic `Notebooks` + page-count header with current notebook + HelpHint.      |
| "不是Select-Popover组件，而是直接使用List来显示"      | Notebook switching is a first-class list projection, not a compact overlay control.     | Clicking the header swaps the list body into a virtual notebook list.                      |
| "NoteBooks List"                                      | A single-column list pane projection for notebook selection.                            | It has one scroll owner and a footer action area.                                          |
| "SectionsAndPages List"                               | A two-column list pane projection under the selected notebook.                          | Sections and Pages each own scroll/paging and footer actions.                              |

### Demo / Spike Code

| Path                                                                                       | Question it answers                                                                                               | Keep, migrate, or delete                                                                  |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `openspec/changes/rework-notes-workbench-scope-tabs/demos/notes-workbench-scope-tabs.html` | What should the new Notes workbench feel like after avatar scope moves to tabs and Search becomes local page-tab? | Keep as discussion artifact; migrate into implementation only as layout intent, not code. |

### Confirmed Decisions

| Question                                                                                                                              | Confirmed answer                                                                                                | Implementation impact                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Should Notes keep a fixed catalog/default tab like Skills, or should `/notes` immediately resolve to the default avatar tab?          | Overview.                                                                                                       | Keep `/notes` as a fixed Overview tab that lists avatars with NoteSystem capability and opens avatar tabs.                                    |
| Should the local page-toolbar tabs be `Browse / Search / Query`, or should SQL be hidden behind an advanced action rather than a tab? | 独立 tab.                                                                                                       | Make `Query` a dedicated page-toolbar tab, visually advanced/read-only.                                                                       |
| Should a workspace dimension be selectable at the avatar-tab level?                                                                   | Yes to the proposed law.                                                                                        | Do not add workspace/source roots to tab identity; keep them as grouping/filtering metadata inside one avatar tab.                            |
| Should Browse stay as `notebooks(with sections)->page` or move to a staged model?                                                     | User proposed `notebooks->setions->page` and asked to avoid mixed sections because paging/scrolling is unclear. | Treat three-stage Browse as the current intended law; the nested card alternative remains a rejected fallback unless explicitly chosen later. |
| Should Browse remain a three-column notebook/section/page layout?                                                                      | No. User asked to reference OneNote and use two body columns inside the list pane: `sections+pages`.            | Do not render notebooks, sections, and pages as three equal navigation columns.                                                               |
| Should the selected-note detail stay as a persistent right split pane in Browse?                                                       | Yes after Round 6 clarification: "仍然要使用list-detail布局".                                                   | Restore normal list-detail semantics. The detail pane is the detail side; the list side owns the notebook-list / sections-pages view mode.     |
| Should notebook switching be a top horizontal switcher?                                                                                | No after Round 6 clarification.                                                                                 | The list header shows `<NoteBookName> (?) ↓`; clicking it switches the list body to a single-column Notebooks List.                           |

### Workflow Correction

| Correction                                                        | Objective record                                      | Consequence                                                                                                                                                            |
| ----------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vision-first process was not followed strictly enough in Round 2. | "有BUG，你是不是没用openspec vision去推进任务？"      | Before further development, the Round 2 and Round 3 user inputs are preserved verbatim in `plans/plan.md`, the plan backup is created, and validation must pass again. |
| Requirements must be recorded before iteration.                   | "先把我给你提的要求客观记录到 change中，再去迭代开发" | The next implementation loop starts only after this artifact update is validated.                                                                                      |

## Intent

### Surface Intent

Rework Studio Notes so a Notes tab is scoped to one avatar, local modes such as Search move into the top page toolbar, and the body no longer carries an avatar selector. Use Skills as the avatar/workspace precedent and AvatarDetail/runtime as the page-toolbar tab precedent.

### Underlying Drive

The current Notes page lets one page body switch between avatars while also browsing notebooks, showing tags, searching, running SQL, and opening detail. That makes the page body own too many coordinate axes:

- avatar role
- workspace/source projection
- NoteSystem hierarchy
- search/filter mode
- SQL/query mode
- page detail

The durable app law should be: the workbench tab owns the avatar scope; the page toolbar owns the local mode inside that avatar; the content body renders exactly one mode.

### Final Visible Effect

An operator opens Notes and sees workbench tabs like:

```text
Overview | Default | Architect | Researcher
```

Selecting `Default` opens one avatar-scoped Notes surface. The top page toolbar identifies `@default`, shows metadata like total pages/tags/source roots, and exposes local tabs:

```text
Browse | Search | Query
```

The page body contains no avatar selector. Browse shows notebooks/sections/pages and detail. Search is a full dedicated surface with query, tags, result list, and preview/detail. Query is a dedicated advanced surface for read-only SQL. Workspace/source facts are shown as grouping/filtering inside the selected avatar scope, not as another role switch.

Round 4 visible correction: Browse should feel closer to OneNote. The higher-level notebook/page-scope switch is a horizontal control at the top of Browse, and the body underneath is two columns: Sections and Pages. This preserves the staged data law without making notebooks, sections, and pages appear as three equal panes.

Round 5 runtime correction: the restarted `127.0.0.1:4173` page is the truth source. If the selected-note detail is rendered as a persistent right split pane, the operator still sees three vertical areas. The selected page detail must use the shared compact detail layer for this Notes surface so the Browse body remains the visible two-column `Sections` / `Pages` layout.

Round 6 acceptance correction: the Round 5 conclusion over-corrected the layout by removing the persistent list-detail model. The current user acceptance points explicitly require list-detail. The correct law is: the outer Notes Browse surface remains list-detail; the list pane header shows the selected notebook with HelpHint and a down affordance; clicking that header switches the list pane body into a real single-column Notebooks List; the default list pane body is the SectionsAndPages List with two columns and footer actions.

## Platform Diagnosis

- Current platform laws:
  - Studio workbenches are route-owned surfaces inside `WorkbenchWindow`.
  - Shared top chrome is `WorkbenchPageToolbar` and `WorkbenchToolbar`.
  - Skills already models avatar-scoped tabs plus workspace-grouped content.
  - Notes must consume NoteSystem only through client-sdk runtime-store facades.
- Does this fit as a regular atom:
  - Partly. The UI primitives and client facades already exist.
- Does this require law upgrade:
  - Yes at the Notes workbench level. Notes must stop treating avatar scope as page-local form state and promote it to workbench tab/route state.
- Breaking update stance:
  - Recommended to break the old `/notes?avatar=...` mental model and replace it with canonical `/notes/avatar/[avatarNickname]/[mode?]` routes, with redirects for old links.
- User confirmations:
  - Fixed Overview tab confirmed.
  - Dedicated Query page-toolbar tab confirmed.
  - Workspace/source grouping inside one avatar tab confirmed.

## Reverse-Inferred Design

### Interaction / Visual Story

1. User opens `/notes`.
2. The workbench shows an Overview tab and any persisted avatar tabs.
3. Overview lists avatars with NoteSystem capability, page counts, tag counts, and source roots.
4. User opens an avatar. A new workbench tab appears for that avatar.
5. Inside the avatar tab, the page toolbar shows:
   - avatar identity leading/avatar icon
   - title `@avatar`
   - subtitle with NoteSystem source/root summary
   - statuses such as `10 pages`, `21 tags`
   - page tabs: `Browse`, `Search`, `Query`
6. Browse body only browses hierarchy and detail.
7. Search body only searches and filters.
8. Query body only runs read-only SQL and shows rows.

### Interface Shape

- Workbench routes:
  - `/notes` fixed Overview tab.
  - `/notes/avatar/[avatarNickname]` default avatar tab Browse mode.
  - `/notes/avatar/[avatarNickname]/search` Search mode.
  - `/notes/avatar/[avatarNickname]/query` read-only SQL mode.
- Persisted tab state:
  - `notes-avatar:<avatarNickname>`.
  - Close semantics match Skills.
- Local mode state:
  - URL path segment, not hidden component state.
  - Browser back/forward changes mode without changing avatar tab.

### Data Shape

- Durable facts:
  - NoteSystem catalog/page/search/tags/query projections from client-sdk.
  - Avatar catalog identity/icon projection.
- UI projections:
  - Workbench avatar tabs.
  - Page toolbar local mode tabs.
  - Browse/search/query view models.
- Must not confuse:
  - Avatar tab identity is not the NoteSystem page selection.
  - Workspace/source root is metadata/grouping inside avatar scope, not a role selector.
  - Search results are a projection, not canonical page hierarchy.

### Architecture Shape

- Add Notes workbench layout atom analogous to Skills workbench layout.
- Add Notes avatar tab state atom analogous to `skill-avatar-tabs-state.ts`.
- Add Notes workbench location atom for canonical hrefs and legacy query normalization.
- Add paged NoteSystem browse facades for notebooks, notebook sections, and section pages.
- Split current `NotesRoute` into:
  - layout/workbench shell
  - overview route
  - avatar route
  - mode/body components: browse, search, query
  - shared avatar-scope state/controller
- Keep all NoteSystem operations through `controller.runtimeStore`.
- Browse owns explicit scroll owners:
  - notebooks inside the `Notebooks List` list-pane projection
  - sections inside the `SectionsAndPages List` list-pane projection
  - pages inside the `SectionsAndPages List` list-pane projection
- Forbidden couplings:
  - No app-server or note-system imports in Studio.
  - No body-level avatar selector.
  - No global workspace selector that changes avatar identity inside the same tab.

### User Confirmation Gates

| Gate                   | Why confirmation is required                                     | Default until user answers                                                    |
| ---------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Overview tab           | `/notes` needs a destination when no avatar tab is active.       | Confirmed: add Overview.                                                      |
| SQL visibility         | User explicitly named search but current Notes law includes SQL. | Confirmed: keep Query as an independent page-toolbar tab.                     |
| Workspace presentation | User mentioned role/workspace interweaving.                      | Confirmed: show workspace/source group inside avatar scope, not tab identity. |

## Intent-Driven Plan

- [x] 1. Research and align intent.
- [x] 2. Write specs from the intent.
- [x] 3. Write BDD tasks from specs.
- [ ] 4. Implement tasks, including Round 2 paged Browse.
- [ ] 5. Self-review against intent and decide whether to loop.
- [ ] 6. Round 3 correction: preserve the user's reopened requirements verbatim, validate the change, then investigate and fix the reported bug.
- [ ] 7. Round 4 layout correction: replace the three-column Browse visual layout with a OneNote-style top scope switcher and two body columns for sections/pages.
- [ ] 8. Round 5 runtime correction: use restarted `127.0.0.1:4173` evidence to keep Browse visibly two-column and selected-note detail out of the persistent body columns.
- [ ] 9. Round 6 acceptance correction: restore list-detail, move notebook switching into the list header/list-body projection, and add footer action slots for notebooks, sections, and pages.

## Open Questions

| Question                                                                                 | Why it matters                                                              | Default assumption until user answers                                                                                                                                     |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Do you want `/notes` to show Overview, or redirect to default avatar?                    | This decides the fixed tab model.                                           | Confirmed: Overview tab.                                                                                                                                                  |
| Is Query a page-tab or an advanced action under Browse/Search?                           | This affects top toolbar density.                                           | Confirmed: Query page-tab.                                                                                                                                                |
| Should tag filter live in Search only, or also appear as Browse-side metadata shortcuts? | Search independence may imply tags move out of Browse.                      | Tags primarily live in Search; Browse only shows page tags in detail.                                                                                                     |
| What is the exact visible BUG after the Round 2 Browse implementation?                   | The latest user input reports a bug but does not name the failing UI state. | First inspect the new Browse behavior against the recorded intent; if the bug is not reproducible from local evidence, ask for the smallest route/state where it appears. |

## Rejected Paths

| Path                                                         | Why rejected                                                                                                                         |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Keep body avatar selector and only move search below toolbar | Violates "不要在页面里面挂角色选择器" and leaves avatar scope as local state.                                                        |
| Make one tab per avatar + workspace pair                     | Conflicts with "一个 tap 应该只专注一个角色" and risks tab explosion. Workspace is a grouping/filtering dimension inside the avatar. |
| Hide search in a drawer/dialog                               | Search is a primary Notes workflow and user explicitly asked to make it independent.                                                 |
| Rebuild NoteSystem data access in Studio                     | Violates Studio SPEC: client-sdk runtime-store facades are the only Notes data surface.                                              |

## Exit Conditions

- Default max review iterations: 2
- Issue recurrence threshold: if avatar scope leaks back into body state in more than one component, stop and re-check the workbench law.
- Custom exit condition from intent: implementation does not begin until user confirms or revises the tab/scope plan.
