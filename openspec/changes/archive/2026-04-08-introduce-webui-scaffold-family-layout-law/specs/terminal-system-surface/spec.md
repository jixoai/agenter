## MODIFIED Requirements

### Requirement: Terminal-system SHALL keep collaboration and activity inside orthogonal global shells
The terminal-system route SHALL present the global terminal catalog, one selected terminal viewport, and a separate `Actions + Users` collaboration surface without coupling terminal facts to room or runtime shells. The route SHALL use shared split and scaffold primitives so the terminal viewport, tool composer, and collaboration rail each keep explicit layout ownership.

#### Scenario: Terminal-system route uses shared shell primitives
- **WHEN** the operator opens the terminal-system route
- **THEN** the route derives its primary columns and panel shells from shared split/scaffold primitives
- **THEN** terminal rendering, tool composition, and seat management no longer depend on repeated page-local shell classes
