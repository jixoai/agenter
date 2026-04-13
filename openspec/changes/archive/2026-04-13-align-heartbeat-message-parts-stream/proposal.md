## Why

The current Heartbeat surface is built from three separate projections (`chat`, `request_aux`, `modelCall`) and then stitched back together in WebUI. That breaks the platform law: Heartbeat should show the exact `message-parts` that LoopBus feeds into or receives from the model, not a mixed inspection timeline reconstructed after the fact.

We need to correct this now because Heartbeat is the primary runtime surface. As long as it keeps projecting the wrong truth, backend persistence, frontend binding, real-AI debugging, and browser validation will all continue to drift away from the actual LoopBus work.

## What Changes

- **BREAKING** Replace the current Heartbeat contract with a unified `message-parts` stream backed by `session.db`.
- Persist Heartbeat request/response rows as raw AI-visible `message_parts`, including streamed assistant updates, compact boundaries, and deduplicated request-side auxiliary rows.
- Expose a new runtime Heartbeat page API plus realtime publication for `message-parts`, so the client no longer merges `chat`, `request_aux`, and `modelCall` timelines.
- Rebuild the WebUI Heartbeat tab to render raw `message-parts` directly, with collapsed `systemPrompt` / `config` / `tools` / `compact` rows and expandable AI-visible message rows.
- Remove the old mixed-timeline Heartbeat assembly code and its model-call/request-aux-specific rendering assumptions from the primary Heartbeat surface.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `session-ai-call-ledger`: Heartbeat persistence and inspection now revolve around raw AI-visible `message-parts`, including streamed response parts and unified Heartbeat projection rows.
- `runtime-ui-publication`: Runtime publication must hydrate and stream one Heartbeat `message-parts` slice instead of three independent inspection slices.
- `workspace-runtime-shell`: The `Heartbeat` tab must render the durable `message-parts` stream as its primary runtime surface instead of the old mixed inspection timeline.

## Impact

- Affected backend packages: `packages/session-system`, `packages/app-server`
- Affected client/UI packages: `packages/client-sdk`, `packages/webui`
- Affected tests: session ledger tests, runtime store contract tests, Heartbeat UI stories/tests, browser/API verification
- Breaking runtime API/UI contract: existing `requestAux + modelCalls + heartbeat chat` composition is replaced for the Heartbeat tab
