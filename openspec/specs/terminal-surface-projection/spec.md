# terminal-surface-projection Specification

## Purpose
TBD - created by archiving change refactor-terminal-system-orthogonal-runtime. Update Purpose after archive.
## Requirements
### Requirement: Terminal surface projection SHALL provide one authoritative actor-facing terminal model
The system SHALL provide a terminal surface projection that combines terminal catalog metadata, runtime state, seat/access projection, approval counts, and renderable snapshot truth into one actor-facing model for clients and WebUI hosts.

#### Scenario: WebUI consumes one projection instead of merging local fragments
- **WHEN** a client loads a terminal detail surface
- **THEN** it receives one terminal surface projection containing the data needed for viewport, seat, and action rendering
- **THEN** the client does not need to reconstruct seat truth by merging `access`, `grants`, and `actors`

#### Scenario: Projection carries renderable snapshot truth
- **WHEN** a terminal has durable runtime snapshot data
- **THEN** the terminal surface projection includes the renderable snapshot needed to hydrate the viewport
- **THEN** the host can render terminal output before live transport reconnects

### Requirement: Terminal surface projection SHALL preserve actor-scoped seat semantics
The terminal surface projection SHALL preserve actor-scoped focus, current-admin, lease, and approval state so clients can render seat controls directly from the projection without inventing new local rules.

#### Scenario: Actor-scoped focus is preserved in the projection
- **WHEN** one actor focuses a terminal seat and another actor does not
- **THEN** the projection marks focus only for the focused actor seat
- **THEN** clients do not infer a terminal-global focus toggle

#### Scenario: Approval and lease state travel with the seat projection
- **WHEN** a requester seat gains or loses a write lease
- **THEN** the terminal surface projection updates that seat's lease state
- **THEN** clients can render write affordances without separate lease reconstruction logic

