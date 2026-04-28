## MODIFIED Requirements

### Requirement: Terminal-system SHALL publish PTY websocket transport endpoints

The terminal system SHALL expose websocket PTY transport endpoints for globally durable terminal ids, with endpoint discovery available from terminal config and terminal listing APIs. Transport input SHALL be governed by terminal grants and active write leases rather than treated as a raw bypass path. Transport bootstrap SHALL send one renderable snapshot, after which live output/status become the primary stream; same-geometry live snapshots SHALL NOT be mirrored on every render tick.

#### Scenario: Connect to a terminal endpoint with bootstrap snapshot

- **WHEN** a renderer connects to the PTY websocket endpoint for a stopped or running global terminal
- **THEN** the transport sends one bootstrap snapshot sufficient for immediate viewport hydration
- **AND** the renderer can begin drawing terminal state before later live output arrives

#### Scenario: Live output does not mirror redundant full snapshots

- **WHEN** terminal output changes after the websocket has already bootstrapped and the terminal geometry is unchanged
- **THEN** the transport continues to stream output/status without sending another full snapshot for every render tick
- **AND** the websocket does not degrade into a same-geometry snapshot flood
