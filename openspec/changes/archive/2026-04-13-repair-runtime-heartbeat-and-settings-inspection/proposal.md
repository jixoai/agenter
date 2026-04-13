## Why

The current runtime shell still misses the two inspection surfaces the architecture expects:

- `Heartbeat` currently renders a narrow chat-style projection, so operators cannot objectively inspect how the AI call actually progressed, what config/tool context was used, or what tool activity happened during the run.
- `Settings` currently regressed into a single-file editor, even though the platform already has scoped settings graph and provenance capabilities for effective values, source layers, and jump-to-layer inspection.

This creates a false sense of completion: the shell no longer looks blank on first load, but it still does not provide the inspection depth needed to evaluate runtime behavior objectively.

## What Changes

- Repair `Heartbeat` so it becomes a real inspection surface backed by durable runtime facts instead of only a flattened chat projection.
- Restore runtime `Settings` to a provenance/layer view built from scoped settings graph contracts, keyed by the active runtime's workspace scope plus avatar scope.
- Add the missing contract needed for Heartbeat inspection to read request-side auxiliary ledger facts (`systemPrompt`, `tools`, `config`) alongside model-call and heartbeat rows.
- Keep Heartbeat and Settings orthogonal:
  - Heartbeat explains how the runtime worked.
  - Settings explains where runtime-effective configuration came from.

## Capabilities

### Modified Capabilities
- `workspace-runtime-shell`
- `session-ai-call-ledger`

## Impact

- Affected code:
  - `packages/app-server`
  - `packages/client-sdk`
  - `packages/webui`
- Affected APIs:
  - runtime inspection pagination
  - scoped runtime settings loading/saving
- Affected UI:
  - `Heartbeat`
  - `Settings`

