## MODIFIED Requirements

### Requirement: Runtime terminal config surfaces SHALL expose durable launch truth

Runtime-local terminal config reads and writes SHALL expose durable terminal launch/config truth, including backend selection or backend profile, independently from runtime observed identity truth and viewport renderer fact.

#### Scenario: Runtime get-config returns launch truth

- **WHEN** the AI runs `terminal get-config`
- **THEN** the runtime returns durable launch truth such as `command`, `launchCwd`, `processKind`, backend selection/profile fields, and metadata
- **AND** the caller does not need to infer durable config from `terminal list` or `terminal read`

#### Scenario: Runtime set-config preserves observed identity separation

- **WHEN** the AI updates terminal config while the running PTY later reports a different current path or current title
- **THEN** runtime projections preserve the updated durable config
- **AND** they continue to publish runtime-observed identity separately

#### Scenario: Browser renderer fact does not rewrite backend launch truth

- **WHEN** a terminal launches through the official xterm backend and a browser surface later resolves `resolvedRenderer = xterm`
- **THEN** runtime terminal config continues to expose backend launch truth separately from renderer fact
- **AND** runtime code does not collapse backend selection into browser renderer naming
