## MODIFIED Requirements

### Requirement: Runtime model calls SHALL expose lifecycle state
The system SHALL persist and publish model calls as lifecycle records with linked trace identity so clients can observe when a call starts, completes, fails, or is cancelled before the surrounding cycle fully finishes. Each record SHALL expose the model prompt window that was actually sent, plus request metadata that distinguishes normal attention rounds from special compact cycles.

#### Scenario: Persist a running model call at request start
- **WHEN** the runtime begins a model request for a persisted cycle frame
- **THEN** it creates a model-call record with the prompt-window payload, linked trace/span identity, and `status = "running"`
- **THEN** realtime clients can observe that running model-call record before the final response is available

#### Scenario: Complete a running model call
- **WHEN** a running model call returns a response successfully
- **THEN** the system updates the same model-call record with `status = "done"`, response payload, completion timestamp, and final trace linkage
- **THEN** realtime clients observe the updated record without needing a second logical model-call id

#### Scenario: Compact model call remains distinguishable
- **WHEN** runtime triggers a special compact cycle
- **THEN** the model-call record marks that request as compact-specific metadata
- **THEN** inspection can distinguish the compact prompt-window rewrite from a normal attention-processing round
