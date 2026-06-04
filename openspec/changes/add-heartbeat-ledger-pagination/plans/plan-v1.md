# Intent Document

## Current Round

- Round: 1
- Status: Exploring and shaping the infrastructure law before specs.
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

> 下一个里程碑，就是关于滚动，包含了虚拟滚动如何拉取变更、如何加载更多历史数据。
>
> 之前的apps/studio的做法是类似ChatApp的交互体验。我觉得这需要改变。我想和你讨论一下，把这种滚动交互升级成类似X的那种滚动体验交互。
>
> 不讨好我，客观聊一聊滚动的细节和痛点难点和升级方向

> 你的审计流提醒了我。我们不该纠结完整地展示一整个卡片的内容。完全可以作为一个分页里被的模式。默认只展示一个列表信息，列表信息可以预览到时间、状态、类型、aiCall(一个消息卡片会有多个AICALL) 等等组合得来。
> 至于点击进去才会看到完整的内容。这时候内容不论是动态 的还是稳定的，都不会因为滚动而错位。
>
> 调查参考 ../proxy 这个项目。

> 要实现多页锚定是一个很关键的基础设施，我们得专门为这个能力打造一个新的表。之前的表是存储 1 条 1 条事实，然后查询出来之后，再通过分组的算法把它合并成一个前端能够展示的卡片。然而这种做法在列表分列里边并不现实，因为我们没法全量地去计算出到底总共有多少页。
> 因此，我们需要设计一个独立的表来将这些客观信息串起来。并标记上一些特征，那么最终这个表就可以作为我们的稳定的分页列表来使用，那么我们的锚定功能也可以实现。
>
> 这个是这次升级的一个非常重要的机础设施，所以不可能是说后边再做，而是要一开始就得去往这个方向去做。
>
> 我们继续讨论一些细节，这个过程中你可以去生成一些 FTM 的文件，我们看着这个 STM 文件来聊一聊，效果就在 open spec change 里边来做。

## Objective Record

### Requirement-Bearing Q&A

| Turn | Speaker | Objective record | Impact on intent |
| ---- | ------- | ---------------- | ---------------- |
| 1 | User | Next milestone is scroll: virtual scrolling pulls changes and loads more historical data. Studio's old Heartbeat behaves like ChatApp; user wants to discuss upgrading toward X-like scrolling. | The problem is not only rendering; it is scroll interaction law, pagination, and live update behavior. |
| 2 | User | Heartbeat is an audit stream; default should not render whole cards. It can be a paged list mode showing time, status, type, aiCall and other summary facts; click opens full content. | Replace "virtualize dynamic full cards" with "stable summary ledger list plus independent detail view." |
| 2 | User | One message card may include multiple AI calls. | `aiCall` is a summary dimension, not necessarily the row identity. |
| 2 | User | Full detail can be dynamic or stable; because it is outside the list scroll, it will not misalign the list. | Detail rendering must own its own scroll surface. List row height should be stable or tightly bounded. |
| 2 | User | Investigate `../proxy`. | Use proxy's request-list/detail/pagination model as reference evidence, not as a direct copy. |
| 3 | User | Multi-page anchoring is a critical infrastructure capability and needs a new table. Existing fact rows plus query-time grouping cannot compute total pages realistically. | New persistent Heartbeat ledger/index table is in scope from the start; it is not a later optimization. |
| 3 | User | The new table should chain objective information and mark features so it can become the stable paged list backing anchor behavior. | The new table is a materialized inspection index over objective facts. It should remain traceable to source facts. |
| 3 | User | Continue discussing details; create files in the OpenSpec change as a shared STM/FTM surface. | This `plans/plan.md` is the current discussion SSOT. No repo convention for `FTM`/`STM` files was found in the current tree. |

### Evidence Read

| Source | Fact | Why it matters |
| ------ | ---- | -------------- |
| `../proxy/src/routes/RequestsPage.tsx` | The requests page renders a list as the main surface and opens request detail in a right-side Sheet with independent `overflow-y-auto`. | Confirms the desired list/detail split: dynamic heavy content is outside the list scroll. |
| `../proxy/src/components/RequestList.tsx` | The list renders bounded summary columns: id, time, type, status, plugin markers, response code, path, target, body sizes, duration. | Heartbeat should similarly define stable summary rows rather than render full content in the scroll list. |
| `../proxy/src/components/RequestDetail.tsx` | Detail fetches and renders headers, bodies, hook layers, and copy actions only after selection. | Heartbeat detail can render markdown/reasoning/tools/JSON only after selecting a ledger row. |
| `../proxy/src/components/ui/multi-page-pagination/types.ts` | Pagination uses `pages=-1,2` for dynamic latest anchoring and positive page anchors for pinned historical pages. | Multi-page anchoring needs a countable, stable page model, not only cursor-based "load older". |
| `../proxy/src/components/ProxyViewerContext.tsx` | List pages load summary data; detail loads `/api/requests/:id` separately; URL carries `requestId`, `pages`, and filters. | Heartbeat should separate list page hydration from detail hydration and make anchor state reload-safe. |
| `../proxy/src/lib/db-requests.ts` | Summary query selects only metadata columns from `requests`; complete bodies are not read for the list. | New Heartbeat ledger rows should store or project summary features without reading full source fact payloads for the list. |
| `packages/app-server/src/heartbeat-groups.ts` | Current grouped Heartbeat records are projected from `ai_call` plus inspection messages at query time. | This projection is not a stable pageable entity and cannot directly provide total pages. |
| `packages/app-server/src/heartbeat-groups-page.ts` | Current grouped page performs bounded window scans, predecessor context loading, sorting, cursor filtering, and returns `hasMoreBefore`. | The existing contract is useful for detail/backfill but is not a countable multi-page anchor index. |
| `packages/session-system/src/session-db.ts` | `session.db` currently stores objective facts in `message_part`, `ai_call`, `attention_dispatch`, `attention_receipt`, `runtime_watch`, `effect_ledger`, and `notify_quota`. | The new table should live beside these facts as a materialized ledger/index, not replace fact tables. |
| `openspec/specs/runtime-ui-publication/spec.md` | Current law says realtime Heartbeat changes invalidate grouped projection and grouped pages are served from bounded reads. | This change likely upgrades the publication law from "grouped query projection" to "ledger index plus detail projection". |
| `openspec/specs/web-heartbeat-view/spec.md` | Current package law still says Heartbeat preserves structured grouped stream behavior and load older from stream edge. | This change will modify or extend that law: default view becomes stable ledger list, full card rendering moves to detail. |

### Git Evidence

| Checkpoint | Expected commit evidence | Current status |
| ---------- | ------------------------ | -------------- |
| OpenSpec artifacts before apply | Commit containing `plans/plan.md`, specs, and `tasks.md` before app-code work starts | Not reached. This is discussion/research. |
| Task-progress commits | Commit containing current-context task checkbox updates plus matching code/BDD evidence | Not reached. |
| Self-review updates | Commit containing review output and any reopened or added OpenSpec tasks before the next apply loop | Not reached. |
| Normal archive | Commit containing `openspec archive <change>` result | Not reached. |
| Abnormal handoff | Commit containing `HANDOFF.md` / `vN.HANDOFF.md` evidence before returning to user discussion | Not reached. |

### Existing OpenSpec Survey

| File / change | Existing law or pattern | Reuse, extend, or break |
| ------------- | ----------------------- | ----------------------- |
| `openspec/specs/runtime-ui-publication/spec.md` | Runtime clients hydrate and republish one Heartbeat grouped slice; realtime `runtime.heartbeatPart` invalidates grouped projection. | Extend/break. Keep one Heartbeat inspection slice, but the list slice becomes ledger-index backed rather than query-time grouped only. |
| `openspec/specs/web-heartbeat-view/spec.md` | `@agenter/web-heartbeat-view` owns grouped presentation and mobile-first Framework7 surface. | Extend. Add ledger list/detail split while preserving full structured detail rendering. |
| `openspec/specs/workspace-runtime-shell/spec.md` | Heartbeat is the default runtime tab and currently described as continuous stream inside virtualizable conversation container. | Modify. The default Heartbeat tab may become a ledger list with a detail route/sheet; the continuous full stream becomes a detail mode or secondary inspection mode. |
| `openspec/changes/archive/2026-06-02-add-web-heartbeat-view` | Standalone example accepted first; Studio migration deferred. | Reuse. This new change can target package/example law first and later Studio migration. |

### User Language System

| User phrase | Working meaning | Plain-language translation when needed |
| ----------- | --------------- | -------------------------------------- |
| "审计流" | Heartbeat is an objective inspection ledger, not a chat transcript. | A time-ordered audit surface. |
| "分页列表" | The default surface should be stable summary rows, not full dynamic cards. | A countable ledger index. |
| "多页锚定" | The UI can dynamically follow latest pages or pin a historical page window like proxy's `pages=-1,2` model. | Stable page-window anchoring. |
| "新的表" | A persistent materialized table is needed to make pages/counts/anchors objective. | Backend infrastructure, not frontend cache. |
| "客观信息串起来" | Ledger entries must be derived from persisted facts and remain traceable to those facts. | Materialized projection with source references. |
| "标记上一些特征" | Store summary features such as status, type, aiCall ids, model/tool/token hints, preview. | Queryable summary columns/JSON. |
| "FTM/STM 文件" | A discussion artifact inside OpenSpec. No existing repo convention found. | This plan is the current shared discussion file unless a separate format is introduced. |

### Demo / Spike Code

| Path | Question it answers | Keep, migrate, or delete |
| ---- | ------------------- | ------------------------ |
| `demos/heartbeat-ledger-prototype.html` | Shows the expected mobile-first ledger list, page-window anchor bar, multi-page pager, new-update indicator, and independent detail surface. | Keep through plan/spec discussion; migrate interaction decisions into specs/tasks later. |

### Questions To Confirm With User

| Question | Why this is the real question | Current inference before user answers |
| -------- | ----------------------------- | ------------------------------------- |
| What is the row identity: grouped event, AI call, compact cycle, or a new ledger event that can contain multiple AI calls? | This determines table keys, detail routing, and how rows update. | Use a new ledger event identity. `aiCallIds` are row features, not the primary key. |
| Should `before-call-pending` be a countable ledger row or a volatile head row outside page count? | Pending facts can later be absorbed into a following AI call; counting them as normal rows may make page anchors drift. | Treat pending as a volatile latest/head row unless user wants it counted. |
| Does the new ledger table live in each `session.db` or in a higher-level avatar/runtime catalog DB? | Current facts live per session; Avatar-level listing crosses sessions/runtimes. | Put the ledger table in `session.db` for first law; aggregate across sessions later only if required. |
| Is exact numbered pagination required immediately, or is proxy-style latest/pinned page-window enough with total count? | Numbered pagination needs stable count and possibly page size configuration. | Need total row count and page windows from the new table immediately. |
| Can existing session DBs be backfilled on first open, or must migration be eager? | Multi-page anchors only become trustworthy after the ledger index exists. | Backfill on open is acceptable if the UI exposes an indexing state; confirm before specs. |
| Should list detail be a mobile route, a Framework7 Sheet, or both? | Mobile-first detail needs enough space for full dynamic content. | Mobile route first; desktop may use split or sheet adaptation. |

## Intent

### Surface Intent

Build the next Heartbeat milestone around stable ledger-list scrolling and multi-page anchoring. The default Heartbeat surface should show countable summary rows. Full dynamic card content should open only after selecting a row, so list scrolling remains stable even when details stream, expand, or re-render.

### Underlying Drive

The current "full grouped card stream" model asks one scroll container to solve too many problems: live streaming, dynamic card height, history pagination, detail expansion, and total page anchoring. The user's new direction separates the concerns. A durable ledger/index table creates the countable list truth. Detail rendering remains rich but no longer destabilizes the list.

### Final Visible Effect

An operator opens an Avatar Heartbeat page and sees a stable, mobile-first audit ledger:

- Rows are compact and scan-friendly.
- The latest page can auto-follow live entries.
- A historical page window can be pinned.
- New entries do not yank the operator out of a pinned historical inspection.
- The UI can say "page X/Y" or equivalent because the backend has a countable ledger table.
- Clicking a row opens the full Heartbeat detail, including markdown, reasoning, tool calls, compact data, and live updates, without shifting the list.

## Platform Diagnosis

- Current platform laws:
  - `session.db` stores objective runtime facts in `message_part`, `ai_call`, and related tables.
  - Current Heartbeat grouped pages are projected at query time from those facts.
  - Client SDK currently treats realtime Heartbeat events as grouped-data invalidation.
  - `web-heartbeat-view` currently renders full grouped rows in the list surface.
- Does this fit as a regular atom:
  - No. A pure frontend package atom cannot make multi-page anchoring reliable, because it cannot know total pages without countable backend/index truth.
- Does this require law upgrade:
  - Yes. Introduce a materialized Heartbeat ledger/index law in `session.db`, plus list/detail API contracts over that law.
- Breaking update stance:
  - This should be treated as a platform upgrade. Existing grouped query can remain as compatibility/detail projection, but the default list should move to the ledger index.
- User confirmations still required:
  - Pending row counting.
  - Backfill/migration behavior for existing session DBs.
  - Exact row identity and detail route shape.

## Reverse-Inferred Design

### Interaction / Visual Story

Default mobile flow:

```text
Avatars
  -> Heartbeat Ledger
       row: 12:30:04  running  call      ai#42       tool: shell
       row: 12:28:11  done     compact   ai#41       31K -> 9K
       row: 12:22:08  done     call      ai#39,#40   2 tools
       ...

Tap row
  -> Heartbeat Detail
       full grouped card content
       markdown / reasoning / tool / JSON / compact
       own scroll surface
```

Pagination story:

```text
dynamic latest:
  pages=-1,2
  latest window follows newly materialized ledger rows

pinned history:
  pages=14,2
  list stays on page 13..14 even if new rows arrive
  "new ledger entries" indicator appears
```

### Interface Shape

Provisional contracts:

- `runtime.heartbeatLedgerCount({ sessionId, filters? })`
- `runtime.heartbeatLedgerPage({ sessionId, anchor, count, pageSize, filters? })`
- `runtime.heartbeatLedgerEntry({ sessionId, entryId })`
- `runtime.heartbeatLedgerRefresh({ sessionId })` or automatic materializer trigger

List output should be summary-first:

```ts
type HeartbeatLedgerSummary = {
  id: number;
  entryKey: string;
  kind: "before-call" | "call" | "compact" | "pending" | "tool" | string;
  status: "running" | "completed" | "error" | "pending" | "blocked";
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
  primaryAiCallId: number | null;
  aiCallIds: number[];
  model: string | null;
  provider: string | null;
  previewText: string | null;
  featureFlags: string[];
  counts: {
    parts: number;
    tools: number;
    runningTools: number;
    errors: number;
  };
};
```

Detail output may reuse the existing grouped projection shape, but it should be loaded by `entryId` / `entryKey`.

### Data Shape

Provisional session DB table:

```sql
create table if not exists heartbeat_ledger_entry (
  id integer primary key autoincrement,
  entry_key text not null unique,
  kind text not null,
  status text not null,
  primary_ai_call_id integer,
  ai_call_ids_json text not null,
  source_refs_json text not null,
  feature_flags_json text not null,
  summary_json text not null,
  preview_text text,
  created_at integer not null,
  updated_at integer not null,
  completed_at integer,
  is_complete integer not null default 0
);

create index if not exists idx_heartbeat_ledger_created
  on heartbeat_ledger_entry(created_at desc, id desc);

create index if not exists idx_heartbeat_ledger_ai_call
  on heartbeat_ledger_entry(primary_ai_call_id, created_at asc, id asc);

create index if not exists idx_heartbeat_ledger_kind_status
  on heartbeat_ledger_entry(kind, status, created_at desc, id desc);
```

Potential source reference model:

```ts
type HeartbeatLedgerSourceRef =
  | { kind: "ai_call"; id: number; role: "primary" | "related" }
  | { kind: "message_part"; messageId: string; role: "request" | "response" | "auxiliary" | "tool" }
  | { kind: "effect_ledger"; effectId: string; role: "effect" }
  | { kind: "attention_dispatch"; dispatchId: string; role: "delivery" };
```

Important distinction:

- Source fact tables remain the objective facts.
- `heartbeat_ledger_entry` is a materialized index/projection for stable list pagination.
- Detail rendering must keep source references visible enough that the projection does not pretend to be the raw fact itself.

### Architecture Shape

Atoms and laws:

- `SessionDb` gains Heartbeat ledger materialization storage and query helpers.
- App server gains ledger page/count/detail APIs.
- Client SDK gains `heartbeatLedgerBySession` resource state separate from full detail state.
- `@agenter/web-heartbeat-view` gains:
  - `HeartbeatLedgerList`
  - `HeartbeatLedgerDetail`
  - list/detail types
  - Framework7 page shell for mobile-first list -> detail navigation
- Existing grouped card renderer becomes a detail renderer, not the default list renderer.

Forbidden couplings:

- The package must not query raw `message_part`/`ai_call` from the browser.
- The list must not rebuild ledger rows from full detail cards.
- The materialized ledger must not replace source fact tables or erase traceability.
- Multi-page anchoring must not depend on DOM scroll heuristics alone.

### User Confirmation Gates

| Gate | Why confirmation is required | Default until user answers |
| ---- | ---------------------------- | -------------------------- |
| Pending row counting | Pending rows can turn into later before-call/call rows and may destabilize page count. | Treat pending as volatile head row outside stable historical count. |
| Backfill strategy | Existing sessions have no ledger table. | Backfill on first Heartbeat open and expose indexing state. |
| Detail shell | Mobile Sheet may not be enough for full dynamic detail. | Mobile route page first; desktop can adapt to sheet/split later. |
| Ledger row key law | Wrong key law will break updates and detail links. | New `entry_key` law, not raw aiCall id. |

## Intent-Driven Plan

- [ ] 1. Research and align intent.
- [ ] 2. Write specs for Heartbeat ledger table, list/detail API, page-window anchoring, and web-heartbeat-view list/detail UX.
- [ ] 3. Write BDD tasks from specs.
- [ ] 4. Implement session DB materialized ledger, server/client APIs, package UI split, and example route proof.
- [ ] 5. Self-review against intent and decide whether to loop.

## Open Questions

| Question | Why it matters | Default assumption until user answers |
| -------- | -------------- | ------------------------------------- |
| Should `heartbeat_ledger_entry` include one row per grouped event or one row per higher-level "message card"? | User says one message card may contain multiple AI calls, so existing group/card boundaries may not be row boundaries. | Use a new ledger event abstraction with `aiCallIds[]`. |
| Should the list expose exact page numbers or only page windows around latest/history anchors? | Exact page numbers require total row count and stable page size. | Exact total pages are required because multi-page anchoring is the stated infrastructure goal. |
| How should deleted/compacted/retired rows behave? | Page anchors drift if rows disappear. | Prefer immutable historical rows with status updates over deletion. |
| Should details be stored in the ledger table snapshot or reconstructed from source refs? | Storing full detail duplicates facts; reconstructing detail costs query work. | Store summaries only; reconstruct detail from source refs and existing fact tables. |
| How much denormalized feature data should be indexed as columns vs JSON? | Columns help filters and sorting; JSON keeps schema flexible. | Start with core columns plus `summary_json`/`feature_flags_json`; add columns only for first-class filters. |

## Rejected Paths

| Path | Why rejected |
| ---- | ------------ |
| Keep current grouped query and add frontend page numbers | The frontend cannot know total pages without a countable stable backend/index truth. |
| Virtualize complete dynamic cards harder | It reduces symptoms but keeps list scroll coupled to streaming/detail height changes. |
| Reverse the entire Heartbeat stream into a literal X timeline | It may improve feed feel but harms causal audit readability. |
| Make `ai_call` the ledger row identity | User explicitly noted one message card may include multiple AI calls; `aiCall` is a feature dimension, not always the row. |
| Store only row snapshots with no source references | That would turn a projection into an untraceable pseudo-fact and violate audit-flow expectations. |

## Exit Conditions

- Default max review iterations: 3
- Issue recurrence threshold: same unresolved design issue appears in 3 consecutive review rounds
- Custom exit condition from intent: The change can enter apply only when the ledger row identity, pending-row policy, backfill strategy, page-window API, and mobile detail shell are explicitly settled in specs/tasks.
