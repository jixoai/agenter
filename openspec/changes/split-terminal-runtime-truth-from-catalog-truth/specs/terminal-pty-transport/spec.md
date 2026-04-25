## MODIFIED Requirements

### Requirement: Terminal-system SHALL publish PTY websocket transport endpoints

The terminal system SHALL expose websocket PTY transport endpoints only for terminals whose PTY is actively running. Transport discovery SHALL represent live stream truth, not hidden bootstrap capability.

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

### Requirement: Terminal transport input SHALL respect collaboration policy

Any terminal input sent through websocket transport SHALL respect the same grant and write-lease policy as direct terminal write APIs.

#### Scenario: Transport input still requires running lifecycle truth

- **WHEN** a caller has valid write authority but the terminal PTY is stopped
- **THEN** transport input is rejected as not-running
- **AND** write authority does not bypass lifecycle truth
