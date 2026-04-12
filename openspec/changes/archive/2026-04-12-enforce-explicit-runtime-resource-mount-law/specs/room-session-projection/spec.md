## ADDED Requirements

### Requirement: Runtime boot SHALL not auto-ensure an implicit default room
Session runtimes SHALL attach rooms only through explicit durable room bindings or recovery of previously attached room facts. Runtime boot MUST NOT manufacture a default room attachment merely because the session started.

#### Scenario: Fresh runtime boot does not create a hidden room attachment
- **WHEN** a fresh runtime starts without any previously attached room fact
- **THEN** app-server does not auto-ensure or auto-focus a default room for that runtime
- **AND** room attachment appears only after explicit room orchestration

#### Scenario: Recovery boot reuses explicit room bindings only
- **WHEN** a runtime restarts after one or more rooms were explicitly granted and attached earlier
- **THEN** recovery restores only those room bindings whose durable grant/token facts remain valid
- **AND** it does not synthesize a fallback default room if no valid binding remains

