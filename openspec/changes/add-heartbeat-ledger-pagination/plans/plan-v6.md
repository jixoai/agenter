# Intent Document

## Current Round

- Round: 4
- Status: Research and visual alignment before specs.
- Previous plan backup: `plans/plan-v1.md`
- Working change id: `add-heartbeat-ledger-pagination`
- Working terminology correction: use **Heartbeat Record** as the domain term; treat `ledger` as a retired planning word unless the change id is renamed later.
- Record item visual correction: use a metro-platform timeline, not a left/middle/right card.
- Metro graph correction: graph stations use icons, not type words, and must remain responsive inside the record item.
- Type-specific visual correction: `model_call`, `compact`, and `config` do not need the same middle graphic grammar.
- Accessibility correction: verbose `title` content belongs on the chip or surface, not on the inner icon node.

## Workflow Command Surface

- Check status: `bun run openspec:vision -- status add-heartbeat-ledger-pagination`
- Backup plan before major rewrites: `bun run openspec:vision -- backup-plan add-heartbeat-ledger-pagination`
- Validate after specs exist: `bun run openspec:vision -- validate add-heartbeat-ledger-pagination`
- Rename after intent realignment, if approved: `bun run openspec:vision -- rename add-heartbeat-ledger-pagination add-heartbeat-record-pagination`

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

> 整体不建议叫ledger, 直接叫record，会更加中立，或者直接叫groupItem？会不会能更加与现有的视觉信息更有关联？不过说实话，现有也有group这个概念，我看着也很奇怪，比如看到 `group 3`，我很难第一时间和Heartbeat的列表记录做思维关联。所以我觉得，要么就直接把原本的group直接改名成record，统一用record这个关键词给这个技术点命名。或者你有更好的建议吗？
>
> 设计中有一些不大现实的东西，可能来自原本的不好设计，也有来自你的错误理解，比如html中，有“Collect terminal state and decide next action”，请问这个title要从哪里来呢？不现实啊。
>
> 因此我们可以把 AssistantMessage:textPart 作为一种阶段性的总结。
> 我们可以在我们的 list-item 上展示最新的一条阶段性总结。但这不绝对，AI可能不提供总结信息。或者因为我在 UserMessage: toolCallResult 携带了 textPart(commit-attention-items)，因此我们会归到一条新的record。
>
> 注意：我先不说布局，我就说，我们能有哪些信息可以展示。
>
> 然后最关键的就是这些工具调用、思考 等 message-part，这些理论上都可以记录开始时间和结束时间，因为我们是流式传输，因此能知道什么时候开始思考，什么时候结束思考。
>
> 所以客观说，我们应该围绕这些MessagePart来展开 recordItem的设计。
>
> 再有，确实可以区分 compact、config（ai调用的参数改动，包括系统提示词、开不开thinking、maxToken、topK等等）、call（不同的AI调用，但要不要称为call？有没有更好的单词？），至于你设计的tool和pending，这又是什么类型呢？
>
> 还有Pinned history这个是什么设计？

## Evidence Read

| Source | Fact | Why it matters |
| ------ | ---- | -------------- |
| `../proxy/src/routes/RequestsPage.tsx` | Requests use a summary list plus an independent detail surface. | Confirms list/detail separation as the right scroll law. |
| `../proxy/src/components/RequestList.tsx` | List rows show bounded metadata, not full bodies. | Heartbeat Records should be compact summaries, not dynamic full cards. |
| `../proxy/src/components/RequestDetail.tsx` | Full bodies load only after selection. | Heartbeat detail can render markdown, thinking, tool calls, and JSON outside the list scroll. |
| `../proxy/src/components/ui/multi-page-pagination/types.ts` | `pages=-1,2` means latest dynamic anchor; positive page anchors mean fixed historical windows. | Keep page-window anchoring, but do not expose confusing "Pinned history" wording in the UI. |
| `packages/app-server/src/heartbeat-groups.ts` | Existing Heartbeat groups are query-time projections from `ai_call` and inspection messages. | `group` is an implementation/projection term, not a good user-facing or durable domain word. |
| `packages/app-server/src/heartbeat-groups-page.ts` | Existing pages are bounded cursor windows and cannot provide stable total pages. | A materialized Record table remains necessary. |
| `packages/session-system/src/session-db.ts` | `message_part` and `ai_call` are persisted objective facts in `session.db`. | Heartbeat Record must be materialized from these facts and keep source references. |

## Terminology Decision

| Term | Decision | Reason |
| ---- | -------- | ------ |
| `record` | Use as the durable domain word: `HeartbeatRecord`, `HeartbeatRecordItem`, `heartbeat_record`. | Neutral, visible, and close to the user's "list record" mental model. |
| `group` | Retire from new public naming. Keep only when describing current implementation. | `group 3` does not immediately map to a Heartbeat list record. |
| `ledger` | Retire from product/API/table naming for this change. | Too opinionated and implies accounting semantics; `record` is enough. |
| `record item` | Use for the list row. | Matches list UI and avoids confusing the row with source fact rows. |
| `message part` | Use as the primary source-fact axis. | Thinking, text, tool call, and tool result have objective timing and source identity. |
| `model call` | Preferred UI wording for an AI invocation. | More precise than generic `call`; can still map to existing `ai_call` internally. |

## Current Mental Model

Heartbeat is not a chat transcript. It is a record list built from objective runtime facts.

```text
source facts
  message_part: user.text / assistant.thinking / assistant.text / assistant.tool_call / user.tool_result / ...
  ai_call: provider request/response boundary, model, config, status, token usage
  compact/config/effect facts

materialized index
  heartbeat_record
    id
    kind
    status
    time range
    source refs
    summary features
    latest assistant textPart preview, when available
    message-part timeline summary

UI
  record list: stable, bounded rows
  record detail: full dynamic content, own scroll surface
```

## Record Kinds

This is the current candidate set. It deliberately removes `tool` and `pending` as top-level record kinds.

| Kind | Meaning | Source facts | UI summary |
| ---- | ------- | ------------ | ---------- |
| `model_call` | One or more model invocations and their surrounding message parts. | `ai_call` plus related `message_part` rows. | time range, status, model, aiCall ids, latest assistant textPart preview, part timeline. |
| `compact` | Context compaction fact. | compact/effect/context facts, plus source refs if available. | before/after context usage, trigger, result status. |
| `config` | Change to next model-call parameters. | config/effect/settings facts. | changed fields such as system prompt, thinking, max tokens, topK, effort. |

Non-kinds:

- `tool_call` is a `message_part` inside a `model_call` record.
- `tool_result` is a `message_part` that can become the input side of the next `model_call` record.
- `pending` is a status/phase of an incomplete source stream, not a record kind.

Open naming question:

- `model_call` may still be too technical for the UI. Alternatives are `model_run` and `assistant_step`. My current preference is:
  - internal/API: `model_call`, because it maps to `ai_call`;
  - UI label: `Model run`, because it reads better in a list.

## What A Record Item Can Objectively Show

| Field | Source | Caveat |
| ----- | ------ | ------ |
| Record time range | min/max timestamps of source message parts and related call facts. | Requires part start/end timestamps to be captured or inferred consistently. |
| Status | source stream/call/tool/compact/config completion facts. | `running` is objective only while a stream or action is open; do not invent future intent. |
| Kind | materialized record classifier. | Classifier must be rule-based and traceable. |
| AI call ids | related `ai_call` ids. | Feature dimension only; not row identity. |
| Model/provider/config | `ai_call` and config facts. | Not every record kind has this. |
| Message part timeline | `message_part` rows with role/type/start/end. | This is the core display axis. |
| Latest stage summary | latest `AssistantMessage:textPart`, when present. | Optional one-line preview only; if absent, render nothing. |
| Tool calls | `assistant.tool_call` message parts. | Feature/chip/timeline item, not top-level kind. |
| Tool results | `user.tool_result` message parts. | Often input to the next model run; may carry `textPart(commit-attention-items)`. |
| Compact result | compact facts. | Separate kind. |
| Config changes | config/settings/effect facts. | Separate kind. |

## Visual Prototype

Current discussion artifact:

- `demos/heartbeat-record-prototype.html`
- `demos/heartbeat-model-run-adaptive-canvas.html`
- `demos/heartbeat-record-type-study.html`
- `demos/heartbeat-compact-config-brainstorm.html`
- `demos/heartbeat-record-component-gallery.html`

Changes from the first prototype:

- Replaces `ledger` wording with `record`.
- Removes invented titles such as "Collect terminal state and decide next action".
- Uses latest `AssistantMessage:textPart` as optional stage summary.
- Omits the summary line when no `AssistantMessage:textPart` exists.
- Treats thinking/tool calls/tool results as timed MessagePart facts inside a record.
- Renders the list row as a top/middle/bottom structure:
  - top: left time, middle record identity/model, right status;
  - middle: metro-platform graph from start to summary/omitted stats to latest/end station;
  - bottom: one-line optional summary plus compact auxiliary facts.
- Uses icons for graph stations; the graph should not show words such as `thinking`, `tool`, `user.text`, or `final text`.
- Uses Material Symbols icons in the prototype rather than hand-drawn icons.
- Adds verbose `title` attributes on chip/surface nodes rather than the inner icons.
- Keeps numeric measurements in the graph for intervals and counts.
- Condenses long middle processes into an icon-stat middle station, such as thinking duration plus tool-call count.
- Ensures the graph is responsive and does not overflow the record item. Wider width may show more explicit stations; narrower width must still show start, omitted/stat station, and the highest-priority tail nodes.
- Gives `model_call` its own dedicated adaptive canvas so the space-priority law can be reviewed independently from other record kinds.
- Uses tail-first expansion for `model_call`: after `start`, the UI prefers `summary -> tool -> text(end)` before reintroducing early stations.
- Uses a dashed latest station when the newest visible part is still open.
- Treats `model_call` as the only record kind that clearly benefits from the metro graph as the primary middle visual.
- Treats `compact` as a delta object: preferred direction is a before/after compression capsule, not a rail.
- Treats `config` as a changed-control set: preferred direction is a changed-controls strip, not a rail.
- Adds a separate brainstorm file that contrasts two design philosophies for `compact` and `config`:
  - product-object / "one dominant gesture"
  - simulation-surface / "operator control panel"
- Adds a final component gallery that collects the currently preferred direction for each record kind in one place.
- Replaces `Pinned history` language with neutral anchor wording:
  - `Latest anchor`
  - `Fixed page window`
  - `New records available`

## Platform Diagnosis

Current platform laws:

- `session.db` stores objective facts, including `message_part` and `ai_call`.
- Current Heartbeat groups are computed at query time.
- Current grouped pages are cursor-like windows and cannot provide stable total page count.

Diagnosis:

- This is not a pure frontend atom.
- Multi-page anchoring requires a platform law upgrade: a materialized `heartbeat_record` table in `session.db`.
- The new table is a materialized index/projection. It must not replace source facts or hide source refs.

## Provisional Storage Shape

```sql
create table if not exists heartbeat_record (
  id integer primary key autoincrement,
  record_key text not null unique,
  kind text not null,
  status text not null,
  primary_ai_call_id integer,
  ai_call_ids_json text not null,
  source_refs_json text not null,
  feature_flags_json text not null,
  summary_json text not null,
  preview_text text,
  started_at integer not null,
  updated_at integer not null,
  completed_at integer,
  is_complete integer not null default 0
);

create index if not exists idx_heartbeat_record_started
  on heartbeat_record(started_at desc, id desc);

create index if not exists idx_heartbeat_record_ai_call
  on heartbeat_record(primary_ai_call_id, started_at asc, id asc);

create index if not exists idx_heartbeat_record_kind_status
  on heartbeat_record(kind, status, started_at desc, id desc);
```

Provisional source refs:

```ts
type HeartbeatRecordSourceRef =
  | { kind: "ai_call"; id: number; role: "primary" | "related" }
  | { kind: "message_part"; messageId: string; partId: string; role: "input" | "output" | "tool_call" | "tool_result" }
  | { kind: "effect"; id: string; role: "compact" | "config" | "other" };
```

## Provisional API Shape

Names should use `Record`, not `Ledger`:

- `runtime.heartbeatRecordCount({ sessionId, filters? })`
- `runtime.heartbeatRecordPage({ sessionId, anchor, pageCount, pageSize, filters? })`
- `runtime.heartbeatRecordDetail({ sessionId, recordId })`

List summary:

```ts
type HeartbeatRecordSummary = {
  id: number;
  recordKey: string;
  kind: "model_call" | "compact" | "config";
  status: "running" | "completed" | "error" | "blocked" | "cancelled";
  startedAt: number;
  updatedAt: number;
  completedAt: number | null;
  primaryAiCallId: number | null;
  aiCallIds: number[];
  model: string | null;
  provider: string | null;
  previewText: string | null;
  parts: Array<{
    role: "user" | "assistant" | "tool" | "system";
    type: "text" | "thinking" | "tool_call" | "tool_result" | "config" | "compact";
    startedAt: number;
    completedAt: number | null;
    label: string;
  }>;
  counts: {
    parts: number;
    toolCalls: number;
    toolResults: number;
    errors: number;
  };
};
```

## Page Anchor Language

Keep the proxy-like anchor behavior, but rename the user-facing concept.

| Technical state | UI language | Meaning |
| --------------- | ----------- | ------- |
| `pages=-1,2` | Latest anchor | Follow the latest page window. |
| `pages=16,2` | Fixed page window | Stay on a historical page window while new records arrive. |
| realtime insert while fixed | New records available | Do not steal scroll or change the user's current record window. |

## Open Questions Before Specs

| Question | Current recommendation |
| -------- | ---------------------- |
| Should the change id be renamed? | Yes, after this terminology is accepted: `add-heartbeat-record-pagination`. |
| Should internal kind be `model_call`, `model_run`, or `assistant_step`? | Internal/API `model_call`; UI label `Model run`. |
| Do we need a separate `heartbeat_record_part` table? | Maybe. If part summaries become query-heavy or need independent timing indexes, add it. First spec can store part summaries in `summary_json` while keeping source refs. |
| Can part start/end times be trusted today? | Needs code audit before tasks. If current facts do not persist both times, this change must add that fact capture. |
| How does `UserMessage:toolCallResult + textPart(commit-attention-items)` split records? | Treat that textPart as an input boundary for a new `model_call` record, not as the previous tool-call feature. |
| Should exact total pages be shown immediately? | Yes, because the new `heartbeat_record` table exists specifically to make countable pages real. |

## Next Step

Do not enter apply yet. First align on the updated visual prototype and the naming model:

- `record` as the main term.
- `model_call`/`Model run` for AI invocation records.
- message parts as the core record-item display axis.
- tool call/result as part features, not top-level record kinds.
- latest assistant textPart preview as an optional one-line auxiliary preview, not an invented title.
- metro-platform row layout as the current visual target for dense timing display.
- icon-only metro graph with numeric intervals/counts, responsive inside the row.
- type-specific middle visuals:
  - `model_call`: adaptive metro graph
  - `compact`: delta/compression object
  - `config`: changed-controls object
- `model_call` expansion priority:
  - smallest useful: `start -> summary -> text(end)`
  - next: `start -> summary -> tool -> text(end)`
  - wider: reintroduce earlier stations before the summary
- design-philosophy split for state-mutation records:
  - product-object: reduce to one decisive transformation or one strip of changed controls
  - simulation-surface: expose state channels or gauges for operator inspection
- currently preferred visual directions:
  - `model_call`: adaptive metro graph with tail-first expansion
  - `compact`: product-object compression channel
  - `config`: product-object changed-controls strip
