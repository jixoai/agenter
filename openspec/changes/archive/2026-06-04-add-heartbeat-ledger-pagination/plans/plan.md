# Intent Document

## Current Round

- Round: 6
- Status: Model Run Record Card and Record Detail visual convergence before backend/page implementation.
- Previous plan backup: `plans/plan-v1.md`
- Working change id: `add-heartbeat-ledger-pagination`
- Working terminology correction: use **Heartbeat Record** as the domain term; treat `ledger` as a retired planning word unless the change id is renamed later.
- Canonical visual artifact: `plan.html` is the current design entry. It routes focused iframe canvases so each hard visual question can evolve independently.
- Record item visual correction: use a metro-platform timeline, not a left/middle/right card.
- Metro graph correction: graph stations use icons, not type words, and must remain responsive inside the record item.
- Type-specific visual correction: `model_call`, `compact`, and `config` do not need the same middle graphic grammar.
- Detail-surface correction: list rows stay bounded; selected detail owns the full dynamic content and its own scroll surface.
- Model Run detail correction: the horizontal metro grammar expands vertically into steps, with sticky chips on the left and full step content on the right.
- Compact detail correction: use `New Context | Old Context` tabs, default to `New Context`, and show streaming, empty, and error states inside that tab content.
- Compact detail copy correction: compact detail should show the compression object and context bodies directly. Streaming, error, and empty states are compact factual rows, not explanatory cards.
- Config detail correction: use `Diff Config | New Config | Old Config` tabs, with YAML diff as the first view and YAML source views for new/old configs.
- Accessibility correction: verbose `title` content belongs on the chip or surface, not on the inner icon node.
- Component-continuity correction: list and detail must share the same `BasicRecordCard`, `RecordChip`, and kind-specific `CardBody` primitives. The card body is a compressed form; detail expands the same body language instead of reimplementing a separate detail UI.
- Detail-rail correction: the selected-detail rail must read as `navigation + overview + time`, but the station chip itself owns navigation plus the icon/metric overview; the outer SVG line owns time, and the inner connector owns chip-border continuity.
- Current Detail debugging focus: temporarily hide interval time labels and right-side section cards so the timeline grid itself can be reviewed without content-card interference.
- Detail migration correction: the old `web-heartbeat-view` record Card bodies should be migrated into the real Detail surface styles instead of being faithfully recreated inside this HTML prototype; the design canvas should document intent and pressure points, not pretend it can reproduce every production style.
- Config Detail correction: Config detail should focus on exactly three tabs: `Diff Config`, `New Config`, and `Old Config`. The first tab renders a syntax-highlighted unified diff; New/Old render syntax-highlighted YAML snapshots.
- Product-copy correction: detail pages are inspection surfaces, not manuals. Visible UI should show facts, state, diffs, and source content; explanatory design rationale belongs in this plan or code comments, not in product text.
- Metro-width correction: the adaptive board must visibly prove `narrow -> fuller expansion` with real container widths, not three visually equivalent frames.

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

## Current Source-Fact Audit

| Area | Current fact | Impact on implementation |
| ---- | ------------ | ------------------------ |
| `message_part` table | Stores `part_id`, `part_index`, `message_id`, `window_id`, `ai_call_id`, `round_index`, `scope`, `role`, `part_type`, `mime_type`, `payload_json`, `created_at`, `updated_at`, and `is_complete`. | Good source-ref basis for selected detail reconstruction and list summaries. |
| `message_part` timing | Current `upsertMessage` writes `created_at` and `updated_at` from the message-level upsert input for every part in that message. | Do not assume this already gives true per-part start/end timing. Record timing can initially use available created/updated facts, but exact streaming span may require new capture or conservative inference. |
| `ai_call` table | Stores kind/status/provider/model/request/response/error/outcome, request/response/auxiliary message IDs, and created/updated/completed/is_complete. | Strong anchor for `model_call` record identity, model metadata, config snapshot, status, and source refs. |
| Current grouped query | `runtime.heartbeatGroupsPage` calls `pageHeartbeatGroupsFromDb`, which loads bounded `ai_call` windows plus `heartbeat_part`/`request_aux` messages and then runs `projectHeartbeatGroups`. | Existing grouping is a query-time projection. It remains valid as detail evidence, but cannot be the stable countable page index. |
| Current client store | `loadHeartbeatGroups` / `loadMoreHeartbeatGroups` maintain a reverse cursor and cached grouped rows. | Existing UI cache law can inspire record resources, but record pagination needs page-window anchors and exact count instead of cursor-only older loading. |

Implementation conclusion:

- `heartbeat_record` still needs to be materialized in `session.db`.
- Detail reconstruction should keep using source refs into `message_part`, `ai_call`, and compact/config facts.
- Exact message-part start/end timing is not fully guaranteed by the current schema/write path. The first implementation must either add precise timing capture or mark timing fields as conservative projections from available `created_at/updated_at`.
- No new backend endpoint has been proven necessary yet, but the existing runtime publication shape will need new record-count/page/detail procedures inside the current runtime capability boundary.

Backend boundary decision:

- User confirmed this change may add the needed runtime record publication API after the source-fact audit.
- The allowed shape is inside the existing runtime capability boundary: record count, record page, and selected record detail.
- This does not authorize replacing source facts or changing Heartbeat into a frontend-only regrouping path.

## Terminology Decision

| Term | Decision | Reason |
| ---- | -------- | ------ |
| `record` | Use as the durable domain word: `HeartbeatRecord`, `HeartbeatRecordItem`, `heartbeat_record`. | Neutral, visible, and close to the user's "list record" mental model. |
| `group` | Retire from new public naming. Keep only when describing current implementation. | `group 3` does not immediately map to a Heartbeat list record. |
| `ledger` | Retire from product/API/table naming for this change. | Too opinionated and implies accounting semantics; `record` is enough. |
| `record item` | Use for the list row. | Matches list UI and avoids confusing the row with source fact rows. |
| `message part` | Use as the primary source-fact axis. | Thinking, text, tool call, and tool result have objective timing and source identity. |
| `model call` | Preferred UI wording for an AI invocation. | More precise than generic `call`; can still map to existing `ai_call` internally. |

Change id decision:

- Keep `add-heartbeat-ledger-pagination` as the active OpenSpec change id for history and tooling continuity.
- Do not use `ledger` in new table/API/UI names.
- Archive/review language should call the feature `Heartbeat Record pagination`.

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

- `plan.html`
- `canvases/record-cards.html`
- `canvases/basic-record-card.css`
- `canvases/record-components.js`
- `canvases/model-run-metro.html`
- `canvases/compact-config.html`
- `demos/heartbeat-compact-config-brainstorm.html`
- `canvases/list-detail-anchor.html`

Current visual SSOT:

- `plan.html` is now the canonical entry shell. It uses an iframe stage to route multiple focused canvases instead of mixing every variant into one scroll page.
- `canvases/basic-record-card.css` defines the shared `BasicRecordCard` shell law: left time/duration, middle identity/meta, right status, body slot, optional support slot.
- `canvases/record-components.js` defines the enhanced Web Components used by the canvases: `x-basic-record-card`, `x-record-chip`, `x-model-run-card`, `x-model-run-chip-gallery`, `x-compact-body`, and `x-config-body`.
- `canvases/record-color-tokens.css` is the semantic palette SSOT for record canvases, especially the Metro chip system.
- `canvases/record-cards.html` owns same-kind height and index/rich/debug row variants. `model_call` is now represented by attribute-driven `x-model-run-card` instances rather than handwritten inner stations.
- `canvases/model-run-metro.html` owns the adaptive model-run card API, width budget, chip taxonomy, merge math, and a dedicated chip gallery. The model card derives `narrow`, `medium`, or `full` density from actual rendered width, but accepts an explicit `layout-width` hint so scripted width changes do not flash one stale frame before `ResizeObserver` catches up. It then computes a contiguous tail window plus one middle combo chip when width is insufficient.
- `canvases/model-run-metro.html` now uses wider proof widths so the design board visibly demonstrates the adaptive law rather than flattening every frame into the same density class.
- `canvases/model-run-metro.html` now keeps the metro line above the chips instead of overlapping them. The time strip and the thin connector line remain visible, but the vertical spacing now makes the line behave like a selection guide rather than part of the chip body.
- `canvases/model-run-metro.html` now renders the metro line as a dedicated upper rail row and the chips as a lower row with a fixed 2px gap. The line should read as one connected platform above the stations, not as short bridge fragments sitting between chips.
- `canvases/model-run-metro.html` now also restores the lower thin chip-to-chip connector line. The upper rail is for selection and time marking; the lower line is the subtle station connection that makes the chip sequence read as one route.
- `canvases/color.html` documents the semantic palette and previews the same color tokens on real Metro cards.
- `canvases/compact-config.html` owns compact and config record variants plus their preset toggles. Compact and Config use the shared `BasicRecordCard` shell while keeping their body-specific product-object grammars. Compact explicitly carries completed, running, and error variants, while Config exposes the actual next-call knobs and state axis inside the card itself.
- Config keeps the target scope in title/tooltip metadata instead of the visible knob grid, and the visible state axis only distinguishes applied, saving, error, and unavailable; `ready` is retired as a visible state.
- `demos/heartbeat-compact-config-brainstorm.html` contrasts the preferred changed-controls strip with a heavier operator-panel foil so the Config tradeoff stays visible instead of being flattened into one visual.
- `canvases/list-detail-anchor.html` owns list/detail selection, latest/fixed/new-record anchor state, and the component-continuity law. Its detail surface is a Declarative Shadow DOM component with a chips-line rail, because detail reconstruction is a separate surface from the stable list index.
- `canvases/list-detail-anchor.html` treats its small tabs helper as a prototype-only shim. Product migration must replace it with the product/Framework7 tabs component while keeping the `Diff Config | New Config | Old Config` tab contract.
- The Model Run detail rail now uses one low-redundancy station grammar:
  - one station chip per message-part step; the chip is both navigation and icon/metric overview
  - an outer vertical SVG range segment that is the rotated form of the horizontal card's upper time range line: main segment plus 2px endpoint ticks; the interval text and label gap are deliberately hidden during the timeline-only pass
  - the outer range stroke should stay visually light, and its two vertical halves should not touch; keep a small gap in the middle so the line feels like the Card reference instead of one heavy spine
  - the rail uses a grid rotation of the card layout: the horizontal card's `row-gap` becomes the detail rail's `column-gap`
  - station chips are left-aligned; the chip-line axis is fixed near `20px` inside the chip column instead of being centered inside each chip
  - the station chip grid cell is content-sized (`min-content/max-content`), not a `1fr` column; the right-side station body owns the remaining `1fr` space
  - the outer range segment is placed in its own grid column; the gap between outer range and chip-axis connector is a real grid column, not runtime chip-width measurement
  - an inner vertical chip-line connector sits in the same chip column and preserves route continuity between station chips
  - each station body spans the station's chip row plus its following line row; the last station still keeps a following empty line row so body layout remains stable
  - timeline-only debugging currently hides the right-side section cards so chip/line geometry can be reviewed without content-card interference
- The canvases use Web Components as the component boundary. The final target API for `model_call` is attr/data-driven rather than handwritten child stations.
- Config detail currently uses a code-block grammar for `Diff Config`: the HTML prototype provides lightweight line highlighting only. Product migration should render `diff` and `yaml` with the project's highlight library instead of a custom table.

Changes from the first prototype:

- Replaces `ledger` wording with `record`.
- Removes invented titles such as "Collect terminal state and decide next action".
- Uses latest `AssistantMessage:textPart` as optional stage summary.
- Omits the summary line when no `AssistantMessage:textPart` exists.
- Treats thinking/tool calls/tool results as timed MessagePart facts inside a record.
- Renders the list row as a top/middle/bottom structure:
  - top: left time, middle record identity/model, right status;
  - middle: metro-platform graph from start to combo/omitted stats to latest/end station;
  - bottom: one-line optional summary plus compact auxiliary facts.
- Uses icons for graph stations; the graph should not show words such as `thinking`, `tool`, `user.text`, or `final text`.
- Uses Lucide UMD icons in the prototype, already aligned with the intended LucideIcon migration target.
- Uses a semantic color palette that separates neutral layout tones from message-part semantics; Metro chips now encode role with restrained tinted surfaces instead of a monochrome row.
- Lowers detail noise by retiring duplicated section-header chips once the left rail already owns the step navigation language.
- Adds a shared in-progress animation law: active time/duration and active status breathe; Model Run streaming status may use shiny text inside the status pill; error states stay stable and do not breathe.
- Adds verbose `title` attributes on chip/surface nodes rather than the inner icons.
- Keeps numeric measurements in the graph for intervals and counts.
- Condenses long middle processes into an icon-stat middle combo chip, such as thinking duration plus tool-call count.
- Removes duplicate same-kind icons inside a single chip. `text/tool/thinking/...` chips render as one chip token; only `input` and `combo` keep a separate primary icon plus nested part tokens.
- Ensures the graph is responsive and does not overflow the record item. Wider width may show more explicit stations; narrower width must still show input, combo, and the highest-priority tail nodes.
- Keeps chip height visually stable while labels collapse under narrow width by sharing typography, icon sizing, line-height, and padding-block instead of forcing a fixed chip height.
- Gives `model_call` its own dedicated adaptive canvas so the space-priority law can be reviewed independently from other record kinds.
- Uses tail-first expansion for `model_call`: after `input`, the UI prefers `combo -> latest tail neighbors -> latest chip` before reintroducing early stations.
- Uses `latest pending` only as a latest-chip state; it does not create a second dashed line.
- Treats `model_call` as the only record kind that clearly benefits from the metro graph as the primary middle visual.
- Treats the first station as `inputChip` / `userMessageChip`, not a generic start chip.
- Excludes `toolCallResult` from `inputChip`; tool results are merged back into the source tool-call chip automatically.
- Treats the line itself as the time carrier:
  - first line: closed interval `[inputChip, nextChip]`
  - later lines: half-open intervals `(prevChip, nextChip]`
- Uses a math-first chip-fit algorithm rather than handwritten station states:
  - derive atomic chips from objective message-part facts
  - normalize tool-call/tool-result pairs back into tool chips
  - merge adjacent same-kind chips when the gap is small enough
  - compress chip metrics by density before hiding stations
  - estimate both chip widths and line-label widths from the same visual tokens used for rendering
  - keep a contiguous tail window that fits the inner timeline budget
  - collapse the hidden middle span into one combo chip
- Adds a dedicated `Chip Gallery` canvas section so every chip family is visible as a real rendered specimen instead of only prose.
- The current chip taxonomy for `model_call` is:
  - `inputChip`
  - `textChip = textIcon + tokenCount`
  - `imageChip = imageIcon + fileSize`
  - `videoChip = videoIcon + videoLength`
  - `fileChip = fileIcon + fileSize`
  - `thinkingChip = thinkingIcon + timeSpan`
  - `refusalChip = refusalIcon`
  - `errorChip = errorIcon`
  - `toolChip = toolIcon + count` where count is omitted for one call
  - `pendingChip = pendingIcon`
  - `unknownChip = unknownIcon`
  - `comboChip = comboIcon + aggregate metrics for the folded middle span`
- Treats `compact` as a delta object: preferred direction is a before/after compression capsule, not a rail.
- Compact card variants are now:
  - completed: stable before/after compression capsule
  - running: breathing header/status plus an animated compression sheen
  - error: stable red error state that preserves the original context usage fact
- Treats `config` as a changed-control set: preferred direction is a changed-controls strip, not a rail.
- Adds a separate brainstorm file that contrasts two design philosophies for `compact` and `config`:
  - product-object / "one dominant gesture"
  - simulation-surface / "operator control panel"
- Merges the component-continuity proof into `canvases/list-detail-anchor.html` instead of keeping a separate canvas.
- Replaces `Pinned history` language with neutral anchor wording:
  - `Latest anchor`
  - `Fixed page window`
  - `New records available`
- Upgrades ListDetail to an explicit surface split:
  - list rows are page-index records and must not expand into unbounded content;
  - selecting a record keeps page membership stable and swaps the independent detail surface;
  - latest/fixed/new-record anchor state stays visible above the list/detail split.
- Upgrades Model Run detail from a horizontal row graph into a vertical step inspection surface:
  - left rail: sticky station chips for input, thinking, tool, text/error/pending, where each chip carries the visible metric label;
  - outer line: vertical SVG range segments strictly mapped from the horizontal time-range SVG, including endpoint ticks and the label gap;
  - inner line: vertical chip-line-chip connector colored from the neighboring chip borders;
  - horizontal leader: dashed line from the outer timeline to the chip axis, with the interval label masked on top;
  - right body: full content for each step, including source refs, tool arguments/results, reasoning, and partial text;
  - latest pending is a step state with restrained motion, not a second list row.
- Upgrades Compact detail into tabs:
  - `New Context` is the default tab;
  - `Old Context` is secondary history;
  - streaming, empty, and error states render inside `New Context`;
  - an error appears at the start of tab content and does not hide already streamed context;
  - visible copy is reduced to context source, compression percentages, and machine state values.
- Upgrades Config detail into tabs:
  - `Diff Config` is the default tab;
  - `New Config` and `Old Config` render YAML source views;
  - the diff and YAML tabs should use syntax highlighting, not a custom table;
  - visible content stays to the facts themselves; redundant explanation text is removed.
- Moves the component-continuity proof into the ListDetail canvas:
  - the list rows use the same shared record-card primitives as the detail surface;
  - Model Run detail reuses the same chip taxonomy as the row metro, then expands it vertically;
  - Compact detail keeps the same compression object visible before `New Context | Old Context` tabs;
  - Config detail keeps the same changed-controls object visible before `Diff Config | New Config | Old Config` tabs;
  - width controls make the list row compress without changing the detail grammar.

## Component Continuity Law

The record list and selected detail are different densities of the same object, not two unrelated views.

Rules:

- `BasicRecordCard` owns the shared top layout: time/duration, identity/meta, status, and a kind-owned body slot.
- `RecordChip` owns message-part semantics and color/icon language. Detail must use the same chip taxonomy as the list, especially for `input`, `thinking`, `tool`, `text`, `pending`, `error`, and `combo`.
- `CardBody` is kind-specific:
  - `model_call`: adaptive metro body in the card; vertical sticky step body in detail.
  - `compact`: compression object in the card; the same compression object remains visible above context tabs in detail.
  - `config`: changed-controls strip in the card; the same changed-controls strip remains visible above YAML tabs in detail.
- Optional detail facts must not back-propagate into list height. If a summary, prompt fragment, YAML line, markdown block, or tool payload needs space, it belongs in detail.
- Mobile-first navigation may change whether detail is a route, sheet, or split pane, but it must not fork the body/chip visual grammar.

## Clutter Budget

Use chips as punctuation, not as data tables.

- The row should read like one sentence at a glance.
- If the header or the line already carries a fact, do not repeat it in a chip.
- Common-case `model_call` rows should stay near `input -> combo -> tail`; wider space may expose one or two more stations, but never a full dump of every part.
- `tool` count only matters when it is plural. A single tool call does not need a count badge.
- Size, token, or byte numbers are detail facts unless they change an operator decision in the list.
- The summary line and the chips must not say the same thing twice.
- `compact` and `config` should remain object cards, not chip collections. Their row surface should emphasize one decisive change and one state, with the rest deferred to detail.

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

Apply should now start from the updated ListDetail visual contract and record-page infrastructure. Before backend implementation, keep the following target facts fixed:

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
  - smallest useful: `start -> combo -> text(end)`
  - next: `start -> combo -> tool -> text(end)`
  - wider: first keep more explicit tail stations, then restore earlier hidden stations
- design-philosophy split for state-mutation records:
  - product-object: reduce to one decisive transformation or one strip of changed controls
  - simulation-surface: expose state channels or gauges for operator inspection
- currently preferred visual directions:
  - `model_call`: adaptive metro graph with tail-first expansion
  - `compact`: product-object compression channel
  - `config`: product-object changed-controls strip
- current detail directions:
  - `model_call` detail: vertical step rail with sticky chips and full right-side step content
  - `compact` detail: `New Context | Old Context` tabs with New Context focused and streaming/error/empty states
  - `config` detail: `Diff Config | New Config | Old Config` YAML tabs with diff first
- component continuity:
  - list and detail reuse `BasicRecordCard`, `RecordChip`, and kind-specific `CardBody`
  - card body is the compressed density; detail body is the expanded density
  - detail must not reimplement unrelated chips, body widgets, color semantics, or status language
