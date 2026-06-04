## 1. Alignment / Investigation

- [x] 1.1 Confirm the latest `plans/plan.md`, `plan.html`, and iframe canvases still match the intended `record` terminology, list/detail law, card grammar, and design-component boundaries before apply starts.
- [x] 1.2 Confirm the current `session.db` Heartbeat source facts and grouped query paths that will feed `heartbeat_record`, and record any mismatch between planned record boundaries and real persisted facts before migration work starts.
- [x] 1.3 Confirm with the user before apply if implementation would require a new backend endpoint or a materially reshaped backend response beyond the existing runtime capability boundary; do not assume that change without discussion.
- [x] 1.4 Decide whether the change id itself should remain `add-heartbeat-ledger-pagination` for history or be renamed to `add-heartbeat-record-pagination`; record the decision before archive.

## 2. BDD Contract

- [ ] 2.1 Scenario: Given mixed `message_part`, `ai_call`, compact, and config facts When the `heartbeat_record` projection runs Then exact record count, ordering, kind, timestamps, preview, and source refs are deterministic and traceable.
- [ ] 2.2 Scenario: Given a `tool_result` followed by a new user-visible input boundary When record classification runs Then the previous `model_call` record closes and the next `model_call` record starts objectively.
- [ ] 2.3 Scenario: Given latest and fixed page-window anchors When newer records arrive Then latest windows advance, fixed windows stay pinned, and `newRecordsAvailable` becomes visible without scroll theft.
- [ ] 2.4 Scenario: Given large markdown, reasoning, JSON, and tool payloads When a record page renders Then list rows stay bounded and selected detail reconstructs the full structured content separately.
- [ ] 2.5 Scenario: Given multiple viewport widths on mobile and desktop When `model_call`, `compact`, and `config` rows render Then the adaptive metro card computes `inputChip + line + chip` layout from data, merges tool results back into tool chips, expands tail-first without overflow, and the non-model cards keep their own grammars.
- [ ] 2.6 Scenario: Given `readonly` and `configable` modes When bottom toolbar actions and detail flows render Then unauthorized mutation paths stay hidden or disabled while inspection remains intact.
- [ ] 2.7 Scenario: Given a selected `model_call` record When detail opens Then the horizontal metro semantics expand into vertical sticky step chips plus full right-side step content without changing list-page membership.
- [ ] 2.8 Scenario: Given a selected `compact` record When detail opens Then `New Context | Old Context` tabs render with `New Context` focused, including streaming, empty, and error states in the tab content.
- [ ] 2.9 Scenario: Given a selected `config` record When detail opens Then `Diff Config | New Config | Old Config` tabs render YAML diff first and YAML source views for new/old config.
- [x] 2.10 Confirm each task checkbox will be updated only by the agent that completed and verified that task in the current working context.

## 3. Implementation

- [ ] 3.1 Run `bun run openspec:vision -- commit-check add-heartbeat-ledger-pagination --phase apply` before app-code work starts, then commit the ready OpenSpec artifacts for this change.
- [ ] 3.2 Implement the `heartbeat_record` projection, migration, indexes, classifier rules, summary payload, and source-ref law in `session.db` without replacing underlying objective source facts.
- [ ] 3.3 Implement runtime publication for exact record count, page windows, latest/fixed anchor state, selected detail, and `newRecordsAvailable` invalidation.
- [ ] 3.4 Keep grouped/message-part reconstruction only as the selected-record detail evidence path; stop using query-time regrouping as the primary list-page source.
- [ ] 3.5 Implement package-owned record list/detail presentation in `@agenter/web-heartbeat-view`, including a data-driven `ModelRunCard` with chip-fit math, input-chip derivation, line-duration law, compression-style `compact` cards, changed-controls `config` cards, and mobile-first list/detail navigation.
- [ ] 3.6 Implement selected-record detail components for `model_call`, `compact`, and `config`: vertical sticky-step Model Run detail, Compact `New Context | Old Context` tabs, and Config YAML `Diff | New | Old` tabs.
- [ ] 3.7 Integrate the new record/list/detail contract into the relevant runtime shell consumer and `@agenter/web-heartbeat-view:example`, including page-window controls and selected-detail behavior.
- [ ] 3.8 Add concise intent comments at critical effect points derived from `plans/plan.md`, especially around record classification, anchor invalidation, and detail reconstruction boundaries.
- [ ] 3.9 Update only the task checkboxes completed in the current working context, and pair those checkbox updates with the matching implementation or BDD evidence commits.

## 4. Verification

- [ ] 4.1 Run targeted backend, runtime-store, and package tests for record projection, anchor behavior, and selected-detail reconstruction.
- [ ] 4.2 Run Storybook DOM or equivalent package-level UI tests covering bounded rows, adaptive card grammars, selected-detail surfaces, preview omission, and readonly/configable action states.
- [ ] 4.3 Start `@agenter/web-heartbeat-view:example`, then verify mobile and desktop list/detail behavior, no horizontal overflow, latest/fixed page anchors, Model Run detail steps, Compact tabs, and Config YAML tabs with real browser evidence.
- [ ] 4.4 Run `bun run openspec:vision -- validate add-heartbeat-ledger-pagination`.
- [ ] 4.5 Run `bun run openspec:vision -- commit-check add-heartbeat-ledger-pagination --phase self-review` before writing final review evidence.

## 5. Self-Review Loop

- [ ] 5.1 Generate `review/self-review.md` as the macro review record comparing implementation against `plans/plan.md` and the new record-pagination specs.
- [ ] 5.2 Generate `review/self-review.html` as the screenshot and interaction evidence pack for mobile list, mobile detail, desktop list/detail, anchor states, and compact/config cards.
- [ ] 5.3 If self-review changes OpenSpec artifacts or reopens tasks, commit those artifact updates before the next apply loop.
- [ ] 5.4 If the review enters a real recurrence loop, run `bun run openspec:vision -- review-state add-heartbeat-ledger-pagination` to persist iteration state.
- [ ] 5.5 If review cannot exit normally, run `bun run openspec:vision -- handoff add-heartbeat-ledger-pagination` and commit the handoff evidence before returning to user discussion.
- [ ] 5.6 If review exits normally, run `openspec archive add-heartbeat-ledger-pagination` and commit the archive result.
- [ ] 5.7 Run `bun run openspec:vision -- check add-heartbeat-ledger-pagination` and decide whether to exit or return to `research-plan` with a backed-up plan revision.
