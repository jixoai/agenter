## Overview

Adopt a single invocation fact model:

- `channel: "tool"`
- `tool: { invocationId, name, status, startedAt, finishedAt?, call?, result?, error? }`

The model is written once and consumed directly by Devtools/Terminal renderers.

## Data Flow

1. Model stream emits `tool_call` / `tool_result` events.
2. Session runtime upserts one live tool message (`channel: tool`) keyed by `toolCallId`.
3. Final assistant facts persist one tool output record with final invocation state.
4. Session DB stores the same structured tool object on blocks/activity rows.
5. WebUI renders invocation cards from structured fields without markdown pairing/parsing.

## Breaking Decisions

- Remove `tool_call` and `tool_result` from `SessionBlockChannel` and `ChatMessage.channel`.
- Remove `ok`-only tool metadata contract.
- Keep markdown content as optional display text only, not a lifecycle data source.

## Failure/Edge Handling

- If stream emits a call but no result before abort/stop, runtime closes live invocation as `cancelled`.
- `failed` status is driven by explicit tool error; no inferred fallback from markdown text.
