## MODIFIED Requirements

### Requirement: Terminal surface projection SHALL provide one authoritative actor-facing terminal model

The system SHALL provide a terminal surface projection that combines terminal catalog metadata, lifecycle truth, observed identity, seat/access projection, approval counts, transport discovery, and renderable snapshot truth into one actor-facing model for clients and WebUI hosts.

#### Scenario: Projection preserves transport discovery across stopped state
- **WHEN** a running terminal is stopped but the actor still has valid terminal access
- **THEN** the projection keeps the durable transport discovery endpoint available for that actor
- **AND** the host can keep snapshot hydration plus later reconnect on the same endpoint after bootstrap
- **AND** stopping the PTY does not require the client to invent a new transport URL before reconnect can occur
