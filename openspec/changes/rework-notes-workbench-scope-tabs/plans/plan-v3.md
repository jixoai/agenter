# Intent Document

## Current Round

- Round: 4
- Status: User corrected the Browse visual layout: use OneNote-style top page/notebook switching with two body columns for sections and pages.
- Previous plan backup: `plans/plan-v2.md` was created before this Round 4 material plan correction.

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
| Should Browse remain a three-column layout?                                                                                           | No. User asked to reference OneNote and use two body columns: `sections+pages`.                                 | Keep notebook/page-scope selection as a top switcher; render only Sections and Pages as body columns.                                         |

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
  - notebook/page-scope switcher at the top for many notebooks
  - sections for the selected notebook
  - pages for the selected notebook + section
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
