## MODIFIED Requirements

### Requirement: Runtime clients SHALL publish one Heartbeat message-parts slice

The runtime client SHALL hydrate, merge, and republish one session-local Heartbeat slice backed by the runtime Heartbeat inspection API and realtime events. The Heartbeat surface SHALL no longer depend on assembling separate chat, request-aux, and model-call slices in the browser, and the inspection API SHALL include every durable ingress scope needed by the Heartbeat panel.

#### Scenario: Cold hydration loads one unified Heartbeat slice

- **WHEN** the operator opens a runtime route from a cold browser state
- **THEN** the runtime client hydrates the session's Heartbeat from one paged Heartbeat inspection API
- **AND** that API includes the persisted rows needed by the Heartbeat panel across legacy `heartbeat`, structured `heartbeat_part`, and `request_aux`
- **AND** the selected Heartbeat surface receives one ordered slice instead of three independently fetched inspection slices

#### Scenario: Live Heartbeat ingress rows merge into the existing session slice

- **WHEN** the runtime durably records a new or updated Heartbeat ingress row for an already hydrated session
- **THEN** the runtime publishes a realtime Heartbeat event for that row whenever the row does not already have a richer structured twin
- **AND** the client merges that row into the existing Heartbeat slice by durable message identity

#### Scenario: Loading older Heartbeat history preserves stream order

- **WHEN** the operator asks Heartbeat to load older history
- **THEN** the client requests older rows from the same Heartbeat inspection API
- **AND** the merged session-local Heartbeat slice remains ordered from oldest to newest after the older rows are inserted
