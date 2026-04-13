## 1. Backend Ledger

- [x] 1.1 Persist raw Heartbeat request/response message-parts for each AI-call, including streamed assistant updates and compact boundaries
- [x] 1.2 Link `ai_call.requestMessageIds` / `responseMessageIds` to the new Heartbeat rows and keep `request_aux` deduplication intact
- [x] 1.3 Add backend tests for Heartbeat message-parts persistence, pagination, and streamed upserts

## 2. Runtime Publication

- [x] 2.1 Add a unified runtime Heartbeat page API and realtime event for message-parts rows
- [x] 2.2 Update `client-sdk` to hydrate, merge, paginate, and live-update one Heartbeat slice instead of mixing chat/request-aux/model-call slices
- [x] 2.3 Add client contract tests for Heartbeat hydration, load-more, and streamed row replacement

## 3. WebUI Heartbeat

- [x] 3.1 Replace the mixed Heartbeat timeline UI with a message-parts stream renderer and remove obsolete model-call/request-aux timeline assembly
- [x] 3.2 Render folded `systemPrompt` / `config` / `tools` / `compact` rows plus expandable AI-visible message rows
- [x] 3.3 Add WebUI stories/tests for empty state, folded auxiliary rows, compact boundaries, and live assistant updates

## 4. Verification

- [x] 4.1 Run targeted backend and client tests for the new Heartbeat contract
- [x] 4.2 Verify the runtime API and browser behavior with a real room-driven Heartbeat flow on desktop and mobile
- [x] 4.3 Sync durable specs if implementation reveals further contract changes, then commit and prepare the change for archive
