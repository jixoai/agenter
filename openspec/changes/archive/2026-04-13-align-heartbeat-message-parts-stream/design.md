## Context

Heartbeat is currently assembled from three different data planes:

- `scope=heartbeat` rows that actually store chat-flavored wrapper payloads
- `scope=request_aux` rows for `systemPrompt` / `tools` / `config`
- `ai_call` rows projected as model-call cards

WebUI then sorts those projections into one mixed timeline. That is the wrong physics layer. Heartbeat is supposed to show what LoopBus actually fed into or received from the model, and that truth already belongs in `message_part`.

The existing runtime code also has two deeper gaps:

- the heartbeat ledger does not persist raw request/response message parts for each AI-call
- the attention `context + items` protocol is only half-implemented, so focused room work does not surface the expected unresolved item detail in the AI-visible request rows

This change spans `session-system`, `app-server`, `client-sdk`, and `webui`, so it needs a design document before coding.

## Goals / Non-Goals

**Goals:**

- Make Heartbeat read from one durable `message-parts` stream instead of a stitched mixed timeline
- Persist raw AI-visible request and response rows for each AI-call, including streamed assistant updates
- Keep `systemPrompt` / `tools` / `config` as deduplicated durable rows that can be merged into the same Heartbeat stream
- Publish that stream through one paged API plus one realtime event so the client can hydrate and stay live without rebuilding causality in the browser
- Preserve compact boundaries as durable `message-parts`
- Surface focused/background attention work in the AI-visible request rows through the existing `context + items` protocol

**Non-Goals:**

- Redesign the Attention page in this change
- Rebuild the chat route or room transcript model in this change
- Reintroduce old Trace / model-call-card-first Heartbeat inspection
- Add backward-compatibility shims for the old Heartbeat tab contract

## Decisions

### 1. Heartbeat will read from a dedicated merged `message-parts` projection

We will add a backend projection that pages one chronological stream built from:

- `scope=heartbeat_part` request / response / compact rows
- `scope=request_aux` rows for `systemPrompt` / `tools` / `config`

We will not use `prompt_window` rows as the Heartbeat source because those rows are prompt-window snapshots used for restart reconstruction. Heartbeat needs one AI-call-first event stream, not repeated prompt-window snapshots.

Alternatives considered:

- Reuse `prompt_window` as the Heartbeat source: rejected because it duplicates bounded context snapshots and does not map cleanly to live streaming updates.
- Keep merging `chat + request_aux + modelCall` in the client: rejected because it keeps Heartbeat detached from durable truth.

### 2. `scope=heartbeat_part` will store raw AI-visible request/response rows, not chat wrappers

When a model call starts, runtime will persist request messages from `record.request.messages` into dedicated Heartbeat message ids linked to that AI-call. When the assistant streams or finishes, runtime will upsert dedicated response message ids in the same scope and update the same logical rows until `isComplete = true`.

Compact boundaries stay in `scope=heartbeat_part` with `partType=compact`.

Alternatives considered:

- Keep storing chat-shaped wrapper payloads in `scope=heartbeat`: rejected because those rows do not show the actual model-visible payload.
- Store response parts only in `ai_call.responseBody`: rejected because Heartbeat needs streamed part-level durability and pagination without re-parsing provider envelopes.

### 3. AI-call linkage will point at Heartbeat message ids

`ai_call.requestMessageIds` and `ai_call.responseMessageIds` will reference the dedicated Heartbeat message ids for that call. `prompt_window` remains the bounded restart source; `ai_call` linkage becomes the inspection source.

Alternatives considered:

- Keep `requestMessageIds` pointing at `prompt_window` rows: rejected because one call then points at a snapshot store instead of the exact Heartbeat rows it used.

### 4. The existing attention `context + items` protocol will be completed, not replaced

The runtime already has dormant helpers for `Attention Items`. We will finish that path so focused/background attention work emits:

- one bootstrap `context` input
- one `items` input carrying unresolved commit/push facts and score detail

That keeps the existing protocol law intact while satisfying the Heartbeat requirement that the user-visible request side can show `scoreMap`-driven context plus the concrete committed/notified items.

Alternatives considered:

- Stuff all attention detail into the bootstrap context document: rejected because it collapses the `context + items` separation already specified.
- Hide attention item detail only in metadata: rejected because the AI-visible request rows must remain self-explanatory in Heartbeat.

### 5. WebUI Heartbeat will render typed message-part rows, not inspection cards

The Heartbeat tab will switch to one row renderer keyed by message-part meaning:

- `systemPrompt`, `config`, `tools`, `compact`: folded system rows by default
- AI-visible request/response rows: expanded content rows using raw part payloads
- streamed assistant rows: live-update in place

Model-call details can continue to live in Devtools/Settings-oriented inspection surfaces, but they stop being the primary Heartbeat substrate.

Alternatives considered:

- Keep model-call cards inside Heartbeat and add message-parts underneath: rejected because it keeps two competing truths in one stage.

## Risks / Trade-offs

- [Risk] Existing chat-oriented helpers assume `scope=heartbeat` rows are chat wrappers. → Mitigation: introduce dedicated `scope=heartbeat_part` projection types and stop reusing chat projection code for Heartbeat.
- [Risk] Live assistant updates may thrash the frontend if every token becomes a new row. → Mitigation: upsert the same logical response message ids and reuse store merge-by-id semantics.
- [Risk] Completing `Attention Items` may expose payload shapes the model has not seen in real tests yet. → Mitigation: cover the weather / real-AI runtime tests after backend wiring and inspect persisted rows mid-run.
- [Risk] Old Heartbeat story/tests are built around mixed timeline cards. → Mitigation: replace them instead of patching them.

## Migration Plan

1. Add the new spec deltas and implement backend message-part persistence + projection first.
2. Expose the new runtime page API and realtime event in `app-server`.
3. Update `client-sdk` to hydrate and merge the new Heartbeat slice.
4. Replace WebUI Heartbeat rendering with the new stream and remove mixed timeline code.
5. Run contract tests, real-AI verification, and browser walk-through.
6. Archive the change only after durable specs are synced and the old Heartbeat path is removed.

Rollback is intentionally out of scope for this change because the user explicitly chose forward-only refactoring.

## Open Questions

- Whether Heartbeat should eventually expose per-part collapse state persistence in the client store, or keep folding as a pure UI concern.
- Whether follow-up Devtools work should add a separate AI-call inspector route for request/response envelopes once Heartbeat stops rendering model-call cards.
