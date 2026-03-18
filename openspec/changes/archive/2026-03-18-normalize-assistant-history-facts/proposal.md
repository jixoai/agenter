## Why

`AgenterAI` currently rewrites one assistant turn into a synthetic Markdown replay with headings like `### Replies` and `### Notes`. That breaks the “give facts, not interpretation” rule, pollutes model history with invented structure, and diverges from the real assistant message stream already shown in chat.

## What Changes

- Replace synthetic assistant-history section stitching with a single fact-stream builder that preserves real assistant message order.
- Persist assistant history as multiple assistant model messages instead of one combined Markdown blob.
- Keep tool calls and tool results as original fenced YAML payloads (`yaml+tool_call` / `yaml+tool_result`) in history replay.
- Remove obsolete runtime text/i18n keys for `assistant.history.replies`, `assistant.history.notes`, and `assistant.history.tools`.
- Update BDD tests to assert factual replay ordering and the absence of synthetic section headings.

## Capabilities

### New Capabilities

- `assistant-history-facts`: Assistant history replay stays aligned with the factual assistant message stream without adding synthetic headings or summaries.

### Modified Capabilities

## Impact

- Affected code: `packages/app-server/src/agenter-ai.ts`
- Affected tests: `packages/app-server/test/agenter-ai.test.ts`
- Affected i18n/runtime text: `packages/i18n-core/src/runtime-text.ts`, `packages/i18n-en/runtime.json`, `packages/i18n-zh-Hans/runtime.json`
