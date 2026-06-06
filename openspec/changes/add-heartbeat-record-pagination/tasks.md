## 1. Alignment / Recovery

- [x] 1.1 Restore this milestone as the active OpenSpec change `add-heartbeat-record-pagination`; completion condition: the useful plan/spec/canvas artifacts live under `openspec/changes/add-heartbeat-record-pagination` rather than under `openspec/changes/archive/**`.
- [x] 1.2 Retire `ledger` from current product/API/table naming and use `record` / `HeartbeatRecord` / `heartbeat_record`; completion condition: current plan/spec/tasks use `record`, while older `plans/plan-v*.md` files may preserve historical wording.
- [x] 1.3 Preserve `plan.html` and the iframe canvases as the visual design artifacts for this next web-heartbeat-view milestone; completion condition: Model Run Metro, color tokens, Compact/Config, RecordCards, and ListDetail canvases remain available from the active change.
- [x] 1.4 Confirm the source-fact audit before apply: existing grouped Heartbeat pages are query-time projections, `message_part` / `ai_call` are the objective sources, and exact per-part timing may require implementation work; completion condition: this caveat is recorded in `plans/plan.md`.
- [x] 1.5 Record that backend/API work is possible only inside the existing runtime capability boundary and still requires explicit user discussion if the implementation needs a new backend endpoint or materially reshaped API response; completion condition: tasks do not silently authorize unrelated backend shape changes.

## 2. Design Contract

- [x] 2.1 Write the Heartbeat Record pagination specs for a materialized, countable `heartbeat_record` projection and source-ref-backed detail.
- [x] 2.2 Write the web-heartbeat-view specs for paged record resources, kind-specific RecordCard grammars, and kind-specific detail surfaces.
- [x] 2.3 Write the runtime publication specs for exact record pages, fixed/latest anchor state, selected record detail, and explicit resource states.
- [x] 2.4 Write the workspace runtime shell specs for paged Heartbeat list/detail behavior and separate scroll ownership.
- [x] 2.5 Capture the current visual contract in HTML: data-driven Model Run Metro chips, Compact compression cards, Config changed-controls cards, and ListDetail detail rails.

## 3. BDD Contract To Implement

- [x] 3.1 Scenario: Given mixed `message_part`, `ai_call`, compact, and config facts When the `heartbeat_record` projection runs Then exact record count, ordering, kind, timestamps, preview, and source refs are deterministic and traceable.
- [x] 3.2 Scenario: Given a `tool_result` followed by a new user-visible input boundary When record classification runs Then the previous `model_call` record closes and the next `model_call` record starts objectively.
- [x] 3.3 Scenario: Given latest and fixed page-window anchors When newer records arrive Then latest windows advance, fixed windows stay pinned, and `newRecordsAvailable` becomes visible without scroll theft.
- [x] 3.4 Scenario: Given large markdown, reasoning, JSON, and tool payloads When a record page renders Then list rows stay bounded and selected detail reconstructs the full structured content separately.
- [x] 3.5 Scenario: Given multiple viewport widths on mobile and desktop When `model_call`, `compact`, and `config` rows render Then the adaptive metro card computes `inputChip + line + chip` layout from data, merges tool results back into tool chips, expands tail-first without overflow, and the non-model cards keep their own grammars.
- [x] 3.6 Scenario: Given `readonly` and `configable` modes When bottom toolbar actions and detail flows render Then unauthorized mutation paths stay hidden or disabled while inspection remains intact.
- [x] 3.7 Scenario: Given a selected `model_call` record When detail opens Then the horizontal metro semantics expand into vertical sticky step chips plus full right-side step content without changing list-page membership.
- [x] 3.8 Scenario: Given a selected `compact` record When detail opens Then `New Context | Old Context` tabs render with `New Context` focused, including streaming, empty, and error states in the tab content.
- [x] 3.9 Scenario: Given a selected `config` record When detail opens Then `Diff Config | New Config | Old Config` tabs render YAML diff first and YAML source views for new/old config.

## 4. Implementation

- [x] 4.1 Run `bun run openspec:vision -- validate add-heartbeat-record-pagination` and `bun run openspec:vision -- commit-check add-heartbeat-record-pagination --phase apply` before app-code work starts.
- [x] 4.2 Implement the `heartbeat_record` projection, migration, indexes, classifier rules, summary payload, and source-ref law in `session.db` without replacing underlying objective source facts.
- [x] 4.3 Implement runtime publication for exact record count, page windows, latest/fixed anchor state, selected detail, and `newRecordsAvailable` invalidation.
- [x] 4.4 Keep grouped/message-part reconstruction as the selected-record detail evidence path; stop using query-time regrouping as the primary list-page source once record resources are available.
- [x] 4.5 Implement package-owned record list/detail presentation in `@agenter/web-heartbeat-view`, including a data-driven `ModelRunCard` with chip-fit math, input-chip derivation, line-duration law, compression-style `compact` cards, changed-controls `config` cards, and mobile-first list/detail navigation.
- [x] 4.6 Implement selected-record detail components for `model_call`, `compact`, and `config`: vertical sticky-step Model Run detail, Compact `New Context | Old Context` tabs, and Config YAML `Diff | New | Old` tabs.
- [x] 4.7 Integrate the new record/list/detail contract into `@agenter/web-heartbeat-view:example`, including page-window controls and selected-detail behavior.
- [ ] 4.8 Decide with the user before touching Studio migration; completion condition: Studio files are not rebound to the new record contract unless that work is explicitly authorized.
- [x] 4.9 Add concise intent comments at critical effect points derived from `plans/plan.md`, especially around record classification, anchor invalidation, and detail reconstruction boundaries.
- [x] 4.10 Update only the task checkboxes completed in the current working context, and pair those checkbox updates with matching implementation or BDD evidence commits.

## 5. Verification

- [x] 5.1 Run targeted backend, runtime-store, and package tests for record projection, anchor behavior, and selected-detail reconstruction.
- [x] 5.2 Run package-level DOM tests covering bounded rows, adaptive card grammars, selected-detail surfaces, preview omission, and readonly/configable action states.
- [x] 5.3 Start `@agenter/web-heartbeat-view:example`, then verify mobile and desktop list/detail behavior, no horizontal overflow, latest/fixed page anchors, Model Run detail steps, Compact tabs, and Config YAML tabs with real browser evidence.
- [x] 5.4 Run `bun run openspec:vision -- validate add-heartbeat-record-pagination`.
- [x] 5.5 Run `bun run openspec:vision -- commit-check add-heartbeat-record-pagination --phase self-review` before writing final review evidence.

## 6. Self-Review / Archive

- [x] 6.1 Generate `review/self-review.md` comparing implementation against `plans/plan.md`, specs, tasks, and browser evidence.
- [x] 6.2 Generate `review/self-review.html` as the screenshot and interaction evidence pack for mobile list, mobile detail, desktop list/detail, anchor states, and compact/config cards.
- [x] 6.3 If self-review changes OpenSpec artifacts or reopens tasks, commit those artifact updates before the next apply loop.
- [ ] 6.4 If the review enters a real recurrence loop, run `bun run openspec:vision -- review-state add-heartbeat-record-pagination` to persist iteration state.
- [ ] 6.5 If review cannot exit normally, run `bun run openspec:vision -- handoff add-heartbeat-record-pagination` and commit the handoff evidence before returning to user discussion.
- [ ] 6.6 Archive only after implementation, verification, and user acceptance; completion condition: archive result is committed in a dedicated final docs/spec commit.
- [ ] 6.7 Run `bun run openspec:vision -- check add-heartbeat-record-pagination` before archive or before an abnormal exit.
