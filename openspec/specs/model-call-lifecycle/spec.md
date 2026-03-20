## Purpose

Define the observable lifecycle contract for runtime model calls so clients can inspect in-flight, completed, and failed calls consistently.

## Requirements

### Requirement: Runtime model calls SHALL expose lifecycle state
The system SHALL persist and publish model calls as lifecycle records so clients can observe when a call starts, completes, or fails before the surrounding cycle fully finishes.

#### Scenario: Persist a running model call at request start
- **WHEN** the runtime begins a model request for a persisted cycle
- **THEN** it creates a model-call record with the request payload and `status = "running"`
- **THEN** realtime clients can observe that running model-call record before the final response is available

#### Scenario: Complete a running model call
- **WHEN** a running model call returns a response successfully
- **THEN** the system updates the same model-call record with `status = "done"`, response payload, and completion timestamp
- **THEN** realtime clients observe the updated record without needing a second logical model-call id

### Requirement: Stalled model calls SHALL end as persisted errors
The system SHALL convert a model request that exceeds the runtime timeout window into a persisted error state instead of waiting indefinitely.

#### Scenario: Timeout converts to a recoverable error
- **WHEN** a model request exceeds the runtime timeout threshold
- **THEN** the system updates the running model-call record with `status = "error"` and a timeout error payload
- **THEN** the surrounding turn surfaces a recoverable user-facing failure state instead of remaining indefinitely in `calling_model`
