## Purpose

Define websocket PTY transport publication and collaboration-safe input handling for global terminals.

## Requirements

### Requirement: Terminal-system SHALL publish PTY websocket transport endpoints

The terminal system SHALL expose websocket PTY transport endpoints for globally durable terminal ids, with endpoint discovery available from terminal config and terminal listing APIs. Transport input SHALL be governed by terminal grants and active write leases rather than treated as a raw bypass path. Transport bootstrap SHALL send one renderable snapshot, after which live output/status become the primary stream; same-geometry live snapshots SHALL NOT be mirrored on every render tick.

#### Scenario: Discover websocket transport details
- **WHEN** a caller requests terminal-system config or terminal listing data
- **THEN** the response includes the transport details needed to connect to that global terminal id
- **THEN** a renderer does not need a session-private terminal bootstrap to construct the websocket endpoint

#### Scenario: Connect to a live terminal endpoint
- **WHEN** a renderer connects to the PTY websocket endpoint for a running global terminal
- **THEN** the websocket streams PTY output for that terminal
- **THEN** the connection closes or errors cleanly when the terminal is killed

#### Scenario: Connect to a stopped terminal endpoint with bootstrap snapshot
- **WHEN** a renderer connects to the PTY websocket endpoint for a stopped global terminal
- **THEN** the transport sends one bootstrap snapshot sufficient for immediate viewport hydration
- **AND** later live output/status continue from that bootstrap without mirroring a full snapshot on every render tick

#### Scenario: Live output does not mirror redundant same-geometry snapshots
- **WHEN** terminal output changes after websocket bootstrap while the terminal geometry is unchanged
- **THEN** the transport continues to stream output/status without sending another full snapshot for each render tick
- **AND** websocket consumers do not receive a same-geometry snapshot flood

#### Scenario: Running terminal exposes transport discovery

- **WHEN** a caller requests terminal-system config or terminal listing data for a running terminal
- **THEN** the response includes the transport details needed to connect to that live PTY stream
- **AND** the endpoint can be used to mirror live output

#### Scenario: Stopped terminal omits transport discovery

- **WHEN** a terminal is `not_started` or `stopped`
- **THEN** transport discovery omits `transportUrl`
- **AND** the caller must bootstrap the PTY explicitly before live transport is available

#### Scenario: Websocket open does not bootstrap a stopped terminal

- **WHEN** a renderer attempts to open transport for a terminal whose PTY is not running
- **THEN** the transport path does not start the terminal implicitly
- **AND** the caller receives a lifecycle-consistent failure instead of a hidden bootstrap

#### Scenario: Connect to a terminal endpoint with bootstrap snapshot

- **WHEN** a renderer connects to the PTY websocket endpoint for a stopped or running global terminal
- **THEN** the transport sends one bootstrap snapshot sufficient for immediate viewport hydration
- **AND** the renderer can begin drawing terminal state before later live output arrives

#### Scenario: Live output does not mirror redundant full snapshots

- **WHEN** terminal output changes after the websocket has already bootstrapped and the terminal geometry is unchanged
- **THEN** the transport continues to stream output/status without sending another full snapshot for every render tick
- **AND** the websocket does not degrade into a same-geometry snapshot flood

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
- **AND** transport remains a collaboration-governed raw forwarding path rather than a bypass around the raw/mixed terminal authority model

#### Scenario: Transport input still requires running lifecycle truth

- **WHEN** a caller has valid write authority but the terminal PTY is stopped
- **THEN** transport input is rejected as not-running
- **AND** write authority does not bypass lifecycle truth
