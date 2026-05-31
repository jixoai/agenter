## Purpose

Define the generic terminal projection law that separates raw terminal transport from backend-authored screen projection without hard-coding one app's composed terminal topology.
## Requirements
### Requirement: Terminal projection SHALL distinguish raw transport from backend screen projection

The system SHALL distinguish Protocol 1 raw terminal transport from Protocol 2 backend screen projection. Protocol 1 carries terminal control bytes to a target that understands terminal control semantics. Protocol 2 carries backend-authored screen cells, frames, or diffs to a renderer or compositor that does not own terminal interpretation.

#### Scenario: Raw-capable target consumes protocol 1

- **WHEN** a target can interpret terminal control bytes directly
- **THEN** the system MAY deliver raw terminal output through Protocol 1
- **AND** the target remains responsible for terminal emulation semantics at that edge

#### Scenario: Renderer target consumes protocol 2

- **WHEN** a target does not own terminal emulation semantics
- **THEN** the system SHALL deliver backend-authored screen cells, frames, or diffs through Protocol 2
- **AND** the target SHALL NOT reinterpret ANSI, OSC, SGR, scrollback, wrapping, cursor, or wide-character terminal semantics

#### Scenario: Protocol 2 remains derived from backend truth

- **WHEN** Protocol 2 is used for a PTY-backed source terminal
- **THEN** its screen truth SHALL derive from backend interpretation of the source terminal raw bytes
- **AND** it SHALL NOT create a second frontend-owned terminal state machine

### Requirement: Offscreen shell projection SHALL keep interaction truth together

An offscreen shell projection SHALL emit shell content, scrollbar, focus, selection, cursor, and wrapping as one cell-locked frame. A compositor MAY position that frame, but it MUST NOT split those shell concerns into separate host-local truth.

#### Scenario: Shell frame includes shell interaction projection

- **WHEN** a backend shell truth is rendered for projection
- **THEN** the shell offscreen renderer emits shell cells together with shell scrollbar, focus, selection, cursor, and wrapping projection
- **AND** a later compositor does not add a second shell selection, cursor, or scrollbar truth

#### Scenario: Selection stays inside shell frame ownership

- **WHEN** the user selects shell text
- **THEN** the selection visual and copy extraction belong to the shell offscreen renderer path
- **AND** the compositor does not maintain a second shell selection truth

### Requirement: Offscreen renderers SHALL support configurable visual chrome without removing interaction truth

Offscreen renderers SHALL support visual chrome configuration such as showing or hiding scrollbars. Hiding visual chrome MUST NOT remove scroll, viewport, cursor, selection, wrapping, or copy truth from the backend or offscreen renderer.

#### Scenario: Hidden scrollbar does not remove scroll capability

- **WHEN** an offscreen renderer hides visual scrollbar chrome
- **THEN** wheel, keyboard, or pointer scroll requests still route to the backend owner of viewport truth
- **AND** the compositor does not invent a replacement local scroll state

### Requirement: Projection hosts SHALL consume backend-owned subframes instead of hand-rolling replacement interaction models

When a projected screen includes multiple interactive regions, each region SHALL keep its own backend or offscreen interaction owner. A higher-level compositor MAY arrange those subframes, but it SHALL NOT replace their selection, copy, scroll, cursor, or wrapping law with a host-local clone.

#### Scenario: Dialogue backend owns dialogue interaction law

- **WHEN** a projected app includes a dialogue or room region backed by an offscreen renderer
- **THEN** that backend owns dialogue selection, copy, scroll, cursor, and wrapping
- **AND** the compositor consumes the region frame instead of reimplementing dialogue algorithms

#### Scenario: No-backend optimization preserves observable contract

- **WHEN** a future implementation removes an intermediate backend for optimization
- **THEN** it still preserves the same observable selection, copy, scroll, cursor, wrapping, and event-routing contract

### Requirement: Screen projection identities SHALL remain generic

The screen-projection law MAY support backend-authored composed screens, but it SHALL NOT hard-code one app-specific terminal identity such as cli-shell `terminal-2` as universal truth. App-specific composed-screen topology belongs in app specs, not in the generic projection law.

#### Scenario: App composition does not become global terminal law

- **WHEN** one app composes multiple backend-authored regions into a final visible screen
- **THEN** the generic projection law describes only how composed projection stays derived from backend truth
- **AND** it does not canonize that app's local terminal names or topology as shared platform law

### Requirement: Host events SHALL route to the backend region that owns interaction truth

Host keyboard, mouse, wheel, drag, resize, and copy events SHALL route through projection hit testing to the backend or offscreen renderer that owns the targeted interaction truth. Projection hosts MAY classify the event and map coordinates, but selection, copy, scroll, cursor, wrapping, and semantic-selection truth SHALL belong to the owning backend or offscreen renderer.

#### Scenario: Shell event routes to shell owner

- **WHEN** a host event targets a projected shell region
- **THEN** the projection host routes the event to the shell interaction owner
- **AND** unrelated projected regions do not observe that event as their own input

#### Scenario: Dialogue event routes to dialogue owner

- **WHEN** a host event targets a projected dialogue region
- **THEN** the projection host routes the event to the dialogue interaction owner
- **AND** shell selection, shell scroll, and shell cursor truth do not change from that dialogue event

#### Scenario: Final visible result returns through projection update

- **WHEN** an owning backend updates state after a routed event
- **THEN** the projection host renders the next visible frame from backend-owned truth
- **AND** it does not apply independent host-local paint fixes as replacement truth

### Requirement: Offscreen frame projection SHALL route semantic selection gestures to backend owners

The offscreen frame projection component SHALL route terminal-like semantic selection gestures for projected cells to the backend interaction owner. Double-click SHALL request word selection, and triple-click SHALL request row selection. The projection layer MAY classify valid click clusters, but it SHALL NOT compute the selected word, selected row, selected text, or selection overlay as terminal truth.

#### Scenario: Double click requests backend word selection

- **WHEN** the user double-clicks a word-like segment inside a projected terminal region
- **THEN** the projection layer routes a backend word-selection request to the active owner
- **AND** the backend interaction owner computes and publishes the selected range or overlay

#### Scenario: Triple click requests backend row selection

- **WHEN** the user triple-clicks a row inside a projected terminal region
- **THEN** the projection layer routes a backend row-selection request to the active owner
- **AND** the backend interaction owner computes and publishes the selected row range

### Requirement: Offscreen terminal interaction enhancements SHALL remain app-local policy

The offscreen terminal projection layer MAY expose configurable interaction enhancements for behavior that a backend may not provide natively. App runtime may enable an enhancement only when the backend recommendation says the behavior is missing. This policy SHALL remain app-local rather than becoming shared terminal-system law.

#### Scenario: Backend recommendation enables only missing behavior

- **WHEN** a app resolves the interaction profile for a backend
- **THEN** each enhancement is enabled only when the backend recommendation marks that behavior as missing
- **AND** capable backend-native behavior is not overridden by default

### Requirement: Offscreen terminal input SHALL request backend cursor follow

When shell input is sent through an offscreen terminal projection, the projection layer SHALL request the backend viewport to follow the backend cursor instead of changing local viewport state.

#### Scenario: Keyboard input follows the cursor

- **WHEN** the user has scrolled away from the cursor and sends shell keyboard input
- **THEN** the input path sends encoded terminal input bytes to the backend
- **AND** it requests the existing backend follow-cursor bridge
- **AND** it does not create a local frontend viewport override

#### Scenario: Follow cursor result is backend published

- **WHEN** cursor-follow changes the visible viewport
- **THEN** the backend publishes the resulting viewport in terminal truth
- **AND** the projection host updates only from that backend-published viewport

### Requirement: Supported terminal key behavior SHALL be covered by BDD matrix tests

Any app that adds terminal-side input encoding or cursor-follow enhancements SHALL maintain a BDD key matrix for supported terminal key behavior. Unknown keys MAY remain unsupported, but they MUST NOT be silently treated as verified behavior.

#### Scenario: Supported key matrix is tested

- **WHEN** a app changes terminal input encoding
- **THEN** tests cover printable text, arrows, Home, End, Delete, PageUp, PageDown, Backspace, Tab, Enter, Escape, and supported modifier combinations
- **AND** the tests verify whether each supported key routes to backend input and cursor follow

### Requirement: Screen frame delivery SHALL use dirty signals and client-paced pull

Where Protocol 2 frames or diffs cross a host boundary, the backend SHALL publish dirty signals and the client SHALL pull frames at its own cadence. A pull request SHALL describe the client's last applied frame and geometry, but viewport movement SHALL be represented by explicit backend scroll events rather than by local viewport selectors inside `pullFrame`.

#### Scenario: Backend sends dirty signal instead of pushing full screen

- **WHEN** terminal screen truth changes
- **THEN** the backend sends a `frameDirty` signal with the dirty frame sequence
- **AND** it does not continuously push full screen content to clients that have not pulled

#### Scenario: Client pulls after render cadence allows

- **WHEN** the client has applied its previous frame and its pacing window allows another refresh
- **THEN** it sends `pullFrame` with the last applied frame sequence and current geometry
- **AND** the backend returns a frame patch derived from backend truth

#### Scenario: Dirty check uses backend text plus visible-frame facts

- **WHEN** the dirty clock checks whether the visible terminal frame changed
- **THEN** it uses backend text plus viewport and cursor facts as the comparison source
- **AND** pure scrolling and cursor movement can still make the visible frame dirty

### Requirement: Projection hosts SHALL project terminal pointer coordinates through backend row truth

Projection hosts SHALL pass both backend-absolute selection coordinates and viewport-local PTY coordinates to the backend utility. Scrolled terminal views SHALL use the backend viewport start as `selectionSources.sourceStartRow` or an equivalent source-row projection so double-click, triple-click, drag, overlays, and copy text remain in backend row coordinates.

#### Scenario: Scrolled double-click selects the absolute backend word

- **GIVEN** a terminal viewport starts at backend row 20
- **WHEN** the operator double-clicks local row 1
- **THEN** the projection host sends backend row 21 to the selection controller
- **AND** word segmentation still uses the backend `Intl.Segmenter` selection algorithm

#### Scenario: Scrolled drag selection uses absolute backend rows

- **GIVEN** a terminal viewport starts at backend row 10
- **WHEN** the operator drags from local row 0 to local row 2
- **THEN** the projection host sends selection start/update/end rows 10 through 12

#### Scenario: Primary copy only follows finalized selection

- **GIVEN** a pointer-up dispatch result is `pty-mouse`
- **WHEN** the projection host handles the result
- **THEN** it does not request primary selection copy
- **AND** primary copy remains reserved for `selection-finalized`
