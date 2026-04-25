## ADDED Requirements

### Requirement: Running model-call lifecycle SHALL remain distinct from AI acceptance
The system SHALL continue to expose `ai_call` request lifecycle state, but `status = "running"` SHALL remain distinct from AI acceptance. Acceptance SHALL be represented only through the related delivery receipt timeline.

#### Scenario: Running `ai_call` exists before acceptance
- **WHEN** the runtime starts a provider request and persists the corresponding `ai_call` row with `status = "running"`
- **THEN** runtime inspection can observe that running row immediately
- **AND** the related delivery summary remains `dispatching` until a receipt records acceptance

#### Scenario: Early provider failure does not fabricate acceptance
- **WHEN** the provider request reaches `ai_call` running state but the first observable stream outcome is an error
- **THEN** the `ai_call` lifecycle remains observable as a failed model call
- **AND** the related delivery timeline records `errored` without ever recording `accepted`

#### Scenario: Missing credentials still fail the running model call instead of producing fallback success
- **WHEN** the runtime has already persisted `ai_call.status = "running"` but `ModelClient` cannot call the provider because credentials are missing or invalid
- **THEN** the model call lifecycle ends as an error instead of a synthetic assistant success
- **AND** the related delivery timeline records an `errored` terminal receipt

### Requirement: Model calls SHALL bind to delivery attempts without replacing attempt identity
The runtime SHALL bind each persisted `ai_call` row to an existing delivery attempt instead of using the `ai_call` row itself as the attempt identity.

#### Scenario: Dispatch binds to later `ai_call` identity
- **WHEN** a logical dispatch attempt exists before the session ledger assigns a numeric `ai_call` id
- **THEN** the runtime later binds that numeric `ai_call` id onto the same dispatch attempt
- **AND** attempt history remains stable across that binding step

#### Scenario: Retry creates a new attempt instead of reusing the previous `ai_call`
- **WHEN** the runtime retries a commit after an earlier failed or aborted attempt
- **THEN** it creates a new delivery attempt and later binds a new `ai_call` row to that attempt
- **AND** the earlier `ai_call` row remains linked to the earlier attempt for inspection history
