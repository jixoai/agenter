## ADDED Requirements

### Requirement: Runtime SHALL support on-demand telemetry capture control

Advanced runtime telemetry capture SHALL be explicitly started and stopped per session instead of running as an always-on session-db feature.

#### Scenario: Operator starts capture with the default capture window

- **WHEN** an operator starts telemetry capture for a session without providing `maxDurationMs`
- **THEN** the runtime starts capture for that session
- **AND** the capture window defaults to 10 minutes
- **AND** capture status becomes inspectable through a public runtime contract

#### Scenario: Operator starts unlimited capture explicitly

- **WHEN** an operator starts telemetry capture with `maxDurationMs = 0`
- **THEN** the runtime keeps capture active until an explicit stop request or runtime teardown

#### Scenario: Capture auto-expires

- **WHEN** a session capture reaches its configured duration limit
- **THEN** the runtime stops capture automatically
- **AND** the terminal capture status records an expiry-oriented stop reason

#### Scenario: Capture stop is idempotent

- **WHEN** an operator stops capture for a session that is already idle
- **THEN** the runtime returns a stable idle status without raising a protocol error

### Requirement: Disabled telemetry capture SHALL keep runtime overhead minimal

When telemetry capture is disabled, the runtime SHALL remain on a no-capture fast path.

#### Scenario: Session runs with capture disabled

- **WHEN** a session processes attention work while telemetry capture is disabled
- **THEN** the runtime does not serialize telemetry payloads
- **AND** the runtime does not write telemetry capture files
- **AND** Heartbeat and `session.db` ledger behavior remain unaffected

### Requirement: Telemetry export SHALL stay outside `session.db`

Advanced telemetry capture SHALL use a separate export/storage boundary instead of writing trace history into `session.db`.

#### Scenario: Captured telemetry is exported

- **WHEN** telemetry capture is active and runtime work occurs
- **THEN** the runtime emits OpenTelemetry-compatible spans, events, links, and runtime attributes through a dedicated capture sink
- **AND** `session.db` continues to store only durable ledger facts such as `message_part` and `ai_call`

#### Scenario: Viewer consumes capture data

- **WHEN** a CLI or WebUI inspector reads advanced telemetry
- **THEN** it can distinguish capture status, capture lifetime, and capture output from the Heartbeat ledger surface
