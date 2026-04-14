## 1. Spec sync

- [ ] 1.1 Add OpenSpec deltas that move Heartbeat tool lifecycle to invocation-first durable rows.
- [ ] 1.2 Record the remaining out-of-scope debts so this change stays narrowly about invocation persistence.

## 2. Backend persistence

- [ ] 2.1 Add canonical Heartbeat message-id builders and upsert helpers for invocation rows.
- [ ] 2.2 Persist `tool_call` immediately on model decision and update the same row as args hydrate.
- [ ] 2.3 Append `tool_result` onto the same invocation row when local execution completes.
- [ ] 2.4 Remove tool lifecycle parts from the synthetic assistant response Heartbeat row.

## 3. Projection and UI consumption

- [ ] 3.1 Ensure Heartbeat paging/live publication keeps one stable invocation row before and after completion.
- [ ] 3.2 Keep the WebUI tool block in running state until durable `tool_result` arrives and show params as soon as the invocation row has them.

## 4. Regression and verification

- [ ] 4.1 Add/update backend and WebUI tests for running invocation visibility, hydration-in-place, and completion-in-place.
- [ ] 4.2 Run focused verification and a real runtime check, then commit the change.
