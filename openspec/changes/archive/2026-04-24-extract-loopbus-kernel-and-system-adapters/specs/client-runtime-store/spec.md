## ADDED Requirements

### Requirement: Client runtime store SHALL normalize attention delivery separately from message read and `ai_call` lifecycle
The client runtime store SHALL cache attention delivery projections and attempt history as session-local runtime facts, and SHALL NOT infer AI acceptance from room read-state or from `ai_call.status = "running"`.

#### Scenario: Read progress does not advance delivery projection
- **WHEN** a room message is already marked read for the acting runtime but the related delivery attempt has not yet recorded an `accepted` receipt
- **THEN** the client runtime store keeps the delivery summary at `pending` or `dispatching`
- **AND** Heartbeat selectors do not upgrade that commit to accepted

#### Scenario: Running model call does not imply accepted delivery
- **WHEN** the client receives a running `ai_call` update before any delivery receipt event arrives
- **THEN** the cached delivery summary remains `dispatching`
- **AND** runtime selectors do not infer AI acceptance from the running model-call row alone

#### Scenario: Retry history keeps previous attempts while summary follows the latest one
- **WHEN** one commit is retried after a previous failed attempt
- **THEN** the store preserves the previous attempt history
- **AND** the visible summary for that commit follows the latest attempt's delivery state

### Requirement: Client runtime store SHALL patch delivery truth from live lifecycle events
The client runtime store SHALL ingest explicit dispatch and receipt runtime events as hot slices so hydrated inspection surfaces can update delivery truth without full grouped-data refreshes.

#### Scenario: Dispatch event updates a warm Heartbeat panel
- **WHEN** the store has already hydrated Heartbeat or another runtime inspection surface for one session
- **AND** a dispatch event arrives for that session
- **THEN** the store patches the related delivery summary in place
- **AND** the visible surface does not need a cold reload to show `dispatching`

#### Scenario: Receipt event updates a warm Heartbeat panel
- **WHEN** a receipt event arrives for a hydrated session
- **THEN** the store patches the corresponding delivery summary and receipt history in place
- **AND** the visible surface can show `accepted`, `errored`, `aborted`, or `completed` immediately
