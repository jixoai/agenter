## MODIFIED Requirements

### Requirement: Runtime clients SHALL publish one Heartbeat message-parts slice

The runtime client SHALL hydrate, merge, and republish one session-local Heartbeat slice backed by the runtime Heartbeat message-parts API and realtime events. The Heartbeat surface SHALL no longer depend on assembling separate chat, request-aux, and model-call slices in the browser.

#### Scenario: Heartbeat hydration uses only canonical ledger scopes

- **WHEN** the operator opens a runtime route from a cold browser state
- **THEN** the runtime client hydrates the session's Heartbeat from one paged Heartbeat message-parts API
- **AND** that API only emits canonical `heartbeat_part` rows plus deduplicated `request_aux` rows
- **AND** no client-side fallback for legacy `scope=heartbeat` rows is required
