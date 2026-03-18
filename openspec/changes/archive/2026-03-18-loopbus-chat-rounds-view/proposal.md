## Why

The chat UI still renders a flat message stream, so users cannot see which inputs and outputs belong to the same LoopBus round. This makes compact cycles, optimistic sends, and live model output hard to understand, and it hides the round structure that the runtime already produces.

## What Changes

- Add a round-oriented chat projection that groups collected inputs and assistant outputs by `session_cycle`.
- Expose round history and round paging through app-server and client-sdk APIs, while preserving live streaming updates for the current round.
- Update WebUI chat to render round cards plus a custom cycle rail instead of a seamless message list.
- Keep raw chat messages as fact records for other panels, but make the main chat surface consume round timeline data.

## Capabilities

### New Capabilities
- `chat-rounds-view`: Present chat history as LoopBus rounds, including collected inputs, streamed outputs, round kind, and round paging.

### Modified Capabilities
- None.

## Impact

- Affected packages: `@agenter/session-system`, `@agenter/app-server`, `@agenter/client-sdk`, `@agenter/webui`
- Affected APIs: realtime runtime events, TRPC chat queries, runtime store projections
- Affected UX: Chat panel rendering, cycle navigation, optimistic send feedback, live assistant streaming
