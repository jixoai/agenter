## MODIFIED Requirements

### Requirement: Runtime publications SHALL expose terminal lifecycle transitions separately from durable process phase

Runtime snapshots and terminal realtime publications SHALL expose durable `processPhase` and transient `lifecycleTransition` as separate fields so clients and AI can distinguish in-flight coordination locks from durable lifecycle facts.

#### Scenario: Runtime publishes bootstrapping without pretending the PTY is already running

- **WHEN** a newly created or explicitly bootstrapped terminal is still starting
- **THEN** runtime projections can publish `lifecycleTransition = bootstrapping`
- **AND** they do not have to claim `processPhase = running` before the PTY has actually started

#### Scenario: Runtime publishes killing without losing the durable terminal identity

- **WHEN** a terminal stop mutation is in flight
- **THEN** runtime projections can publish `lifecycleTransition = killing`
- **AND** callers can continue to resolve the same durable terminal id
- **AND** once the stop completes the projection settles on `processPhase = stopped`

### Requirement: Runtime terminal config surfaces SHALL expose durable launch truth

Runtime-local terminal config reads and writes SHALL expose durable terminal launch/config truth independently from runtime observed identity truth.

#### Scenario: Runtime get-config returns launch truth

- **WHEN** the AI runs `terminal get-config`
- **THEN** the runtime returns durable launch truth such as `command`, `launchCwd`, `processKind`, profile fields, and metadata
- **AND** the caller does not need to infer durable config from `terminal list` or `terminal read`

#### Scenario: Runtime set-config preserves observed identity separation

- **WHEN** the AI updates terminal config while the running PTY later reports a different current path or current title
- **THEN** runtime projections preserve the updated durable config
- **AND** they continue to publish runtime-observed identity separately
