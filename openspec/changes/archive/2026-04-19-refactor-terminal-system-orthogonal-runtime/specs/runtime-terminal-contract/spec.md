## ADDED Requirements

### Requirement: Runtime terminal surface invalidation SHALL refresh one resource family at a time
Runtime terminal realtime publications SHALL invalidate terminal surface resource families explicitly so client stores can refresh catalog, grants, approvals, and activity without rebuilding terminal truth in route-local code.

#### Scenario: Terminal activity invalidates only activity consumers
- **WHEN** terminal activity changes for one terminal
- **THEN** runtime publications identify that terminal in the activity invalidation set
- **THEN** client consumers can refresh terminal activity without recomputing unrelated surface resources

#### Scenario: Grant change invalidates seat projection consumers
- **WHEN** a terminal grant is issued or revoked
- **THEN** runtime publications identify that terminal in the grant invalidation set
- **THEN** client consumers can refresh call-as and seat projection data from one authoritative path

## MODIFIED Requirements

### Requirement: Runtime terminal reads SHALL carry explicit representation metadata
Whenever runtime events or snapshots include terminal read results, the payload SHALL declare whether the representation is a diff or a snapshot, SHALL preserve the global terminal id, title, and status context needed by terminal-facing UI, and SHALL expose whether the read was recorded into durable activity history.

#### Scenario: Runtime publishes a compact diff representation
- **WHEN** the terminal read path chooses a diff as the compact representation
- **THEN** the payload declares `representation = diff`
- **THEN** client consumers can render or label that result without payload-shape inference

#### Scenario: Runtime snapshot carries full terminal hydration data
- **WHEN** a session publishes terminal snapshot truth for a terminal surface
- **THEN** the runtime payload includes the full renderable snapshot needed for viewport hydration
- **THEN** terminal-facing UI does not need a second side channel to restore the viewport

#### Scenario: Runtime distinguishes pure reads from recorded observations
- **WHEN** a terminal read is executed without activity recording
- **THEN** the runtime payload identifies the representation without appending or implying a durable activity event
- **THEN** client consumers can inspect terminal state without fabricating activity history
