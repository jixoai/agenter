## ADDED Requirements

### Requirement: Runtime clients SHALL publish one Heartbeat message-parts slice

The runtime client SHALL hydrate, merge, and republish one session-local Heartbeat slice backed by the runtime Heartbeat message-parts API and realtime events. The Heartbeat surface SHALL no longer depend on assembling separate chat, request-aux, and model-call slices in the browser.

#### Scenario: Cold hydration loads one Heartbeat slice
- **WHEN** the operator opens a runtime route from a cold browser state
- **THEN** the runtime client hydrates the session's Heartbeat from one paged Heartbeat message-parts API
- **THEN** the selected Heartbeat surface receives one ordered slice instead of three independently fetched inspection slices

#### Scenario: Live Heartbeat rows merge into the existing session slice
- **WHEN** the runtime publishes a new or updated Heartbeat message-parts event for an already hydrated session
- **THEN** the client merges that row into the existing Heartbeat slice by durable message identity
- **THEN** streamed assistant updates refresh the existing row instead of appending duplicate timeline cards

#### Scenario: Loading older Heartbeat history preserves stream order
- **WHEN** the operator asks Heartbeat to load older history
- **THEN** the client requests older rows from the same Heartbeat message-parts API
- **THEN** the merged session-local Heartbeat slice remains ordered from oldest to newest after the older rows are inserted
