## MODIFIED Requirements

### Requirement: Runtime terminal config surfaces SHALL expose durable launch truth

Runtime-local terminal config reads and writes SHALL expose durable terminal launch/config truth, including an explicit `backend` field, independently from runtime observed identity truth and viewport renderer fact.

#### Scenario: Runtime get-config returns explicit backend truth

- **WHEN** the AI runs `terminal get-config`
- **THEN** the runtime returns durable launch truth such as `command`, `launchCwd`, `processKind`, `backend`, profile fields, and metadata
- **AND** the caller does not need to infer backend identity from `terminal list`, `terminal read`, or browser renderer state

#### Scenario: Runtime set-config preserves backend truth separately from observations

- **WHEN** the AI updates terminal config while the running PTY later reports a different current path or current title
- **THEN** runtime projections preserve the updated durable config including `backend`
- **AND** they continue to publish runtime-observed identity separately

### Requirement: Runtime terminal list and create projections SHALL carry backend truth

Runtime terminal catalog projections SHALL expose the same durable `backend` value across list, create acknowledgement, and placeholder hydration surfaces.

#### Scenario: Runtime terminal list exposes backend truth

- **WHEN** a caller reads runtime terminal catalog projection through `terminal list`
- **THEN** each projected terminal includes explicit `backend`
- **AND** callers do not need route-local defaulting to hydrate client state

#### Scenario: Placeholder hydration keeps a complete terminal shape

- **WHEN** runtime projects a remote placeholder terminal before a full remote config read occurs
- **THEN** the placeholder still includes an explicit `backend` field
- **AND** client consumers can normalize local and remote terminal entries without missing-field branches
