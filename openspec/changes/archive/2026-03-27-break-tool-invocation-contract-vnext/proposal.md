## Why

Tool lifecycle data is still modeled as two markdown payload messages (`tool_call` + `tool_result`) and then re-paired in the UI. This keeps parsing heuristics and duplicated rendering paths alive.

## What Changes

- Replace dual tool channels with one structured `tool` channel carrying invocation state.
- Upgrade persisted tool metadata from `{name, ok}` to a full invocation object.
- Remove markdown-fence parsing as the source of truth for tool lifecycle in technical panels.
- Keep Chat conversation flow user-facing only; technical tool lifecycle remains in Devtools/Terminal panels.

## Impact

- Breaking schema change for runtime/session block `channel` and tool payload shape.
- Devtools and terminal activity use one canonical invocation structure and status lifecycle.
- Legacy test fixtures and stories migrate to structured invocation records.
