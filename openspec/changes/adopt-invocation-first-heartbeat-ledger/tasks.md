## 1. Spec sync

- [x] 1.1 Add OpenSpec deltas that move Heartbeat tool lifecycle to invocation-first durable rows.
- [x] 1.2 Record the remaining out-of-scope debts so this change stays narrowly about invocation persistence.

## 2. Backend persistence

- [x] 2.1 Add canonical Heartbeat message-id builders and upsert helpers for invocation rows.
- [x] 2.2 Persist `tool_call` immediately on model decision and update the same row as args hydrate.
- [x] 2.3 Append `tool_result` onto the same invocation row when local execution completes.
- [x] 2.4 Remove tool lifecycle parts from the synthetic assistant response Heartbeat row.
- [x] 2.5 Reconcile final `ai_call` persistence so completion cannot split invocation rows or drop their linkage.

## 3. Projection and UI consumption

- [x] 3.1 Ensure Heartbeat paging/live publication keeps one stable invocation row before and after completion.
- [x] 3.2 Keep the WebUI tool block in running state until durable `tool_result` arrives and show params as soon as the invocation row has them.
- [x] 3.3 Ensure cold restore and completed-call projection preserve the same invocation row with both params and result.

## 4. Regression and verification

- [x] 4.1 Add/update backend and WebUI tests for running invocation visibility, hydration-in-place, and completion-in-place.
- [x] 4.2 Run focused verification and a real runtime check, then commit the change.
- [x] 4.3 Reproduce the completion path via CLI and verify the same invocation row survives through restart.

## 5. Group projection and grouped UI consumption

- [x] 5.1 Add a query-time Heartbeat group projection over durable `message_part / ai_call / request_aux` facts.
- [x] 5.2 Add `runtime.heartbeatGroupsPage` and switch runtime-store hydration/loading to groups instead of raw part streams.
- [x] 5.3 Render Heartbeat in the WebUI by shared group headers plus grouped rows, while keeping realtime `runtime.heartbeatPart` as invalidation only.

## 6. Streaming thinking and next-call config controls

- [x] 6.1 Persist streaming assistant `thinking` as a durable Heartbeat part on the assistant response row.
- [x] 6.2 Reload runtime settings after Settings saves and persist changed config as trailing `request_aux:config:*` facts.
- [x] 6.3 Surface Heartbeat next-call config controls and top-of-stream older-page affordances in the grouped WebUI.
