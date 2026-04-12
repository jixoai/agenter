## Purpose

Define the observable lifecycle contract for runtime model calls so clients can inspect in-flight, completed, and failed calls consistently.
## Requirements
### Requirement: Runtime model calls SHALL expose lifecycle state
The system SHALL persist and publish model calls as `ai_call` lifecycle records. Each record SHALL expose the actual request URL and request body that were sent, the latest response body accumulated so far, explicit lifecycle timestamps, and compact-vs-normal call metadata. The persisted record SHALL be updated in place while streaming instead of creating a second logical row for completion.

#### Scenario: Persist a running model call at request start
- **WHEN** the runtime begins a model request for a persisted attention-processing or compact round
- **THEN** it creates one `ai_call` record containing the request URL, request body, call kind, and `status = "running"`
- **THEN** realtime or persisted inspection can observe that running record before the final response is available

#### Scenario: Complete a running model call
- **WHEN** a running model call returns a response successfully
- **THEN** the system updates the same `ai_call` record with `status = "done"`, the final response body, completion timestamp, and terminal completion state
- **THEN** inspection does not require a second logical model-call id to understand the finished request

#### Scenario: Compact model call remains distinguishable
- **WHEN** runtime triggers a special compact cycle
- **THEN** the `ai_call` record marks that request as compact-specific metadata
- **THEN** inspection can distinguish the compact prompt-window rewrite from a normal attention-processing round

#### Scenario: Cancelled model work remains observable
- **WHEN** runtime control interrupts a running model call before completion
- **THEN** the system updates the same `ai_call` record with an explicit cancellation terminal state
- **THEN** inspection can distinguish cancellation from success or failure without consulting a legacy `model_call` row

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

### Requirement: Runtime model calls SHALL persist explicit cancellation outcomes
The system SHALL persist a terminal cancellation outcome for a running model call when runtime control ends the request intentionally.

#### Scenario: Session stop marks the model call as canceled
- **WHEN** a running model call is aborted because the session is stopped
- **THEN** the existing model-call record is updated with `status = "cancelled"`
- **THEN** the record includes cancellation metadata that distinguishes runtime/user cancellation from provider failure

#### Scenario: Session abort marks the model call as canceled before teardown
- **WHEN** a running model call is aborted because the session is aborted
- **THEN** the system persists the same model-call record with `status = "cancelled"`
- **THEN** later inspection can tell that the request ended due to control-plane cancellation rather than timeout or provider error
