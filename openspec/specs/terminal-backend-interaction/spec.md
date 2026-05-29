## Purpose

Define backend-owned terminal interaction capabilities for selection, copy, semantic selection, cursor-follow, event routing, and projection overlays.
## Requirements
### Requirement: Terminal backends SHALL expose explicit interaction capabilities

Terminal backends SHALL expose explicit capability facts for terminal-like interaction behavior, including selection ownership, selected-text extraction, semantic word selection, row selection, cursor-follow, viewport scrolling, paste handling, and selection overlay publication. A projection host MUST inspect these facts before enabling any fallback enhancement.

#### Scenario: Backend reports native selection support
- **WHEN** a terminal backend can maintain selection in backend scrollback coordinates
- **THEN** its interaction capability facts SHALL report backend-owned selection support
- **AND** projection hosts SHALL route selection events to that backend instead of creating host-local selection truth

#### Scenario: Backend reports missing behavior explicitly
- **WHEN** a terminal backend cannot provide native selection or semantic word selection
- **THEN** its interaction capability facts SHALL identify the missing behavior
- **AND** any fallback implementation SHALL live behind a backend interaction adapter rather than inside host rendering code

### Requirement: Terminal selection SHALL be owned in backend coordinates

Terminal selection state SHALL be represented in backend-owned coordinates tied to the selected owner buffer, not in host screen coordinates. The selected range SHALL move or clear according to backend scrollback and buffer mutation semantics.

#### Scenario: Selection follows backend scrollback mutation
- **WHEN** selected shell content moves because the backend scrollback or viewport changes
- **THEN** the selection range SHALL move with the selected content or clear according to backend rules
- **AND** the projection host SHALL NOT keep the old selection painted at stale screen coordinates

#### Scenario: Selection remains bounded to one owner
- **WHEN** a drag starts inside the shell owner region
- **THEN** the selection SHALL remain owned by the shell backend interaction path
- **AND** the selection SHALL NOT cross into dialogue, scrollbar, or product status regions

#### Scenario: Dialogue selection uses its own backend owner
- **WHEN** a drag starts inside the dialogue owner region
- **THEN** the selection SHALL remain owned by the dialogue or terminal-chat backend interaction path
- **AND** shell selection and shell cursor truth SHALL NOT change from that dialogue drag

### Requirement: Backend interaction SHALL accept keyboard-driven selection ranges

Backend interaction owners SHALL accept selection ranges produced by keyboard editing gestures such as Option+Shift+Left and Option+Shift+Right when the product enables those gestures.

#### Scenario: Keyboard range selection remains backend-owned
- **WHEN** a projection host turns a keyboard selection gesture into a `selectRange` event
- **THEN** the backend interaction owner SHALL store and publish that selected range in backend coordinates
- **AND** copy SHALL read selected text from the backend owner

#### Scenario: Unsupported owner rejects range selection
- **WHEN** a `selectRange` event targets a different owner than the backend interaction controller owns
- **THEN** the backend interaction owner SHALL reject the event
- **AND** host projection SHALL NOT fabricate a fallback selected text range

### Requirement: Terminal backends SHALL expose selected-text extraction

The selected-text extraction path SHALL read from the backend or backend interaction adapter that owns the active selection. Product or projection code SHALL NOT reconstruct selected text from host-local rendered glyph snapshots as the durable copy truth.

#### Scenario: Copy reads selected shell text from shell owner
- **WHEN** the user copies while shell selection is active
- **THEN** the copy operation SHALL request selected text from the shell backend interaction owner
- **AND** the copied text SHALL reflect backend wrapping, wide characters, and scrollback selection semantics

#### Scenario: Copy reads selected dialogue text from dialogue owner
- **WHEN** the user copies while dialogue selection is active
- **THEN** the copy operation SHALL request selected text from the dialogue backend interaction owner
- **AND** the shell backend SHALL NOT be asked to extract dialogue text

### Requirement: Backend selection overlays SHALL be published for projection rendering

Terminal frame or projection payloads SHALL be able to include backend-owned selection overlays. A projection host SHALL draw those overlays as a visual projection and SHALL NOT treat drawn overlay state as a new source of selection truth.

#### Scenario: Frame includes selected row ranges
- **WHEN** backend selection intersects the current viewport
- **THEN** the frame payload SHALL include enough row and column range data for the projection host to paint the selected cells
- **AND** the selected-text source remains the backend selection owner

#### Scenario: Frame omits overlay when no selection is visible
- **WHEN** backend selection is absent or outside the visible viewport
- **THEN** the frame payload MAY omit selection overlay rows
- **AND** the projection host SHALL clear any prior selection paint for that owner

### Requirement: Backend interaction SHALL own semantic word and row selection

Double-click word selection and triple-click row selection SHALL request semantic selection from the backend interaction owner. The projection layer MAY classify the click sequence, but the selected word or row range SHALL be computed by the backend interaction owner.

#### Scenario: Double click requests backend word selection
- **WHEN** the projection layer recognizes a valid double-click inside one owner region
- **THEN** it SHALL send a word-selection request with backend coordinates to the owner backend
- **AND** it SHALL NOT compute the selected word range as durable truth inside the host renderer

#### Scenario: Triple click requests backend row selection
- **WHEN** the projection layer recognizes a valid triple-click inside one owner region
- **THEN** it SHALL send a row-selection request with backend coordinates to the owner backend
- **AND** it SHALL NOT compute the selected row range as durable truth inside the host renderer

#### Scenario: Semantic click cluster is strictly bounded
- **WHEN** the projection layer groups clicks for semantic selection
- **THEN** every click in the cluster SHALL target the same owner and same backend row
- **AND** x drift SHALL be at most one terminal cell
- **AND** y drift SHALL NOT cross a terminal row

### Requirement: Backend cursor-follow SHALL be a backend viewport operation

Cursor-follow SHALL be expressed as an explicit backend operation. A projection host SHALL request cursor-follow after accepted input or navigation, and the backend SHALL compute the resulting viewport from current cursor and scrollback truth.

#### Scenario: Accepted input requests backend cursor follow
- **WHEN** a projection host sends terminal input bytes and the backend accepts them
- **THEN** the projection host SHALL request backend cursor-follow
- **AND** the backend SHALL publish the resulting viewport in later backend truth

#### Scenario: Projection does not compute cursor-follow viewport
- **WHEN** the projection host has a stale or recent cursor frame
- **THEN** it SHALL NOT compute a local viewport target as the primary cursor-follow behavior
- **AND** cursor-follow truth SHALL remain backend-owned

### Requirement: Backend interaction SHALL support high-level event routing

The interaction boundary SHALL support high-level pointer, drag, wheel, key, copy, paste, resize, and semantic action messages. Transport implementations MAY serialize these messages, but direct in-process transports SHALL be able to pass structured values without requiring JSON text serialization.

#### Scenario: Direct mode passes structured interaction event
- **WHEN** cli-shell native direct mode routes a pointer drag to a backend owner in the same process
- **THEN** it SHALL pass a structured interaction event or equivalent fast clone
- **AND** it SHALL NOT require JSON stringification as the public interaction API

#### Scenario: Web transport serializes as transport detail only
- **WHEN** a Web attachment routes the same interaction event over WebSocket
- **THEN** serialization SHALL remain inside the transport implementation
- **AND** the high-level terminal interaction API SHALL remain the same semantic contract

### Requirement: Ghostty-native backend SHALL expose Ghostty terminal-core selection

When `ghostty-native` is selected, the backend SHALL expose Ghostty terminal-core selection behavior through the shared backend interaction contract instead of replacing it with a host-local OpenTUI simulation.

#### Scenario: Ghostty-native selects word through terminal core
- **WHEN** a word-selection request targets a Ghostty-native terminal
- **THEN** the backend SHALL use Ghostty terminal-core word selection or an equivalent Ghostty-native API
- **AND** the selected range SHALL be tracked by backend terminal truth

#### Scenario: Ghostty-native selection string comes from terminal core
- **WHEN** a copy request targets a Ghostty-native selection
- **THEN** selected text SHALL be produced through Ghostty terminal-core selected-text extraction
- **AND** projection code SHALL NOT reconstruct the copy payload from painted spans

#### Scenario: Ghostty-native selection follows scroll
- **WHEN** selected Ghostty-native content scrolls because shell output advances
- **THEN** the selected range SHALL move with Ghostty tracked selection pins or clear according to Ghostty rules
- **AND** stale host-screen selection paint SHALL NOT remain

### Requirement: Terminal frame state SHALL expose per-terminal mouse tracking truth

The terminal backend SHALL expose a `TerminalMouseTrackingState` for each terminal owner. The state SHALL include a protocol of `none`, `vt200`, `drag`, or `any`, and an encoding of `default` or `sgr`. The state SHALL be derived from PTY output/control-sequence parsing in the terminal/backend layer and SHALL NOT be inferred globally by Shell-Next or any other projection host.

#### Scenario: DECSET mouse modes update backend truth

- **GIVEN** a terminal backend receives `CSI ? 1000 h`, `CSI ? 1002 h`, `CSI ? 1003 h`, or `CSI ? 1006 h`
- **WHEN** a frame or host input target reads mouse tracking state
- **THEN** the state reports the matching protocol or encoding
- **AND** `CSI ? ... l` returns the matching state back to `none` or `default`

#### Scenario: Transport preserves mouse tracking state

- **GIVEN** a terminal frame carries mouse tracking state
- **WHEN** the frame is encoded as a full frame, rows patch, scroll rows patch, or row-cache patch
- **THEN** the decoded frame preserves the same protocol and encoding

### Requirement: Backend utilities SHALL route pointer input by PTY mouse state

`@agenter/termless-backend-utils` SHALL own host pointer routing for terminal backends. When mouse tracking is active and Shift is not held, pointer down, drag, up, and wheel events SHALL be encoded as xterm mouse input bytes and written to the target PTY. When mouse tracking is inactive, the same controller SHALL use backend-owned semantic and drag selection. This routing SHALL return an explicit effect so callers can distinguish `selection`, `selection-finalized`, and `pty-mouse`.

#### Scenario: Plain shell drag selects text

- **GIVEN** the target mouse tracking state is `none`
- **WHEN** the operator presses, drags, and releases over terminal cells
- **THEN** the backend utility starts, updates, and finalizes backend selection
- **AND** the final pointer-up effect is `selection-finalized`

#### Scenario: Mouse-aware TUI receives mouse bytes

- **GIVEN** the target mouse tracking state is active
- **WHEN** the operator presses, drags, releases, or wheels over terminal cells without Shift
- **THEN** the backend utility writes encoded xterm mouse bytes to the PTY
- **AND** backend selection methods are not called
- **AND** the dispatch effect is `pty-mouse`

#### Scenario: Shift overrides PTY mouse passthrough

- **GIVEN** the target mouse tracking state is active
- **WHEN** the host still delivers a Shift pointer drag
- **THEN** the backend utility uses the selection path
- **AND** it does not write PTY mouse bytes for that event
