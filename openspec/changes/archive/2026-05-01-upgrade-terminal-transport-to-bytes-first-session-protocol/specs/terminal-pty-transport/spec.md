## MODIFIED Requirements

### Requirement: Terminal-system SHALL publish a bytes-first PTY websocket transport

The terminal system SHALL expose websocket PTY transport endpoints for globally durable terminal ids, with endpoint discovery available from terminal config and terminal listing APIs. The live transport protocol SHALL be bytes-first: client live input is modeled as terminal input bytes, server live output is modeled as PTY output bytes, and only minimal terminal-session control remains in sideband frames.

The concrete wire representation SHALL use a shared protobuf schema carried inside websocket binary frames. Client and server SHALL read and write the same generated contract instead of maintaining independent ad-hoc frame layouts.

The transport SHALL NOT treat browser semantic events as the protocol truth. Browser keyboard, paste, mouse, and focus interactions MAY exist locally in the renderer, but the live transport SHALL prefer terminal-native input bytes or terminal-native encoded control sequences whenever possible.

The transport bootstrap SHALL send one renderable snapshot, after which live output/status become the primary stream; same-geometry live snapshots SHALL NOT be mirrored on every render tick.

#### Scenario: Discover websocket transport details

- **WHEN** a caller requests terminal-system config or terminal listing data
- **THEN** the response includes the transport details needed to connect to that global terminal id
- **AND** a renderer does not need a session-private terminal bootstrap to construct the websocket endpoint

#### Scenario: Wire frames use the shared protobuf schema

- **WHEN** terminal-system and terminal-view exchange live session frames
- **THEN** both sides encode and decode the same protobuf contract from `@agenter/terminal-transport-protocol`
- **AND** the transport does not split bytes frames and sideband frames across unrelated wire formats

#### Scenario: Connect to a live terminal endpoint

- **WHEN** a renderer connects to the PTY websocket endpoint for a running global terminal
- **THEN** the websocket streams PTY output for that terminal
- **AND** the connection closes or errors cleanly when the terminal is killed

#### Scenario: Connect to a terminal endpoint with bootstrap snapshot

- **WHEN** a renderer connects to the PTY websocket endpoint for a stopped or running global terminal
- **THEN** the transport sends one bootstrap snapshot sufficient for immediate viewport hydration
- **AND** the renderer can begin drawing terminal state before later live output arrives

#### Scenario: Live output does not mirror redundant full snapshots

- **WHEN** terminal output changes after the websocket has already bootstrapped and the terminal geometry is unchanged
- **THEN** the transport continues to stream output/status without sending another full snapshot for every render tick
- **AND** the websocket does not degrade into a same-geometry snapshot flood

#### Scenario: Live input uses bytes-first frames

- **WHEN** a terminal renderer captures interactive terminal input
- **THEN** it sends that interaction through a bytes-first live input frame
- **AND** the payload semantics are opaque terminal input bytes rather than user text strings

#### Scenario: Live output uses bytes-first frames

- **WHEN** the PTY emits new runtime output after bootstrap
- **THEN** terminal-system publishes that output through a bytes-first live output frame
- **AND** consumers can reconstruct terminal state without relying on semantic event replay

#### Scenario: Browser semantic interactions prefer terminal-native encoding

- **WHEN** a user triggers arrow keys, control keys, bracketed paste, mouse reporting, or focus reporting in a capable terminal renderer
- **THEN** the renderer prefers to encode those interactions into terminal-native bytes or terminal-native control sequences
- **AND** the transport does not require a dedicated semantic websocket frame for each browser interaction kind

#### Scenario: Local viewport geometry remains a sideband control

- **WHEN** a terminal renderer observes a local viewport geometry change
- **THEN** it sends a websocket `resize` control frame with the resolved rows and columns
- **AND** the terminal transport applies that geometry without pretending that resize is part of the stdin byte stream

### Requirement: Terminal transport live bytes SHALL respect collaboration policy

Any terminal live input sent through websocket transport SHALL respect the same grant and write-lease policy as direct terminal write APIs. Live bytes SHALL remain distinct from automation pending truth.

#### Scenario: Live bytes are rejected without write authority

- **WHEN** a caller connected to a terminal transport lacks `writer`, `admin`, or a valid active write lease
- **THEN** live input is rejected before reaching the PTY
- **AND** the transport path does not bypass collaboration policy

#### Scenario: Live bytes are accepted during an active lease

- **WHEN** a requester has a valid active write lease for that terminal
- **THEN** live input is accepted until the lease expires
- **AND** expiry immediately restores transport-side rejection for further input

#### Scenario: Live bytes still require running lifecycle truth

- **WHEN** a caller has valid write authority but the terminal PTY is stopped
- **THEN** live input is rejected as not-running
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

### Requirement: Automation write SHALL remain outside live transport truth

The automation `input` law SHALL remain a control-plane / tool-facing capability rather than the terminal-view live session protocol truth.

#### Scenario: Automation write remains pending-backed

- **WHEN** an automation-facing caller issues a terminal write through control-plane or tool APIs
- **THEN** terminal-system processes it through the existing automation write path
- **AND** approval requests and activity facts retain their existing behavior

#### Scenario: Live session protocol does not redefine automation truth

- **WHEN** terminal-view or another live renderer participates in a PTY websocket session
- **THEN** that session does not become the authoritative source of automation terminal history
- **AND** durable automation truth remains anchored in pending-backed write paths
