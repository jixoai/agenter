# Intent Document

## Current Round

- Round: 1
- Status: research+plan draft, no implementation started
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

> 我们未来需要将Heartbeat这个面板内容在别的地方独立展示，所以我们需要开一个新包：web-heartbeat-view。
> 它将独立通过认知链接到底层某个agenter上。
> 我们需要在这个包中提供一个example，这个example拥有完整的独立的导航能力，能列出目前所有的Avatars，点进入HeartbeatPage，可以看到Avatar的LoopBus的工作。
>
> - 参考项目：packages/web-chat-view，这里提供了如何利用 Framework7 作为底层开发
> - 参考项目：apps/studio，这里提供了一套 Heartbeat 滚动视图，并且要有非常堵多的结构化的解析思路和方案
> - 参考项目：[svelte-ai-elements](https://svelte-ai-elements.vercel.app/llms.txt)，这里提供了大量的 AI 消息面板所需的渲染组件，强烈建议使用 Context7 来获得文档：https://context7.com/sikandarjodd/ai-elements
>
> > 使用openspec vision进行推进。先进入 research+plan 阶段，调查、实验、讨论并完善 plan.md

## Objective Record

### Requirement-Bearing Q&A

| Turn | Speaker | Objective record | Impact on intent |
| ---- | ------- | ---------------- | ---------------- |
| 1 | User | 未来需要将 Heartbeat 面板内容在别的地方独立展示，需要新包 `web-heartbeat-view`。 | 新能力不是 Studio 局部页面，而是可复用 package。 |
| 1 | User | `web-heartbeat-view` 将独立通过认知链接到底层某个 agenter 上。 | 需要独立连接/绑定契约，不能依赖 Studio controller context。 |
| 1 | User | package 中提供 example，example 拥有完整独立导航能力，能列出目前所有 Avatars。 | example 是验证宿主，必须有目录、搜索/选择、路由/导航，而不是孤立 component demo。 |
| 1 | User | 点进入 `HeartbeatPage`，可以看到 Avatar 的 LoopBus 工作。 | Heartbeat page 的目标是运行中 Avatar 的 runtime/LoopBus 可观察事实，不是静态 avatar profile。 |
| 1 | User | 参考 `packages/web-chat-view` 的 Framework7 开发方式。 | 采用 Framework7 Svelte shell/route/list/page 原语，并复用该包的 package/example 分层经验。 |
| 1 | User | 参考 `apps/studio` 的 Heartbeat 滚动视图和结构化解析方案。 | 把 Studio 当前 Heartbeat 的 grouping/parser/virtualized conversation 经验提升为 package law。 |
| 1 | User | 参考 `svelte-ai-elements`，强烈建议 Context7 获取文档。 | 需要确认 AI-native message/tool/reasoning/context 组件形态，并避免闭门造私有面板。 |
| 1 | User | 使用 `openspec vision` 推进，先进入 `research+plan` 阶段。 | 当前阶段只沉淀 plan SSOT，不开始实现新包。 |

### Evidence Read

| Source | Fact | Why it matters |
| ------ | ---- | -------------- |
| `openspec/schemas/vision-driven/schema.yaml` | `research-plan` 生成 `plans/plan.md`，且要求先调查代码和既有 OpenSpec。 | 本文件是当前阶段 SSOT；后续 specs/tasks 必须可追溯到这里。 |
| `openspec/specs/workspace-runtime-shell/spec.md` | 当前长期法则已经把 Heartbeat 定义为默认 Avatar runtime tab、连续 message-parts stream、virtualizable conversation、footer statusbar、manual compact control。 | `web-heartbeat-view` 应承接现有 Heartbeat 法则，而不是重新发明一个轻量 devtools 页面。 |
| `openspec/specs/runtime-ui-publication/spec.md` | Heartbeat grouped page 是 bounded storage read，语义包含 `before-call` / `call` / `compact` / `before-call-pending`，realtime `runtime.heartbeatPart` 触发 grouped projection refresh。 | 新包应消费 grouped Heartbeat contract，不应从 raw request_aux / model-call / chat rows 在浏览器重建事实。 |
| `openspec/specs/client-runtime-store/spec.md` | client store 为 grouped Heartbeat 暴露 explicit cached resource state，并要求 Heartbeat route 只 hydrate route-owned history。 | 独立 example 需要保留 loaded/loading/refreshing/error/data，而不是用空数组推断状态。 |
| `openspec/specs/workspace-shell-session-rail/spec.md` | Studio 的 running-avatar 导航是 app shell 下的 secondary navigation。 | 新 example 需要完整导航，但它的导航属于 example host，不能反向污染 Studio shell law。 |
| `packages/web-chat-view/SPEC.md` | `@agenter/web-chat-view` 明确 package 只拥有 room primitive；host routing/app bootstrap 属于 example 或 consumer host；Framework7 component law 优先官方 atoms。 | `web-heartbeat-view` 应采用同样的 package/example 边界：共享 Heartbeat primitive 与 host example 分离。 |
| `packages/web-chat-view/package.json` | 现有 package 使用 Svelte 5、Framework7 9、Storybook+Vitest browser、typecheck/test scripts，并暴露 Svelte entry。 | 新 package 应沿用同级工程形态和 verification surface。 |
| `packages/web-chat-view/example/src/lib/review-shell-client.svelte` | example 通过 `App/View/Page/Navbar/List/Searchbar/Toolbar/Tabs/Panel/Sheet` 等 Framework7 primitives 自建完整 host shell。 | Heartbeat example 的目录页和 HeartbeatPage 应走 Framework7 route/page topology，而不是 ad hoc div shell。 |
| `apps/studio/src/lib/features/runtime/runtime-shell.svelte` | Studio runtime shell 从 `runtimeState.heartbeatGroupsBySession`、`modelCallsBySession`、scheduler、attention、settings layer 组合 Heartbeat props，并以 `includeChatHistory: false`、`observabilityMode: "heartbeat"` hydrate。 | 连接层已经有最小 Heartbeat hydration shape；新包不能依赖 Studio controller，但可以复刻这些输入边界。 |
| `apps/studio/src/lib/features/runtime/runtime-primary-stage.svelte` | `RuntimeStageHeartbeat` 是一个 props-driven component，接收 `CachedResourceState<HeartbeatGroupItem[]>`、`ModelCallItem[]`、attention、delivery、config binding 和 callbacks。 | 可提取的第一层是 presentational Heartbeat stage，而不是整条 Studio runtime route。 |
| `apps/studio/src/lib/features/runtime/runtime-stage-heartbeat.svelte` | Heartbeat stage 使用 `VirtualConversation`、named scroll triggers、`buildHeartbeatDisplayGroups`、`RuntimeHeartbeatGroup`、footer statusbar 和 load older affordance。 | 新包必须保留滚动/虚拟化/分页体验，而不只是渲染一组 cards。 |
| `apps/studio/src/lib/features/runtime/runtime-heartbeat-parts.ts` | 结构化 parser 负责 part text extraction、folded types、tool trace grouping、group labels、compact merge、section materialization、clipboard text。 | 这部分是 Heartbeat domain logic，应该迁出 Studio 或在新包成为 package-owned law。 |
| `apps/studio/src/lib/features/runtime/runtime-heartbeat-part-content.svelte` | text/thinking/json 分别走 Markdown, Reasoning, JSONViewer；thinking 自动按 detailed/streaming 展开。 | AI-native rendering 需要保留 reasoning/markdown/json 的分层。 |
| `apps/studio/src/lib/features/runtime/runtime-heartbeat-tool-block.svelte` | tool block 走 AI-elements Tool family，并处理 running shell sleep/timeout progress。 | `LoopBus 工作` 不能退化成 raw JSON；工具执行必须有结构化展示。 |
| `apps/studio/src/lib/components/ai-elements/*` | Studio 现在本地持有 Conversation, Message, Tool, Reasoning, Context, Action, Checkpoint, Loader 等 AI elements 子集。 | 新 package 不能直接 import `apps/studio`; 需要建立 package-owned 或 shared 的 AI-elements boundary。 |
| `packages/svelte-components/src` | 已有 anchored virtual list、named scroll controller、Scaffold/ScrollView 等可共享 primitives。 | 新 package 可依赖这些底层滚动法则，避免复制 scroll runtime。 |
| `packages/web-components/src` | 已有 Markdown document、JSON viewer、tool invocation card 等 framework-neutral web components。 | 新 package 可复用 Markdown/JSON/tool display primitives，而不是把 Studio-only wrappers 当作依赖。 |
| `packages/client-sdk/src/types.ts` | `HeartbeatGroupItem`, `ModelCallItem`, `CachedResourceState`, `RuntimeSchedulerState`, `SessionEntry`, avatar catalog/session types 已从 app-server router outputs 推导。 | 新 package 的 typed interface 应优先消费 client-sdk 类型，不写并行手造 types。 |
| `packages/client-sdk/src/runtime-store.ts` | Store 提供 `listSessions`, global avatar catalog hydration, `loadHeartbeatGroups`, `loadMoreHeartbeatGroups`, realtime invalidation, `hydrateSessionArtifacts(... observabilityMode: "heartbeat")`。 | Example 的认知链接可以先建立在 client-sdk runtime store，而不是新开 HTTP 协议。 |
| `packages/app-server/src/heartbeat-groups.ts` | Backend projection 由 `ai_call` + `heartbeat_part/request_aux` inspection rows 生成 grouped records。 | Heartbeat truth 已在 backend projection；新包不应绕过它。 |
| Context7 `/sikandarjodd/ai-elements` docs | AI elements 的 relevant components include Conversation, Message, Reasoning, Tool, Context, Loader, Actions, Code/Markdown patterns, and message parts iteration. | Studio 当前组件选择和 svelte-ai-elements 方向一致；新包可以以这些 family 为 UI law。 |
| `https://svelte-ai-elements.vercel.app/llms.txt` | The project describes 44+ Svelte AI components and highlights Message, Conversation, Response, Reasoning, Tool, Context, Loader, Copy Button. | Confirms external reference is a component registry pattern, not a runtime transport layer. |

### Git Evidence

| Checkpoint | Expected commit evidence | Current status |
| ---------- | ------------------------ | -------------- |
| OpenSpec artifacts before apply | Commit containing `plans/plan.md`, specs, and `tasks.md` before app-code work starts | Not ready. `plans/plan.md` is being drafted; specs/tasks are intentionally absent. |
| Task-progress commits | Commit containing current-context task checkbox updates plus matching code/BDD evidence | Not applicable in research+plan. |
| Self-review updates | Commit containing review output and any reopened or added OpenSpec tasks before the next apply loop | Not applicable in research+plan. |
| Normal archive | Commit containing `openspec archive <change>` result | Not applicable. |
| Abnormal handoff | Commit containing `HANDOFF.md` / `vN.HANDOFF.md` evidence before returning to user discussion | Not applicable. |

### Existing OpenSpec Survey

| File / change | Existing law or pattern | Reuse, extend, or break |
| ------------- | ----------------------- | ----------------------- |
| `openspec/specs/workspace-runtime-shell/spec.md` | Heartbeat is default runtime tab and one continuous message-parts runtime stream. | Reuse. Add a new package/standalone-consumer capability instead of changing Heartbeat truth. |
| `openspec/specs/runtime-ui-publication/spec.md` | Grouped Heartbeat page is the durable runtime UI publication contract. | Reuse. New package consumes grouped projection. |
| `openspec/specs/client-runtime-store/spec.md` | Store tracks long-history resource state and Heartbeat cached resource explicitly. | Reuse. Example adapter should rely on cached resource semantics. |
| `openspec/specs/workspace-shell-session-rail/spec.md` | Studio running avatar navigation is secondary under Avatars. | Reuse as contrast. Example can own a standalone navigation shell without changing Studio IA. |
| `openspec/changes/add-runtime-recovery-surface/*` | Recovery diagnostics should not overload Heartbeat quick config. | Respect. `web-heartbeat-view` should not silently absorb recovery surface scope. |
| `openspec/specs/web-chat-view-framework7-component-system/spec.md` and `packages/web-chat-view/SPEC.md` | Framework7 component law and package/example boundary are already durable for `web-chat-view`. | Extend the same law family to `web-heartbeat-view`. |
| Archived `stabilize-heartbeat-groups-query` change | Deep-history Heartbeat must be bounded and explicitly settle loaded/error. | Reuse as historical proof; do not regress to full-history browser reconstruction. |
| Archived `repair-runtime-heartbeat-unified-ingress` change | Heartbeat ingress includes legacy `heartbeat`, structured `heartbeat_part`, and `request_aux`. | Reuse through current runtime publication contract. |

### User Language System

| User phrase | Working meaning | Plain-language translation when needed |
| ----------- | --------------- | -------------------------------------- |
| `Heartbeat这个面板内容在别的地方独立展示` | Heartbeat is no longer Studio-local UI. | A package-owned Heartbeat view must be embeddable by another host. |
| `开一个新包：web-heartbeat-view` | Create a workspace package, likely `@agenter/web-heartbeat-view`. | Package under `packages/web-heartbeat-view`, plus an example package under `packages/web-heartbeat-view/example`. |
| `独立通过认知链接到底层某个agenter上` | Standalone view must bind to a real Agenter runtime/control plane without Studio controller context. | A typed connection adapter should select an Agenter backend and hydrate runtime facts. |
| `完整的独立的导航能力` | Example is a real mini app with routes/navigation/search/back/detail. | Framework7 shell, not a Storybook-only surface. |
| `列出目前所有的Avatars` | User expects an Avatar directory as the entry point. | Current inference: list global avatars plus their running sessions; HeartbeatPage is enabled for a selected running session. |
| `点进入HeartbeatPage` | Detail route/page transition from Avatar list into Heartbeat. | Route-level page with direct URL and reload-safe hydration. |
| `看到Avatar的LoopBus的工作` | Surface runtime work evidence, not only chat messages. | Render grouped Heartbeat, scheduler containment, model-call usage, tool invocation, attention summary, and compact boundaries as objective runtime facts. |
| `非常堵多的结构化的解析思路和方案` | The existing Studio parser/rendering decisions matter. | Preserve parser stages and structured rendering rather than flattening to raw JSON. |

### Demo / Spike Code

| Path | Question it answers | Keep, migrate, or delete |
| ---- | ------------------- | ------------------------ |
| None yet | Current round used code/spec/docs survey and Context7 docs, not change-local demo code. | Add `demos/` only if the next research round needs to test transport/auth shape before specs. |

### Questions To Confirm With User

| Question | Why this is the real question | Current inference before user answers |
| -------- | ----------------------------- | ------------------------------------- |
| `所有的Avatars` 是指 global avatar catalog，还是当前 running Avatar sessions？ | Heartbeat is session/runtime-scoped; static avatars may have no Heartbeat. | Show global avatars as directory groups, with running sessions beneath each. HeartbeatPage opens a selected session; non-running avatars show a start/connect action or empty state. |
| `认知链接` 是否已有命名协议/URL/token 形态，还是本 change 需要定义 first version？ | Standalone example cannot depend on Studio's Svelte context. Auth and endpoint shape determine package API. | Use existing `@agenter/client-sdk` transport/store as first law; example accepts Agenter base URL and optional token/profile state. |
| `web-heartbeat-view` 是否应立即替换 Studio 的 Heartbeat implementation？ | If Studio remains separate, two Heartbeat truth surfaces may drift. | Recommended yes: package becomes source, Studio consumes it through a thin adapter, proving package parity. |
| Standalone HeartbeatPage 是否包含 manual compact/config editing？ | Current Studio Heartbeat includes footer compact/config, but a read-only external viewer may not have authority. | Package exports controls as capability-gated optional callbacks; example enables read-only first, then enables compact/config only when connection authority is explicit. |
| 是否需要 publish-ready package metadata in this change？ | Workspace package can be private initially like `web-chat-view`, or prepared for future publishing. | Keep private workspace package first; release metadata can follow after API stabilizes. |

## Intent

### Surface Intent

Build a new `web-heartbeat-view` package that can render the existing Heartbeat panel outside Studio. Provide a standalone Framework7 example app that connects to an Agenter backend, lists Avatars, opens a HeartbeatPage for an Avatar/runtime, and shows that Avatar's LoopBus/runtime work through the Heartbeat surface.

### Underlying Drive

Heartbeat has crossed the boundary from "Studio tab" to "runtime observability atom." The system pressure is not to copy a page, but to promote Heartbeat into a package-owned domain surface:

- Backend/runtime remains the authority for Heartbeat facts.
- Client SDK remains the authority for typed runtime resource hydration.
- `web-heartbeat-view` owns Heartbeat presentation, grouping-derived UI, status/footer, and host-neutral props.
- Studio and the standalone example become consumers.

This keeps the current platform law intact: facts stay in runtime/session storage; UI packages project those facts without inventing parallel truth.

### Final Visible Effect

An operator can open the standalone example, connect it to an Agenter target, see a searchable Avatar directory, choose an Avatar/session, and land on a Framework7 HeartbeatPage. The page shows the same meaningful Heartbeat story Studio shows today: pre-call facts, model calls, assistant text/thinking, tool calls/results, compact boundaries, load older behavior, live refresh, scheduler status, context usage, and attention summary.

The operator should stop worrying that Heartbeat only exists inside Studio. A future host can mount the package without importing `apps/studio`.

## Platform Diagnosis

- Current platform laws:
  - Heartbeat truth is durable runtime/session inspection data, published as grouped pages.
  - Client SDK normalizes long-history resources and exposes cached state.
  - Studio currently owns Heartbeat presentation but already passes it typed props.
  - Framework7 shell/navigation belongs to app/example hosts; reusable packages own primitives and host-neutral components.
- Does this fit as a regular atom: yes, if `web-heartbeat-view` consumes existing grouped Heartbeat and client-store laws.
- Does this require law upgrade: yes, but only at package/UI ownership level. Heartbeat presentation must move from Studio-local code to package-owned code; no backend truth law change is currently justified.
- Breaking update stance:
  - Prefer the clean move: make `@agenter/web-heartbeat-view` the Heartbeat presentation source and rebind Studio to it.
  - Avoid compatibility glue where package imports from `apps/studio` or where Studio and package maintain divergent parser copies.
- User confirmations still required:
  - Static avatar catalog vs running sessions semantics.
  - Exact connection/auth naming for `认知链接`.
  - Whether write-capable controls are in phase 1.

## Reverse-Inferred Design

### Interaction / Visual Story

Standalone example should feel like a small native inspection app:

1. App opens to `Avatars`.
2. Top navbar shows connection target and connection state.
3. Searchbar filters avatar names/workspaces/status.
4. List groups Avatars and their current running sessions.
5. Tapping a running session pushes `HeartbeatPage`.
6. `HeartbeatPage` has a navbar back link, Avatar identity, runtime status, and a continuous Heartbeat stream.
7. Load older appears at the history edge.
8. Live updates refresh without blanking warm rows.
9. If no session exists, the Avatar detail explains that Heartbeat requires a runtime session and exposes an authorized start/connect path only if the adapter provides it.

Framework7 topology should be:

- `<App theme="ios" routes={...}>`
- main `<View main class="safe-areas" masterDetailBreakpoint={...}>`
- Avatar list `<Page>` with `<Navbar>`, `<Subnavbar inner={false}>`, `<Searchbar>`, `<List>`, `<ListGroup>`, `<ListItem>`
- Heartbeat detail `<Page>` with `<Navbar>` and route params
- optional desktop master/detail when it naturally follows Framework7 route semantics

### Interface Shape

Package-level components and contracts should be split by responsibility:

- `HeartbeatView`: pure presentational runtime stream; no transport creation.
- `HeartbeatPage`: Framework7 page shell around `HeartbeatView`, optional if package owns F7 page primitive.
- `HeartbeatAvatarDirectory`: optional example-level component unless later hosts need it.
- `HeartbeatConnectionAdapter`: typed interface consumed by example for sessions, avatar catalog, grouped Heartbeat hydration, model calls, scheduler/attention slices, and realtime lifecycle.
- `createAgenterHeartbeatConnection`: example or package helper over `@agenter/client-sdk`, depending on how stable the connection law becomes.

The presentational props should resemble the current Studio `RuntimeStageHeartbeat` inputs:

- `sessionStatus`
- `schedulerState`
- `groupsState: CachedResourceState<HeartbeatGroupItem[]>`
- `modelCalls: ModelCallItem[]`
- `attention`
- `attentionDelivery`
- `avatarLabel`
- `sessionIconUrl`
- `onLoadOlder`
- optional `onRequestCompact`
- optional config binding/read/write callbacks

### Data Shape

Facts and projections must stay separated:

- Durable fact: `ai_call`, `heartbeat_part`, `request_aux`, model-call records, runtime scheduler/attention facts.
- Backend projection: grouped Heartbeat page with `before-call`, `call`, `compact`, `before-call-pending`.
- Client resource state: `loaded/loading/refreshing/error/data/refreshedAt`.
- UI projection: sections, folded rows, tool display blocks, compact-special layout, context summary.

The UI must not treat attention state as Heartbeat truth. Prior investigation showed `Before Call (Pending)` is a Heartbeat/model-call observability artifact for unbound request context, not an attention item.

### Architecture Shape

Recommended atom layout:

```text
packages/web-heartbeat-view
  src/
    index.ts
    heartbeat-view.svelte
    heartbeat-page.svelte
    heartbeat-group.svelte
    heartbeat-entry.svelte
    heartbeat-part-content.svelte
    heartbeat-tool-block.svelte
    heartbeat-statusbar.svelte
    heartbeat-parts.ts
    heartbeat-connection.ts
    framework7-components.ts
    framework7.ts
    ai-elements/...
  example/
    src/routes/+page.svelte
    src/lib/heartbeat-example-client.svelte
    src/lib/agenter-connection.ts
    src/lib/avatar-directory-page.svelte
    src/lib/heartbeat-routed-page.svelte
```

Ownership rules:

- `web-heartbeat-view` may depend on `@agenter/client-sdk` types, `@agenter/svelte-components`, `@agenter/web-components`, Framework7, lucide, and local AI element primitives.
- `web-heartbeat-view` must not depend on `apps/studio`.
- `apps/studio` may depend on `@agenter/web-heartbeat-view`.
- Backend `app-server` should not add package-specific endpoints unless research proves existing client-sdk/store cannot express the standalone link.
- Example owns route/navigation and endpoint entry UI.

AI-elements boundary:

- Current Studio AI elements are useful but app-local.
- For this change, the cleanest source law is: package owns the minimal AI-elements subset needed by Heartbeat, derived from the existing Studio components and informed by `svelte-ai-elements` docs.
- If those primitives become useful across multiple packages, a later change can extract `@agenter/svelte-ai-elements`; do not add that package now unless implementation shows duplication pressure outside Heartbeat.

### User Confirmation Gates

| Gate | Why confirmation is required | Default until user answers |
| ---- | ---------------------------- | -------------------------- |
| Avatar directory semantics | Static avatars may not have Heartbeat; running sessions do. | Directory lists global avatars, with running sessions as selectable Heartbeat targets. |
| Connection/auth protocol name | `认知链接` is user vocabulary but not yet found as a durable protocol name in code. | Use existing client-sdk transport/store and call the package-level abstraction `AgenterHeartbeatConnection` until a better name is confirmed. |
| Studio migration scope | Moving Studio to consume the package is larger than adding a standalone example, but prevents drift. | Include Studio rebind in specs/tasks as recommended path. |
| Write controls | Compact/config writes need authority and should not appear as fake read-only controls. | Capability-gate writes; example starts read-only unless connection grants write methods. |

## Intent-Driven Plan

- [x] 1. Research existing OpenSpec laws, package shape, Studio Heartbeat, client SDK, backend grouped projection, and AI-elements references.
- [ ] 2. Discuss and lock unresolved intent questions with the user, especially Avatar directory semantics and connection/auth naming.
- [ ] 3. Write delta specs for `web-heartbeat-view` package law, standalone example navigation, Heartbeat connection contract, and Studio rebind/parity.
- [ ] 4. Write BDD tasks from specs, including package parser tests, Storybook DOM contracts, example route tests, and Studio parity checks.
- [ ] 5. Commit OpenSpec artifacts after `research-plan`, `specs`, and `tasks` pass `bun run openspec:vision -- validate add-web-heartbeat-view` and commit-check.
- [ ] 6. Apply implementation with BDD-first discipline: scaffold package/example, migrate Heartbeat parser/view, connect example through client-sdk, rebind Studio.
- [ ] 7. Verify typecheck/tests plus desktop and iPhone 14 route-level browser evidence for the standalone example and Studio parity.
- [ ] 8. Self-review against plan/specs/tasks and decide whether a new research loop is needed before archive.

## Open Questions

| Question | Why it matters | Default assumption until user answers |
| -------- | -------------- | ------------------------------------- |
| Should the example show only running Avatars, or all global Avatars with unavailable/runtime-empty states? | It changes first screen IA and empty states. | All global Avatars, grouped with running sessions; Heartbeat route requires a session. |
| Should the package export a full Framework7 `HeartbeatPage`, or only a host-neutral `HeartbeatView` plus example-owned pages? | It determines how much Framework7 law lives in the reusable package. | Export both: host-neutral `HeartbeatView` and Framework7 `HeartbeatPage` shell. |
| Is `LoopBus` wording meant to expose raw LoopBus events, or the current Heartbeat grouped runtime story? | Raw LoopBus may imply scheduler/log/devtools data not present in Heartbeat. | Show current Heartbeat grouped stream plus scheduler/attention/model-call footer; do not add raw LoopBus timeline scope. |
| Do we need a custom element export like `web-chat-view` has? | Future embedding may need framework-neutral host integration. | Defer unless user confirms; Svelte package + example first. |
| Should AI elements be internal to `web-heartbeat-view` or extracted to a new shared package immediately? | Shared extraction is durable but larger. | Keep inside `web-heartbeat-view` for phase 1; radar a later shared extraction. |

## Rejected Paths

| Path | Why rejected |
| ---- | ------------ |
| Copy Studio Heartbeat files into `web-heartbeat-view` and leave Studio untouched. | Creates two parser/rendering truth surfaces and invites drift. |
| Make `web-heartbeat-view` import from `apps/studio/src/lib/...`. | Violates package/app boundary; a package cannot depend on a consumer app. |
| Build the standalone example as Storybook only. | User explicitly asked for complete independent navigation and Avatar list. |
| Rebuild Heartbeat from raw `request_aux`, `heartbeat_part`, and model-call rows in the browser. | Existing runtime publication law says grouped Heartbeat is backend/client-store owned and bounded. |
| Treat static Avatar catalog rows as if they always have Heartbeat. | Heartbeat is runtime/session-scoped; static avatar identity alone is insufficient. |
| Put recovery diagnostics or Devtools timelines into the first Heartbeat package by default. | Existing recovery-surface law keeps recovery separate; scope creep would blur Heartbeat. |

## Exit Conditions

- Default max review iterations: 5
- Issue recurrence threshold: 2 consecutive unresolved review rounds routes back to `research-plan`
- Custom exit condition from intent:
  - `@agenter/web-heartbeat-view` exists as package-owned Heartbeat view law.
  - The standalone example independently connects to an Agenter target, lists Avatars/running sessions, and opens HeartbeatPage.
  - Studio either consumes the package or a deliberate user-approved exception is recorded.
  - Heartbeat semantics remain grouped, bounded, typed, and not confused with attention truth.
  - Verification includes BDD tests plus desktop and iPhone 14 route-level evidence for the standalone example.
