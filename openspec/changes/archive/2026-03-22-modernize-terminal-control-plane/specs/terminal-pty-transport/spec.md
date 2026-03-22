## ADDED Requirements

### Requirement: Terminal-system SHALL publish PTY websocket transport endpoints
The terminal system SHALL expose websocket PTY transport endpoints shaped like `ws://localhost:$PORT/pty/$TERMINAL_PID`, with endpoint discovery available from terminal config and terminal listing APIs.

#### Scenario: Discover websocket transport details
- **WHEN** a caller requests terminal-system config
- **THEN** the response includes the local websocket port used for PTY transport
- **THEN** a renderer can combine that port with a listed terminal id to construct a websocket endpoint

#### Scenario: Connect to a live terminal endpoint
- **WHEN** a renderer connects to `ws://localhost:$PORT/pty/$TERMINAL_PID` for a running terminal
- **THEN** the websocket streams PTY output for that terminal
- **THEN** the connection closes or errors cleanly when the terminal is killed
