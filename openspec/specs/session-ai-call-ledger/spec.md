## Purpose

Define the minimal session durable ledger around grouped AI-visible message parts and bounded AI-call envelopes.
## Requirements

### Requirement: Session DB SHALL persist AI-visible traffic as grouped message parts

The session durable store SHALL persist AI-visible request and response traffic in a `message_parts` ledger. Each row SHALL belong to one logical `message_id`, SHALL record append order, role, part type, timestamps, completion state, and serialized part payload, and SHALL support streamed updates to the same logical part until it is complete. Compact cycles SHALL also persist a dedicated `scope=heartbeat_part` boundary message with `partType=compact` so Heartbeat can reconstruct prompt-window restart boundaries from durable facts.

#### Scenario: Streamed assistant text updates one logical part
- **WHEN** an assistant response streams text into an existing logical message
- **THEN** the runtime creates or updates the corresponding `message_parts` row instead of creating a new ad-hoc transcript table row for every delta
- **THEN** the row becomes `is_complete = true` only after the streamed part finishes

#### Scenario: One logical message contains multiple durable parts
- **WHEN** one request or response message contains multiple provider parts
- **THEN** those parts are stored as separate `message_parts` rows sharing the same `message_id`
- **THEN** later reconstruction can recover the logical message by grouping rows on `message_id`

#### Scenario: Compact cycle persists a heartbeat boundary fact
- **WHEN** a compact cycle completes and rotates the bounded prompt-window round
- **THEN** the runtime appends a `scope=heartbeat_part`, `role=system`, `partType=compact` message-part record linked to that compact AI-call
- **THEN** later Heartbeat reconstruction can show the compaction boundary without inferring it from assistant prose or cycle UI state

#### Scenario: AI-call links point at durable Heartbeat rows
- **WHEN** the runtime persists an AI-call request or response
- **THEN** `requestMessageIds` reference the durable Heartbeat request message ids for that call
- **THEN** `responseMessageIds` reference the durable Heartbeat response message ids for that call
- **THEN** `auxiliaryMessageIds` reference the deduplicated `scope=request_aux` rows used by that call

### Requirement: Request-side auxiliary model payloads SHALL remain inspectable as durable ledger facts

Request-side payloads that are siblings of `messages` in the model request body, including `systemPrompt`, `tools`, and `config`, SHALL remain queryable through runtime inspection contracts in addition to being persisted in `message_parts`.

#### Scenario: Runtime inspection pages request auxiliary rows

- **WHEN** a runtime inspection client pages request-side auxiliary facts for one session
- **THEN** it receives durable rows derived from `scope=request_aux`
- **AND** each row preserves `partType`, payload, timestamps, round identity, and related model-call identity
- **AND** the projection does not require the client to open `session.db` directly

### Requirement: Empty prompt-window bootstrap state SHALL persist as a durable ledger fact

When a session initializes its current prompt window with zero prompt messages, the durable ledger SHALL still contain an explicit prompt-window state fact instead of relying only on `session_head.current_prompt_window_id`.

#### Scenario: Fresh session writes an empty prompt-window fact
- **WHEN** a runtime starts and initializes the current prompt window before any user or assistant prompt messages exist
- **THEN** `session.db` contains at least one `scope=prompt_window` ledger row for that prompt-window id
- **THEN** durable inspection can resolve the current prompt-window id without depending on an out-of-band convention that “missing rows means empty”

#### Scenario: Empty prompt-window restoration returns zero prompt messages
- **WHEN** durable inspection reads a prompt-window id whose only persisted row is the bootstrap state fact
- **THEN** the reconstructed prompt-window record returns `messages = []`
- **THEN** no synthetic system/user prompt message is injected into the restored prompt window

#### Scenario: Bootstrap state does not pollute request message linkage
- **WHEN** the runtime records a later AI-call that uses a prompt window previously initialized as empty
- **THEN** the AI-call request message id list excludes the bootstrap-only prompt-window state row
- **THEN** request linkage continues to point only at real prompt messages that were part of the provider-visible `messages` array

### Requirement: Session DB SHALL persist each model invocation as one AI-call ledger row

The session durable store SHALL persist every model invocation as one `ai_call` row containing request URL, request body, response body, lifecycle timestamps, completion state, and the bounded round index used for retention.

#### Scenario: Model request creates a running AI-call row
- **WHEN** the runtime starts a provider request
- **THEN** it creates one `ai_call` row with the request URL, request body, `created_at`, `updated_at`, and an incomplete lifecycle state
- **THEN** persisted inspection can observe that call before the final response arrives

#### Scenario: Streaming response updates the same AI-call row
- **WHEN** the provider streams partial response data
- **THEN** the runtime updates the same `ai_call` row in place with the latest `response_body`
- **THEN** the row is marked complete only when the provider stream or terminal outcome finishes

#### Scenario: Continuation request body records committed interleaved projection
- **WHEN** a provider loop appends committed attention projection at a tool-result continuation boundary
- **THEN** the final `ai_call.requestBody.messages` reflects the provider-visible continuation messages
- **AND** the runtime does not preserve the earlier running request snapshot as the completed request body
- **AND** scheduling, source-drain, read-ack, and trace facts remain outside the provider HTTP body except for explicit runtime metadata fields

### Requirement: AI-call retention SHALL keep only the current and previous prompt-window rounds

The `ai_call` ledger SHALL retain only the current prompt-window round and the immediately previous round. Older `ai_call` rows SHALL be pruned when compaction rotates the bounded prompt-window memory.

#### Scenario: Compaction rotates retained AI-call rounds
- **WHEN** compaction produces a new bounded prompt-window seed
- **THEN** the previous current round becomes the retained previous round
- **THEN** a fresh current round begins for later `ai_call` rows
- **THEN** any `ai_call` rows older than the retained previous round are deleted

#### Scenario: Non-compacting calls stay in the current retained round
- **WHEN** the runtime performs ordinary attention-processing calls without triggering compaction
- **THEN** those `ai_call` rows stay assigned to the same current round index
- **THEN** retention does not rotate until a compaction boundary occurs

### Requirement: Cold restart reconstruction SHALL read the AI-call ledger instead of legacy cycle tables

Stopped-session reconstruction SHALL use `message_parts`, retained `ai_call` rows, and persisted attention facts as the durable sources of truth. It SHALL NOT require `session_cycle`, `prompt_window_state`, `model_call`, or trace tables to restore runtime context.

#### Scenario: Restart rebuilds from ledger facts
- **WHEN** a stopped session starts again after the process has lost in-memory state
- **THEN** the runtime rebuilds its bounded model context from `message_parts` plus retained `ai_call` rows
- **THEN** restart does not depend on any legacy cycle or prompt-window table being present

### Requirement: Heartbeat inspection SHALL page one merged message-parts stream

Runtime inspection SHALL expose one paged Heartbeat stream composed from durable `message_parts` rows instead of requiring the client to query chat rows, request-side auxiliary rows, and model-call rows separately.

#### Scenario: Heartbeat page excludes legacy wrapper scope

- **WHEN** a runtime inspection client pages Heartbeat rows for one session
- **THEN** it receives one chronological stream containing only `scope=heartbeat_part` rows and deduplicated `scope=request_aux` rows
- **AND** `scope=heartbeat` is not a valid Heartbeat durable source anymore
- **AND** the client does not need legacy wrapper-row compatibility logic to reconstruct Heartbeat

### Requirement: Heartbeat tool lifecycle SHALL persist as invocation-first ledger rows

Runtime persistence SHALL treat each tool invocation as a stable Heartbeat message keyed by `aiCallId + invocationId`, instead of rebuilding tool visibility from a synthetic assistant response snapshot.

#### Scenario: Tool decision creates a durable running invocation row

- **WHEN** the provider emits a `tool_call` decision for one invocation
- **THEN** the runtime persists a canonical `scope=heartbeat_part` row for that invocation immediately
- **AND** the row contains a `tool_call` part linked by `invocationId`
- **AND** the row remains incomplete until a corresponding `tool_result` exists

#### Scenario: Tool arguments hydrate before completion

- **WHEN** the runtime later learns better invocation arguments for the same `invocationId`
- **THEN** it updates the same invocation Heartbeat row in place
- **AND** the operator can see the hydrated parameters without waiting for tool completion

#### Scenario: Tool completion appends result without changing row identity

- **WHEN** local tool execution finishes for one invocation
- **THEN** the same invocation Heartbeat row gains a `tool_result` part
- **AND** the invocation row identity remains stable before and after completion
- **AND** the runtime does not split the same invocation across separate post-completion Heartbeat rows

### Requirement: Assistant response Heartbeat rows SHALL not embed tool execution facts

Assistant response Heartbeat rows SHALL persist assistant-authored parts only. Tool execution facts SHALL live in invocation rows.

#### Scenario: Assistant text and tool lifecycle coexist in one ai_call

- **WHEN** one AI call emits assistant text plus one or more tool invocations
- **THEN** the assistant response Heartbeat row contains only assistant-authored parts such as `thinking` and `text`
- **AND** each tool invocation persists in its own invocation-linked Heartbeat row
- **AND** Heartbeat does not depend on `response.toolTrace` snapshot reconstruction to show tool lifecycle

### Requirement: Assistant thinking SHALL persist as durable response-row parts

Assistant reasoning that arrives before final assistant text SHALL be persisted as durable `thinking` parts on the assistant response Heartbeat row.

#### Scenario: Thinking streams before assistant text

- **WHEN** the provider emits one or more assistant reasoning chunks before the assistant text is complete
- **THEN** the runtime updates the assistant response Heartbeat row in place with a `thinking` part
- **AND** that row remains the same durable assistant response row that later carries `text`
- **AND** grouped Heartbeat queries preserve the observable ordering between `thinking` and `text`

### Requirement: Changed config facts SHALL be linked durably to the next AI call

Runtime settings saves that change effective model knobs SHALL create one durable config fact now and let the next AI call link that fact objectively.

#### Scenario: Settings save creates a pending config fact before the next call exists

- **WHEN** an operator saves new model config while no new AI call has started yet
- **THEN** the runtime persists one loose `request_aux:config:*` fact
- **AND** the persistence layer does not mutate any current in-flight model call

#### Scenario: The next AI call consumes the pending config fact

- **WHEN** a later AI call starts after that config fact was persisted
- **THEN** the new `ai_call` links the durable config fact through `auxiliaryMessageIds`
- **AND** query-time Heartbeat grouping can project that fact into the next `before-call` group without rewriting the stored row

### Requirement: Session DB SHALL act as the objective AI-call historian

The session durable store SHALL record objective facts around AI calls, including grouped message parts, `ai_call` lifecycle rows, attention dispatches, and attention receipts. This historian role SHALL support reconstruction and inspection, but it SHALL NOT make session-system the owner of room, terminal, workspace, or attention business truth.

#### Scenario: Historian facts reconstruct inspection without owning source truth
- **WHEN** runtime inspection reads a stopped or cold session
- **THEN** session-system provides AI-call-adjacent ledger facts for reconstruction
- **AND** room history still comes from message-system, terminal truth still comes from terminal-system, and cognitive state still comes from attention-system

#### Scenario: Dispatch and receipt rows remain AI-call-adjacent facts
- **WHEN** a model attempt is dispatched, accepted, failed, aborted, or completed
- **THEN** session-system may persist the dispatch and receipt rows as objective AI-call history
- **AND** those rows do not rewrite the originating attention commit or the source-system durable truth
