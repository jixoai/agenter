## MODIFIED Requirements

### Requirement: Terminal surface projection SHALL provide one authoritative actor-facing terminal model

The system SHALL provide a terminal surface projection that combines terminal catalog metadata, lifecycle truth, observed identity, seat/access projection, approval counts, and renderable snapshot truth into one actor-facing model for clients and WebUI hosts.

#### Scenario: Projection includes lifecycle and observed identity

- **WHEN** a client loads a terminal detail surface
- **THEN** the projection includes launch cwd/configured title, observed current path/current title, and process lifecycle facts together
- **AND** the client does not reconstruct those truths from raw snapshots or local heuristics

#### Scenario: Projection can clear transport truth on stop

- **WHEN** a running terminal is stopped
- **THEN** the projection clears live transport discovery while preserving the rest of the terminal surface
- **AND** the client does not retain a stale websocket endpoint through merge fallback
