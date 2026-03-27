## Why

Tool call data is currently rendered with multiple ad-hoc components (`AssistantMarkdown` tool blocks, panel-local cards, model/tool dumps). This causes inconsistent status semantics, duplicated parsing logic, and unnecessary UI drift. We need one canonical technical visualization for tool invocation lifecycle.

## What Changes

- Add a unified `ToolInvocationCard` rendering contract for technical surfaces.
- Normalize tool lifecycle records into one view model (`call`, `status`, optional `result`, optional `error`).
- Reuse `JSONViewer` for call/result payload visualization with YAML-first default.
- Remove panel-specific tool-rendering duplication in Devtools, Terminal Activity, and Model inspection surfaces.
- Normalize legacy terminal activity yaml tool fences into the same invocation card contract.
- Hide empty call payloads (for example `""`) instead of rendering meaningless blank JSON blocks.
- Keep Chat transcript out of this contract (Chat remains message-first, not tooling-first).

## Capabilities

### New Capabilities
- `tool-invocation-surface`: one reusable technical card with explicit lifecycle states.

### Modified Capabilities
- `workspace-devtools-surface`: cycle/tool evidence uses shared invocation cards.
- `terminal-activity-inspector`: tool-related terminal activity uses shared invocation cards.
- `structured-value-preview`: YAML-first preview is reused by invocation payload sections.

## Impact

- Affected code: `packages/webui` (shared component + panel adapters), optional normalization helpers in `packages/client-sdk`/`packages/app-server`.
- Verification: Storybook DOM coverage for invocation states and panel-level regression checks.
