# runtime-terminal-contract Specification

## Purpose
Define how app-server runtime publications expose attached global terminal state to clients without duplicating terminal-owned truth.

## Requirements
### Requirement: Runtime publications SHALL prefer focused terminal sets
Runtime snapshots and realtime terminal events SHALL publish the focused set of globally attached terminals for a session, with any single-focus field treated only as a derived compatibility projection.

#### Scenario: Snapshot exposes multiple focused attached terminals
- **WHEN** a session is attached to more than one focused global terminal
- **THEN** the runtime snapshot returns every focused terminal id in `focusedTerminalIds`
- **THEN** clients do not need to reconstruct the set from a single-focus field

#### Scenario: Compatibility field remains derived
- **WHEN** a compatibility field such as `focusedTerminalId` is still present
- **THEN** its value is derived from `focusedTerminalIds`
- **THEN** it does not replace `focusedTerminalIds` as the primary contract

### Requirement: Runtime terminal reads SHALL carry explicit representation metadata
Whenever runtime events or snapshots include terminal read results, the payload SHALL declare whether the representation is a diff or a snapshot and SHALL preserve the global terminal id, title, and status context needed by terminal-facing UI.

#### Scenario: Runtime publishes a compact diff representation
- **WHEN** the terminal read path chooses a diff as the compact representation
- **THEN** the payload declares `representation = diff`
- **THEN** client consumers can render or label that result without payload-shape inference

#### Scenario: Runtime snapshot carries title and status context
- **WHEN** a session publishes attached global terminal state
- **THEN** the runtime payload includes the terminal's stable id plus its current title and status context
- **THEN** terminal-facing UI does not need a second side channel to label the attached terminal
