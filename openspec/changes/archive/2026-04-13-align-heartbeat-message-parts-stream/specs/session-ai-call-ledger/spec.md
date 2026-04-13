## MODIFIED Requirements

### Requirement: Session DB SHALL persist AI-visible traffic as grouped message parts

The session durable store SHALL persist Heartbeat request and response traffic as raw AI-visible `message_parts` rows instead of chat-shaped wrapper payloads. Each row SHALL belong to one logical `message_id`, SHALL record append order, role, part type, timestamps, completion state, and serialized part payload, and SHALL support streamed updates to the same logical part until it is complete. Compact cycles SHALL also persist a dedicated `scope=heartbeat_part` boundary message with `partType=compact` so Heartbeat can reconstruct prompt-window restart boundaries from durable facts.

#### Scenario: Streamed assistant text updates one logical Heartbeat part
- **WHEN** an assistant response streams text into an existing logical Heartbeat response message
- **THEN** the runtime creates or updates the corresponding `message_parts` row instead of creating a new ad-hoc transcript row for every delta
- **THEN** the row becomes `is_complete = true` only after the streamed assistant part finishes

#### Scenario: One logical Heartbeat message contains multiple durable parts
- **WHEN** one AI-visible request or response message contains multiple provider parts
- **THEN** those parts are stored as separate `message_parts` rows sharing the same logical Heartbeat `message_id`
- **THEN** later Heartbeat reconstruction can recover the logical message by grouping rows on `message_id`

#### Scenario: Compact cycle persists a heartbeat boundary fact
- **WHEN** a compact cycle completes and rotates the bounded prompt-window round
- **THEN** the runtime appends a `scope=heartbeat_part`, `role=system`, `partType=compact` message-part record linked to that compact AI-call
- **THEN** later Heartbeat reconstruction can show the compaction boundary without inferring it from assistant prose or cycle UI state

### Requirement: Session DB SHALL persist each model invocation as one AI-call ledger row

The session durable store SHALL persist every model invocation as one `ai_call` row containing request URL, request body, response body, lifecycle timestamps, completion state, and the bounded round index used for retention. That row SHALL link `requestMessageIds`, `responseMessageIds`, and `auxiliaryMessageIds` to the durable Heartbeat or auxiliary `message_parts` rows used by that invocation.

#### Scenario: Model request creates a running AI-call row
- **WHEN** the runtime starts a provider request
- **THEN** it creates one `ai_call` row with the request URL, request body, `created_at`, `updated_at`, and an incomplete lifecycle state
- **THEN** persisted inspection can observe that call before the final response arrives

#### Scenario: AI-call links point at durable Heartbeat rows
- **WHEN** the runtime persists an AI-call request or response
- **THEN** `requestMessageIds` reference the durable Heartbeat request message ids for that call
- **THEN** `responseMessageIds` reference the durable Heartbeat response message ids for that call
- **THEN** `auxiliaryMessageIds` reference the deduplicated `scope=request_aux` rows used by that call

#### Scenario: Streaming response updates the same AI-call row
- **WHEN** the provider streams partial response data
- **THEN** the runtime updates the same `ai_call` row in place with the latest `response_body`
- **THEN** the row is marked complete only when the provider stream or terminal outcome finishes

## ADDED Requirements

### Requirement: Heartbeat inspection SHALL page one merged message-parts stream

Runtime inspection SHALL expose one paged Heartbeat stream composed from durable `message_parts` rows instead of requiring the client to query chat rows, request-side auxiliary rows, and model-call rows separately.

#### Scenario: Heartbeat page merges auxiliary and heartbeat scopes
- **WHEN** a runtime inspection client pages Heartbeat rows for one session
- **THEN** it receives one chronological stream containing `scope=heartbeat_part` rows and deduplicated `scope=request_aux` rows
- **THEN** each row preserves `messageId`, `role`, `partType`, payload, timestamps, completion state, and related AI-call identity
- **THEN** the client does not need to open `session.db` directly or merge multiple backend pages to reconstruct Heartbeat
