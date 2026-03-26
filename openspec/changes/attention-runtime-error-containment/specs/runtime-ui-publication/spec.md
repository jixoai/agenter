## ADDED Requirements

### Requirement: Runtime clients SHALL publish scheduler containment state
The runtime client SHALL publish the session scheduler control state and wake metadata needed to explain why a session is running, waiting, backing off, blocked, paused, or aborted.

#### Scenario: Waiting and backoff are observable without trace inference
- **WHEN** a session runtime transitions into `waiting`, `backoff`, or `blocked`
- **THEN** subscribed UI consumers receive the new control state together with `wakeCause`, `retryCount`, `blockedReason`, and `nextWakeAt` when available
- **THEN** the UI can explain the containment state without reconstructing it from raw trace events

#### Scenario: Progress metadata updates only when the control state changes
- **WHEN** runtime facts update without changing the published scheduler containment state for a subscriber
- **THEN** the runtime client does not republish a fresh containment object for that selector
- **THEN** UI surfaces that inspect scheduler state remain eligible for render stability
