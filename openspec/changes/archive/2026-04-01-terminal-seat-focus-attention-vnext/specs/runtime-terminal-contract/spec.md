## MODIFIED Requirements

### Requirement: Runtime publications SHALL prefer focused terminal sets

Runtime snapshots and realtime terminal events SHALL publish the focused set of globally attached terminals for the current session actor, with any single-focus field treated only as a derived compatibility projection.

#### Scenario: Snapshot exposes session actor focus instead of a shared global flag
- **WHEN** the current session actor focuses terminals through terminal-system
- **THEN** the runtime snapshot returns those focused terminal ids in `focusedTerminalIds`
- **THEN** the client does not treat another actor's focus set as if it belonged to this session
