## Purpose

Define websocket PTY transport publication and collaboration-safe input handling for global terminals.

## Requirements

### Requirement: Terminal-system SHALL publish bytes-first PTY websocket transport endpoints

The terminal system SHALL expose websocket PTY transport endpoints for globally durable terminal ids, with endpoint discovery available from terminal config and terminal listing APIs. The live transport protocol SHALL be bytes-first: client live input is modeled as terminal input bytes, server live output is modeled as PTY output bytes, and only minimal terminal-session control remains in sideband frames.

Transport input SHALL be governed by terminal grants and active write leases rather than treated as a raw bypass path. Transport bootstrap SHALL send one renderable snapshot, after which live output/status become the primary stream; same-geometry live snapshots SHALL NOT be mirrored on every render tick.

The concrete wire representation SHALL use a shared protobuf schema carried inside websocket binary frames. Client and server SHALL read and write the same generated contract instead of maintaining independent ad-hoc frame layouts.

#### Scenario: Discover websocket transport details
- **WHEN** a caller requests terminal-system config or terminal listing data
- **THEN** the response includes the transport details needed to connect to that global terminal id
- **THEN** a renderer does not need a session-private terminal bootstrap to construct the websocket endpoint

#### Scenario: Wire frames use the shared protobuf schema
- **WHEN** terminal-system and terminal-view exchange live session frames
- **THEN** both sides encode and decode the same protobuf contract from `@agenter/terminal-transport-protocol`
- **AND** the transport does not split bytes frames and sideband frames across unrelated wire formats

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

#### Scenario: Stopped terminal still exposes transport discovery

- **WHEN** a terminal is `not_started` or `stopped`
- **THEN** transport discovery still includes `transportUrl`
- **AND** the caller may connect for bootstrap snapshot hydration without implicitly starting the PTY

#### Scenario: Websocket open does not bootstrap a stopped terminal

- **WHEN** a renderer attempts to open transport for a terminal whose PTY is not running
- **THEN** the transport path does not start the terminal implicitly
- **AND** the caller can still receive bootstrap snapshot truth without a hidden runtime bootstrap

#### Scenario: Connect to a terminal endpoint with bootstrap snapshot

- **WHEN** a renderer connects to the PTY websocket endpoint for a stopped or running global terminal
- **THEN** the transport sends one bootstrap snapshot sufficient for immediate viewport hydration
- **AND** the renderer can begin drawing terminal state before later live output arrives

#### Scenario: Live output does not mirror redundant full snapshots

- **WHEN** terminal output changes after the websocket has already bootstrapped and the terminal geometry is unchanged
- **THEN** the transport continues to stream output/status without sending another full snapshot for every render tick
- **AND** the websocket does not degrade into a same-geometry snapshot flood

### Requirement: Terminal transport input SHALL respect collaboration policy

Any terminal input sent through websocket transport SHALL respect the same grant and write-lease policy as direct terminal write APIs. Live transport bytes SHALL remain distinct from automation pending truth.

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

#### Scenario: Live bytes stay separate from automation write facts
- **WHEN** an authorized websocket client sends live terminal input bytes
- **THEN** terminal-system writes the bytes directly to the running PTY
- **AND** terminal-system does not create a pending input file
- **AND** terminal-system does not append a `terminal_write` activity fact for that live frame

#### Scenario: Requester live bytes without lease do not create approval work
- **WHEN** a requester websocket client sends live terminal input bytes without an active write lease
- **THEN** terminal-system rejects the frame before it reaches the PTY
- **AND** terminal-system does not create an approval request from that interactive session traffic

### Requirement: Terminal transport SHALL support shared viewport truth for same-terminal attachments

When multiple clients participate in one same-terminal shared shell attachment, terminal transport SHALL preserve one shared viewport truth in addition to the existing bytes-first input and output transport. Shared viewport mutations such as scrolling SHALL not remain hidden frontend-local state.

#### Scenario: Same-terminal scroll updates are synchronized
- **WHEN** one client scrolls the shared viewport for a same-terminal shell attachment
- **THEN** the shared viewport truth updates through terminal-authoritative transport or control-plane semantics
- **AND** other same-terminal clients observe the same visible viewport position

#### Scenario: Shared viewport truth does not replace bytes-first input law
- **WHEN** same-terminal clients send live terminal input
- **THEN** transport still treats that input as bytes-first interactive terminal input
- **AND** shared viewport synchronization remains additional terminal truth rather than a replacement for bytes-first input transport

### Requirement: Terminal transport SHALL keep shared viewport control explicit while preserving bytes-first shell input

When same-terminal attachments need shared viewport mutations, the transport or terminal control-plane contract SHALL express those mutations as explicit terminal-authoritative facts instead of hiding them inside host-local UI state. Printable input, paste, and terminal control keys SHALL remain bytes-first live input.

#### Scenario: Shared viewport control does not require a frontend-only state machine
- **WHEN** a same-terminal attachment mutates the shared viewport
- **THEN** that mutation is expressed through explicit terminal-authoritative synchronization
- **AND** other attachments do not need a second frontend-owned terminal model to discover it

#### Scenario: Viewport mutation is echoed back through backend terminal truth
- **WHEN** one same-terminal attachment requests a viewport mutation such as scroll up or scroll down
- **THEN** runtime/control-plane applies that mutation against backend terminal truth first
- **AND** the resulting shared viewport position is republished to all attachments through authoritative terminal publication
- **AND** the initiating attachment also treats that republished viewport as the visible-truth confirmation

#### Scenario: Shell input remains bytes-first after shared viewport support is added
- **WHEN** a same-terminal attachment sends printable input, paste, or terminal control keys
- **THEN** transport still forwards that live shell input through the bytes-first path
- **AND** shared viewport support does not reinterpret those inputs as projection-only host events
