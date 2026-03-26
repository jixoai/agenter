## ADDED Requirements

### Requirement: Runtime model calls SHALL persist explicit cancellation outcomes
The system SHALL persist a terminal cancellation outcome for a running model call when runtime control ends the request intentionally.

#### Scenario: Session stop marks the model call as canceled
- **WHEN** a running model call is aborted because the session is stopped
- **THEN** the existing model-call record is updated with `status = "canceled"`
- **THEN** the record includes cancellation metadata that distinguishes runtime/user cancellation from provider failure

#### Scenario: Session abort marks the model call as canceled before teardown
- **WHEN** a running model call is aborted because the session is aborted
- **THEN** the system persists the same model-call record with `status = "canceled"`
- **THEN** later inspection can tell that the request ended due to control-plane cancellation rather than timeout or provider error
