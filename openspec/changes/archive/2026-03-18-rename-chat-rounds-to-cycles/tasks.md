## 1. Server contract rename

- [x] 1.1 Rename app-server chat projection types/helpers from `ChatRound*` to `ChatCycle*` and update session-runtime snapshot/event payloads to `activeCycle` / `cycleUpdated`.
- [x] 1.2 Replace TRPC chat procedures and realtime event names from `round` to `cycle`, keeping paging and ordering behavior unchanged.

## 2. Client projection rename

- [x] 2.1 Rename client-sdk types, runtime state fields, paging methods, and merge helpers from `round` to `cycle`.
- [x] 2.2 Update runtime event handling so optimistic, live, and persisted cycle projections still merge correctly.

## 3. UI consumer and regression coverage

- [x] 3.1 Rename WebUI chat props/helpers/tests/stories to cycle-first terminology and remove remaining chat-facing `round` text.
- [x] 3.2 Verify the rename through app-server, client-sdk, WebUI unit tests, and Storybook DOM tests.
