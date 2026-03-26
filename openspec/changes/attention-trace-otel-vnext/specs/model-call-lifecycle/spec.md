## MODIFIED Requirements

### Requirement: Runtime model calls SHALL expose lifecycle state
The system SHALL persist and publish model calls as lifecycle records with linked trace identity so clients can observe when a call starts, completes, fails, or is cancelled before the surrounding cycle fully finishes.

#### Scenario: Persist a running model call at request start
- **WHEN** the runtime begins a model request for a persisted cycle frame
- **THEN** it creates a model-call record with the request payload, linked trace/span identity, and `status = "running"`
- **THEN** realtime clients can observe that running model-call record before the final response is available

#### Scenario: Complete a running model call
- **WHEN** a running model call returns a response successfully
- **THEN** the system updates the same model-call record with `status = "done"`, response payload, completion timestamp, and final trace linkage
- **THEN** realtime clients observe the updated record without needing a second logical model-call id

#### Scenario: Cancelled model work remains observable
- **WHEN** runtime control interrupts a running model call before completion
- **THEN** the system updates the same model-call record with an explicit cancellation terminal state and linked trace outcome
- **THEN** inspection can distinguish cancellation from success or failure

### Requirement: Stalled model calls SHALL end as persisted errors
The system SHALL convert a model request that exceeds the runtime timeout window, or that is interrupted during runtime teardown, into a persisted terminal outcome instead of leaving the call indefinitely in `running`.

#### Scenario: Timeout converts to a recoverable error
- **WHEN** a model request exceeds the runtime timeout threshold
- **THEN** the system updates the running model-call record with `status = "error"` and a timeout error payload
- **THEN** the surrounding turn surfaces a recoverable user-facing failure state instead of remaining indefinitely in `running`

#### Scenario: Abort ends the running model call
- **WHEN** the runtime aborts while a model request is still running
- **THEN** the system updates the same model-call record with an explicit aborted terminal outcome
- **THEN** the record remains available for later inspection after the runtime instance is destroyed
