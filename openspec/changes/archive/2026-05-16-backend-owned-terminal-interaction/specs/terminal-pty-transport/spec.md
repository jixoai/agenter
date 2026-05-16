## ADDED Requirements

### Requirement: Terminal transport SHALL carry semantic backend interaction events

Terminal transport or its paired direct endpoint SHALL carry semantic backend interaction events for projection hosts, including pointer selection lifecycle, semantic selection requests, copy selection, clear selection, cursor-follow, viewport mutation, paste, and resize. These events SHALL target backend terminal truth or an offscreen renderer owner rather than host-local UI state.

#### Scenario: Pointer selection event targets backend owner
- **WHEN** a projection host sends a pointer selection start, update, or end event
- **THEN** the transport SHALL identify the target terminal or owner region and backend coordinates
- **AND** the server side SHALL apply the event to backend interaction truth

#### Scenario: Copy selection event targets backend owner
- **WHEN** a projection host sends a copy-selection request
- **THEN** the transport SHALL route that request to the backend owner with the active selection
- **AND** the response or host adapter SHALL receive selected text from backend truth

#### Scenario: Cursor-follow event remains separate from viewport target
- **WHEN** a projection host requests cursor-follow
- **THEN** transport SHALL carry an explicit cursor-follow message
- **AND** the backend SHALL compute viewport movement from current cursor truth rather than accepting a frontend-computed cursor target as completion truth

### Requirement: Terminal frame payloads SHALL support backend interaction overlays

Terminal frame payloads SHALL be able to carry backend-owned interaction overlays needed for projection rendering, including selection row ranges and active cursor ownership facts. Overlay data SHALL be derived from backend truth and SHALL NOT be a host-local acknowledgement.

#### Scenario: Pull frame returns selection overlay
- **WHEN** a client pulls a frame whose visible viewport intersects backend selection
- **THEN** the returned frame SHALL include selection overlay rows or equivalent compact overlay data
- **AND** the client SHALL draw that overlay without owning selected-text extraction

#### Scenario: Pull frame returns cleared overlay state
- **WHEN** backend selection is cleared after a previous selected frame
- **THEN** a later frame SHALL make the cleared state observable
- **AND** the client SHALL remove stale selected paint for that owner

### Requirement: Direct and websocket transports SHALL share high-level interaction APIs

Direct in-process transports and WebSocket transports SHALL expose the same high-level terminal interaction API. Direct mode MAY pass structured objects or fast clones, while WebSocket mode MAY serialize via protobuf or another transport encoding. Callers SHALL NOT be forced to JSON stringify interaction events just because one transport implementation needs serialization.

#### Scenario: Direct endpoint sends structured interaction
- **WHEN** native cli-shell and terminal backend live in the same process
- **THEN** the direct endpoint SHALL accept structured interaction values through high-level methods
- **AND** serialization SHALL NOT be part of the caller contract

#### Scenario: WebSocket endpoint serializes behind the same API
- **WHEN** a Web attachment uses the same interaction API over WebSocket
- **THEN** the WebSocket endpoint SHALL serialize and deserialize as transport detail
- **AND** backend behavior SHALL match direct mode for the same event sequence

### Requirement: Terminal transport debug traces SHALL preserve interaction causality

When debug tracing is enabled, transport SHALL record enough causality to connect host event, transport message, backend action, frame publication, and visible overlay or viewport result.

#### Scenario: Selection trace crosses transport boundary
- **WHEN** `--debug=selection` is enabled and a selection event crosses transport
- **THEN** the trace SHALL include event owner, backend coordinates, transport mode, and backend publication sequence
- **AND** the trace SHALL make host-local selection ownership regressions visible

#### Scenario: Follow trace crosses transport boundary
- **WHEN** `--debug=follow` is enabled and cursor-follow crosses transport
- **THEN** the trace SHALL include request reason, backend cursor row, backend viewport before and after, and publication sequence
- **AND** the trace SHALL not treat the send operation alone as proof that visible follow completed
