## Purpose

Define websocket PTY transport publication and collaboration-safe input handling for global terminals.

## Requirements

### Requirement: Terminal-system SHALL publish PTY websocket transport endpoints
The terminal system SHALL expose websocket PTY transport endpoints for globally durable terminal ids, with endpoint discovery available from terminal config and terminal listing APIs. Transport input SHALL be governed by terminal grants and active write leases rather than treated as a raw bypass path.

#### Scenario: Discover websocket transport details
- **WHEN** a caller requests terminal-system config or terminal listing data
- **THEN** the response includes the transport details needed to connect to that global terminal id
- **THEN** a renderer does not need a session-private terminal bootstrap to construct the websocket endpoint

#### Scenario: Connect to a live terminal endpoint
- **WHEN** a renderer connects to the PTY websocket endpoint for a running global terminal
- **THEN** the websocket streams PTY output for that terminal
- **THEN** the connection closes or errors cleanly when the terminal is killed

### Requirement: Terminal transport input SHALL respect collaboration policy
Any terminal input sent through websocket transport SHALL respect the same grant and write-lease policy as direct terminal write APIs.

#### Scenario: Transport input is rejected without write authority
- **WHEN** a caller connected to a terminal transport lacks `writer`, `admin`, or a valid active write lease
- **THEN** transport input is rejected before reaching the PTY
- **THEN** the transport path does not bypass collaboration policy

#### Scenario: Transport input is accepted during an active lease
- **WHEN** a requester has a valid active write lease for that terminal
- **THEN** transport input is accepted until the lease expires
- **THEN** expiry immediately restores transport-side rejection for further input
