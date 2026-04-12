## MODIFIED Requirements

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
