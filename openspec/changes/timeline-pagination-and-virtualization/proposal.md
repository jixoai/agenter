## Why

Session histories can span years. The current WebUI and API still assume small, id-based lists, which makes Chat, Cycles, LoopBus, Model, and Terminal activity fragile once history becomes large. We need one backend paging contract and one front-end rendering model for reverse-time timelines.

## What Changes

- Add a generic reverse-time paging contract for long session histories using explicit time cursors instead of resource-specific `beforeId` APIs.
- Refactor session persistence and TRPC routes so chat messages, chat cycles, LoopBus traces/state logs, model calls, API calls, and terminal activity all paginate by time.
- Persist LoopBus state-log history and add a terminal-activity timeline query so Devtools no longer reconstructs large histories on the client.
- Update the client runtime store and WebUI surfaces to hydrate only recent windows, prepend older pages on demand, and virtualize long lists.
- Add regression coverage for time-based pagination, stable prepend behavior, and long-list rendering states.

## Capabilities

### New Capabilities
- `session-history-pagination`: Generic reverse-time paging contract for long-lived session facts.

### Modified Capabilities
- `client-runtime-store`: Runtime store paging state moves from id-only cursors to explicit reverse-time cursors.
- `chat-cycles`: Chat cycle history remains current-branch scoped but pages by reverse time.
- `chat-surface-presentation`: Chat history always renders through a virtualized long-session viewport.
- `cycles-devtools-timeline`: Cycle timelines load incrementally instead of requiring the full history in memory.
- `terminal-activity-inspector`: Terminal activity becomes a paged server-backed timeline instead of a client-side scan of all cycles.
- `workspace-devtools-surface`: LoopBus, Terminal, and Model panels consume shared long-list paging and loading states.

## Impact

- Affected code: `packages/session-system`, `packages/app-server`, `packages/client-sdk`, `packages/webui`.
- Affected behavior: long-list querying, runtime hydration, terminal activity inspection, Devtools history browsing, and chat transcript rendering.
- No backward-compatibility layer is retained for the old id-based session history APIs.
