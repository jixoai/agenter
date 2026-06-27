## MODIFIED Requirements

### Requirement: Runtime terminal config surfaces SHALL expose durable launch truth

Runtime-local terminal config reads and writes SHALL expose durable terminal launch/config truth, including an explicit `backend` field and any future backend-specific profile fields, independently from runtime observed identity truth and viewport renderer fact.

#### Scenario: Runtime get-config returns explicit backend truth

- **WHEN** the AI runs `terminal get-config`
- **THEN** the runtime returns durable launch truth such as `command`, `launchCwd`, `processKind`, `backend`, profile fields, and metadata
- **AND** the caller does not need to infer backend identity from `terminal list`, `terminal read`, or browser renderer state

#### Scenario: Runtime set-config preserves observed identity separation

- **WHEN** the AI updates terminal config while the running PTY later reports a different current path or current title
- **THEN** runtime projections preserve the updated durable config including `backend`
- **AND** they continue to publish runtime-observed identity separately

#### Scenario: Browser renderer fact does not rewrite backend launch truth

- **WHEN** a terminal launches through the official `ghostty-native` backend and a browser surface later resolves `resolvedRenderer = xterm`
- **THEN** runtime terminal config continues to expose `backend = ghostty-native` separately from renderer fact
- **AND** runtime code does not collapse backend selection into browser renderer naming
