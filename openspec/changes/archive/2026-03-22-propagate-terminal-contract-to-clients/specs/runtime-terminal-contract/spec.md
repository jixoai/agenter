## ADDED Requirements

### Requirement: Runtime publications SHALL prefer focused terminal sets
Runtime snapshots and realtime terminal events SHALL publish `focusedTerminalIds` as the primary focus contract, with any single-focus field treated only as a derived compatibility projection.

#### Scenario: Snapshot exposes multiple focused terminals
- **WHEN** a session has more than one focused terminal
- **THEN** the runtime snapshot returns every focused terminal id in `focusedTerminalIds`
- **THEN** clients do not need to reconstruct the set from a single-focus field

#### Scenario: Compatibility field remains derived
- **WHEN** a compatibility field such as `focusedTerminalId` is still present
- **THEN** its value is derived from `focusedTerminalIds`
- **THEN** it does not replace `focusedTerminalIds` as the primary contract

### Requirement: Runtime terminal reads SHALL carry explicit representation metadata
Whenever runtime events or snapshots include terminal read results, the payload SHALL declare whether the representation is a diff or a snapshot.

#### Scenario: Runtime publishes a compact diff representation
- **WHEN** the terminal read path chooses a diff as the compact representation
- **THEN** the payload declares `representation = diff`
- **THEN** client consumers can render or label that result without payload-shape inference
