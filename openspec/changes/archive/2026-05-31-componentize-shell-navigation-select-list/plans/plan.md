# Intent Document

## Current Round

- Round: 1
- Status: Ready for apply
- Previous plan backup: none

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

> 继续改进，首先，你没有达成我的要求：
> 1. 没必要显示 `running` 这个状态，因为我们只会列出live状态的terminal，所以最终只会有一堆的running
> 2. 显示的内容依次是 id、pwd、pty-title（这里也是实时的，我们底层有订阅接口）、room-users（排除superadmin，显示成 `@xxx, @xxx`）
> 3. 加入响应式算法：溢出自动换行（使用 `import { stringWidth } from "bun"` 计算内容宽度）。注意上下选择器要支持多行。同时每一部分（id、pwd等）都不做内容换行，也就是说stringWidth 计算如果超过`terminalWidth - safePadding`，那么直接改成`XXX...`省略显示
>
> 4. 支持鼠标点击直接进入（mousedown选中，click 进入）
>
> 你有把这些东西封装成opentui组件吗？
>
> [Image #1] 为什么没有 room-users？
>
> 鼠标的点击好像有点错位。这个之前也遇到过，先告诉我为什么，在修复
>
> 这里能通过封装来优化吗？还是说这种细节很难屏蔽？
>
> 用openspec推进，不困难，一次性完成change编写并apply+test+archive+commit。直接在main分支完成工作。

## Objective Record

### Requirement-Bearing Q&A

| Turn | Speaker | Objective record | Impact on intent |
| ---- | ------- | ---------------- | ---------------- |
| 1 | User | Existing Select Terminal rows must not show `running`; live terminal filtering already makes it redundant. | Durable row contract must be id, pwd, pty-title, room-users only. |
| 2 | User | Row order must be `id`, `pwd`, `pty-title`, `room-users`, with room-users excluding superadmin and displayed as `@xxx, @xxx`. | Renderer and specs must match the operator scan order. |
| 3 | User | Responsive row layout must use `stringWidth` from Bun, wrap between fields, and clip a single over-wide field to `XXX...`. | Width logic belongs in a row renderer, not ad hoc in the app controller. |
| 4 | User | Up/down selection must support multi-line rows. | Selection movement is item-based while display height is row-based. |
| 5 | User | Mouse click should directly enter: mousedown selects, click/release confirms. | Pointer behavior belongs in the selectable-list primitive. |
| 6 | User | Ask whether this can be optimized through encapsulation. | The change target is componentization, not another local coordinate patch. |
| 7 | User | Use OpenSpec and complete change writing, apply, test, archive, and commit directly on main. | Create a small vision-driven change and finish it in this checkout. |

### Evidence Read

| Source | Fact | Why it matters |
| ------ | ---- | -------------- |
| `apps/shell/src/app-navigation/navigation-app.ts` | `ShellNavigationApp` currently owns row rendering, multi-line viewport calculation, hit regions, bordered coordinate offsets, and mousedown/mouseup confirmation. | The controller is carrying reusable OpenTUI list physics. |
| `apps/shell/src/app-navigation/navigation-model.ts` | Terminal row field rendering currently lives in the model next to Terminal/Room projection logic. | Projection truth and presentation row layout are mixed. |
| `apps/shell/test/navigation-app.test.ts` | Tests already cover direct existing entry, New Terminal Avatar step, bordered hit coordinates, wrapped row click, and runtime title refresh. | Refactor must preserve these behaviors while adding component-level coverage. |
| `apps/shell/test/navigation-model.test.ts` | Tests already cover room-users from participants/grants, `running` absence, field color chunks, and field clipping. | Row renderer can move without changing observable contract. |
| `openspec/specs/cli-shell-product/spec.md` | Durable spec still says Select Terminal rows include lifecycle/status fields and examples without comma-separated room-users. | Spec must be updated to the latest product law. |
| `apps/shell/src/surfaces/top-layer-surface.ts` | Another surface repeats `top + 1 + child.top` / `left + 1 + child.left` for bordered coordinates. | Coordinate projection should become a reusable primitive. |

### Git Evidence

| Checkpoint | Expected commit evidence | Current status |
| ---------- | ------------------------ | -------------- |
| OpenSpec artifacts before apply | Commit containing `plans/plan.md`, specs, and `tasks.md` before app-code work starts | Will be committed if the checkout state allows a narrow artifact commit. |
| Task-progress commits | Commit containing current-context task checkbox updates plus matching code/BDD evidence | Will be committed with the implementation scope only. |
| Self-review updates | Commit containing review output and any reopened or added OpenSpec tasks before the next apply loop | Will be committed before archive if needed. |
| Normal archive | Commit containing `openspec archive <change>` result | Final commit target. |
| Abnormal handoff | Commit containing `HANDOFF.md` / `vN.HANDOFF.md` evidence before returning to user discussion | Not expected. |

### Existing OpenSpec Survey

| File / change | Existing law or pattern | Reuse, extend, or break |
| ------------- | ----------------------- | ----------------------- |
| `archive/2026-05-31-streamline-shell-entry-terminal-selection` | Existing Terminal entry skips Avatar; `/avatar` owns room user management; Shell navigation is an app projection. | Extend. |
| `openspec/specs/cli-shell-product/spec.md` | Select Terminal rows are structured, but still mention status/lifecycle. | Modify. |
| `apps/shell/SPEC.md` | Shell owns app presentation and local OpenTUI/opencompose composition; Terminal/Room truth stays in owning systems. | Reuse. |
| `openspec/specs/cli-shell-interaction-capabilities/spec.md` | OpenTUI is host projection, not durable terminal interaction owner. | Reuse as boundary: this change is startup UI only, not terminal backend input law. |

### User Language System

| User phrase | Working meaning | Plain-language translation when needed |
| ----------- | --------------- | -------------------------------------- |
| `封装成opentui组件` | Turn repeated TUI behavior into a reusable component/primitive in the OpenTUI presentation layer. | Do not leave screen-coordinate math and row wrapping inside product-specific app code. |
| `点击错位` | Mouse event screen coordinates do not match rendered row coordinates. | Coordinate spaces must be explicit. |
| `细节很难屏蔽` | Ask whether OpenTUI coordinate/border details can be hidden behind a reliable abstraction. | Encapsulate what is invariant; keep renderable geometry inputs explicit. |
| `底层有订阅接口` | pty-title and pwd are live projection facts from runtime store. | The component must render refreshed item data without owning the source truth. |

### Demo / Spike Code

| Path | Question it answers | Keep, migrate, or delete |
| ---- | ------------------- | ------------------------ |
| none | Existing tests already reproduce the relevant behavior. | Not needed. |

### Questions To Confirm With User

| Question | Why this is the real question | Current inference before user answers |
| -------- | ----------------------------- | ------------------------------------- |
| Should the list primitive be promoted outside `app-navigation` immediately? | A repo-wide OpenTUI component package would be broader than this startup panel. | Keep it under shell presentation code first, with an API that can be promoted later. |

## Intent

### Surface Intent

Select Terminal should look and behave exactly as requested: rows show `id`, `pwd`, live `pty-title`, and comma-separated `room-users`; no redundant `running`; wrapping and clipping are width-aware; keyboard and mouse selection keep working across multi-line rows.

### Underlying Drive

The product problem is no longer the individual bug. The repeated failures came from letting `ShellNavigationApp` own too many small OpenTUI mechanics: row layout, coordinate projection, list height, and pointer confirmation. Those are presentation laws and should be reusable atoms.

### Final Visible Effect

The operator sees the same Select Terminal UX, but with more reliable mouse targeting and no drift between visual rows and hit regions. Future changes to startup row content should happen inside `TerminalSelectionRow`; future list hit/selection changes should happen inside `SelectableWrappedList`, not in Shell entry business flow.

## Platform Diagnosis

- Current platform laws: Shell owns local OpenTUI presentation; TerminalSystem owns terminal truth; MessageSystem owns room/grant truth; Shell navigation is a projection.
- Does this fit as a regular atom: Yes. This is an app presentation atom under existing Shell laws.
- Does this require law upgrade: Yes, but only inside app/shell presentation: coordinate projection and multi-line selectable list behavior become reusable primitives.
- Breaking update stance: No compatibility layer for the old `running` field; update the row contract directly.
- User confirmations still required: None for this small refactor; no durable data migration or state reset.

## Reverse-Inferred Design

### Interaction / Visual Story

The panel remains a compact startup chooser. The selected item may occupy multiple visual rows, but the selector still moves one Terminal at a time. A pointer down on any visual line of an item selects that item; releasing on the same item confirms it.

### Interface Shape

- `SelectableWrappedList<T>` receives renderable items, selected index, geometry, and callbacks.
- It owns row renderables, item visual heights, first-visible item calculation, hit regions, mousedown selection, and release confirmation.
- `TerminalSelectionRow` receives Shell navigation item data plus width and returns styled wrapped lines.
- `ScreenRegionMapper` converts parent-local child renderable coordinates to screen hit regions with explicit border/content insets.

### Data Shape

Terminal/Room/Avatar facts remain in the model and store. The new components only receive display items and callbacks. Hit regions are ephemeral render projection, not durable selection truth.

### Architecture Shape

`ShellNavigationApp` becomes a composition/controller:

- It decides whether the current step is Shell or Avatar.
- It passes item renderers and callbacks into the list component.
- It confirms selections and updates runtime step state.

The reusable atoms:

- `screen-region.ts`: coordinate mapping primitive.
- `selectable-wrapped-list.ts`: generic OpenTUI selectable list component.
- `terminal-selection-row.ts`: terminal row rendering component.

### User Confirmation Gates

| Gate | Why confirmation is required | Default until user answers |
| ---- | ---------------------------- | -------------------------- |
| Promote components to a cross-app package | Broader ownership decision. | Keep local to `agenter-app-shell`. |

## Intent-Driven Plan

- [x] 1. Research and align intent.
- [x] 2. Write specs from the intent.
- [x] 3. Write BDD tasks from specs.
- [ ] 4. Implement tasks.
- [ ] 5. Self-review against intent and decide whether to loop.

## Open Questions

| Question | Why it matters | Default assumption until user answers |
| -------- | -------------- | ------------------------------------- |
| Should future shell surfaces share the same list primitive? | It decides whether to move the primitive to a broader folder later. | Keep it reusable but locally scoped until a second consumer appears. |

## Rejected Paths

| Path | Why rejected |
| ---- | ------------ |
| Keep only `borderedChildScreenRow/Col` helpers inside `ShellNavigationApp` | It fixes one symptom but leaves the presentation law hidden in business code. |
| Move terminal row rendering deeper into `navigation-model.ts` | The model should project facts; styled wrapping is OpenTUI presentation. |
| Add a universal UI framework abstraction now | Too broad for the current product pressure; one shell component layer is enough. |

## Exit Conditions

- Default max review iterations: 1
- Issue recurrence threshold: 2
- Custom exit condition from intent: OpenSpec artifacts, implementation, tests, self-review, archive, and commit complete on `main`.
