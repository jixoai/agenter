## Purpose

Define the terminal projection law that separates raw terminal transport from backend-authored screen projection, and defines terminal-2 as a composed product screen truth.

## Requirements

### Requirement: Terminal projection SHALL distinguish raw transport from backend screen projection

The system SHALL distinguish Protocol 1 raw terminal transport from Protocol 2 backend screen projection. Protocol 1 carries terminal control bytes to a target that understands terminal control semantics. Protocol 2 carries backend-authored screen cells, frames, or diffs to a renderer or compositor that does not own terminal interpretation.

#### Scenario: Raw-capable target consumes protocol 1
- **WHEN** a target can interpret terminal control bytes directly
- **THEN** the system MAY deliver raw terminal output through Protocol 1
- **AND** the target remains responsible for terminal emulation semantics at that edge

#### Scenario: Dumb renderer consumes protocol 2
- **WHEN** a target does not own terminal emulation semantics
- **THEN** the system SHALL deliver backend-authored screen cells, frames, or diffs through Protocol 2
- **AND** the target SHALL NOT reinterpret ANSI, OSC, SGR, scrollback, wrapping, cursor, or wide-character terminal semantics

#### Scenario: Protocol 2 remains derived from backend truth
- **WHEN** Protocol 2 is used for a PTY-backed source terminal
- **THEN** its screen truth SHALL derive from backend interpretation of the source terminal raw bytes
- **AND** it SHALL NOT create a second frontend-owned terminal state machine

### Requirement: Shell offscreen renderer SHALL emit a complete shell projection frame

The shell offscreen renderer SHALL emit shell content, scrollbar, focus, selection, cursor, and wrapping as one cell-locked shell projection frame. A compositor MAY position that frame, but it MUST NOT split those shell concerns into separate external decorations.

#### Scenario: Shell frame includes shell interaction projection
- **WHEN** terminal-1 shell truth is rendered for cli-shell composition
- **THEN** the shell offscreen renderer emits shell cells together with shell scrollbar, focus, selection, cursor, and wrapping projection
- **AND** the terminal-2 compositor does not add those concerns later as independent host-local decorations

#### Scenario: Selection stays inside shell frame ownership
- **WHEN** the user selects shell text
- **THEN** the selection visual and copy extraction SHALL belong to the shell offscreen renderer path
- **AND** terminal-2 SHALL NOT maintain a second shell selection truth

#### Scenario: Scrollbar stays inside shell frame ownership
- **WHEN** the shell region renders a visible scrollbar
- **THEN** the scrollbar SHALL be part of the shell offscreen renderer frame
- **AND** shell scrollbar state SHALL remain bound to shell viewport truth rather than compositor-local decoration state

### Requirement: Offscreen renderers SHALL support configurable visual chrome without removing interaction truth

Offscreen renderers SHALL support visual chrome configuration such as showing or hiding scrollbars. Hiding visual chrome MUST NOT remove scroll, viewport, cursor, selection, wrapping, or copy truth from the backend or offscreen renderer.

#### Scenario: Dialogue renderer hides visual scrollbar
- **WHEN** terminal-chat renders dialogue content with scrollbar chrome hidden
- **THEN** the dialogue frame omits the visual scrollbar
- **AND** terminal-chat still owns scrollBox offset, viewport, selection, cursor, wrapping, and copy extraction

#### Scenario: Hidden scrollbar does not remove scroll capability
- **WHEN** the dialogue scrollbar is hidden
- **THEN** wheel, keyboard, or pointer scroll requests targeting dialogue SHALL still route to terminal-chat scroll ownership
- **AND** terminal-2 SHALL NOT invent a replacement dialogue scroll state

### Requirement: Terminal-chat SHALL use an independent backend before no-backend optimization

Terminal-chat SHALL use an independent OpenTUI dialogue backend instance in the first implementation. The system MUST NOT replace that backend with hand-rolled dialogue selection, copy, scroll, cursor, or wrapping algorithms in terminal-2 or host adapter code before the independent backend path is stable and accepted.

#### Scenario: Dialogue backend owns reusable interaction law
- **WHEN** terminal-chat is implemented for cli-shell
- **THEN** it SHALL use an independent OpenTUI backend instance and the shared offscreen renderer/event-bridge law
- **AND** selection, copy, scroll, cursor, and wrapping SHALL be owned by that backend path

#### Scenario: Terminal-2 does not hand-roll dialogue algorithms
- **WHEN** terminal-2 composes dialogue into the final product screen
- **THEN** terminal-2 SHALL consume terminal-chat's offscreen frame
- **AND** it SHALL NOT implement separate dialogue selection, copy, scroll, cursor, or wrapping algorithms as a replacement for terminal-chat backend ownership

#### Scenario: No-backend optimization waits for stability
- **WHEN** a future implementation proposes a no-backend terminal-chat optimization
- **THEN** the independent backend route SHALL already have passed acceptance
- **AND** the optimization SHALL preserve the same observable dialogue selection, copy, scroll, cursor, wrapping, and event-routing contract

### Requirement: Terminal-2 SHALL be the final composed product screen truth

Terminal-2 SHALL be the final composed cli-shell product screen truth. Native and Web hosts SHALL render terminal-2 rather than rendering terminal-1 or host-local approximations of the product surface.

#### Scenario: Terminal-2 composes shell and dialogue frames
- **WHEN** cli-shell builds the final visible product screen
- **THEN** terminal-2 SHALL compose the shell offscreen frame, terminal-chat frame, and product chrome into one final screen
- **AND** terminal-2 SHALL publish that final screen as the product truth consumed by hosts

#### Scenario: Native host renders terminal-2
- **WHEN** cli-shell runs in native mode
- **THEN** the native host SHALL render terminal-2 final product screen through the current process output path
- **AND** it SHALL NOT keep accepted product chrome only in host-local OpenTUI overlays
- **AND** it SHALL NOT open a pull/readback transport session for terminal-2 from the same native process

#### Scenario: Web host renders terminal-2
- **WHEN** cli-shell runs in `--web` mode
- **THEN** the Web host SHALL render terminal-2 final product screen
- **AND** it SHALL NOT render only terminal-1 shell truth or a reduced debugging-only surface

### Requirement: Terminal-2 SHALL NOT require a child PTY process

Terminal-2 SHALL be allowed to be a composed terminal runtime without a child PTY process. It SHALL still have terminal identity, geometry, frame publication, event routing, and raw-output adapter capability.

#### Scenario: Composed terminal publishes without fake PTY
- **WHEN** terminal-2 is composed from terminal-1 shell frame, terminal-chat frame, and product chrome
- **THEN** terminal-2 SHALL publish terminal screen truth without requiring a fake shell child process
- **AND** the implementation SHALL NOT perform an unnecessary cells-to-ANSI-to-cells round trip just to make terminal-2 look like a terminal

#### Scenario: Raw adapter is an output boundary
- **WHEN** terminal-2 output must reach a raw-capable target such as Ghostty or a browser terminal renderer
- **THEN** terminal-2 MAY encode its final screen truth into raw output as an adapter boundary
- **AND** that raw adapter SHALL NOT become terminal-2's source of truth

### Requirement: Host events SHALL route to the region backend that owns interaction truth

Host keyboard, mouse, wheel, drag, resize, and copy events SHALL route through terminal-2 hit-testing to the backend or offscreen renderer that owns the targeted interaction truth. Projection hosts MAY classify the event and map coordinates, but selection, copy, scroll, cursor, wrapping, and semantic-selection truth SHALL belong to the owning backend or offscreen renderer.

#### Scenario: Shell event routes to shell owner
- **WHEN** a host event targets the shell region
- **THEN** terminal-2 SHALL route the event to the shell offscreen renderer or terminal-1 interaction path
- **AND** terminal-chat SHALL NOT observe that event as dialogue input

#### Scenario: Dialogue event routes to terminal-chat owner
- **WHEN** a host event targets the dialogue region
- **THEN** terminal-2 SHALL route the event to terminal-chat OpenTUI backend or dialogue backend interaction owner
- **AND** shell selection, shell scroll, and shell cursor truth SHALL NOT change from that dialogue event

#### Scenario: Final visible result returns through terminal-2
- **WHEN** an owning backend updates state after a routed event
- **THEN** terminal-2 SHALL compose and publish the next final product screen
- **AND** native and Web hosts SHALL observe the result from terminal-2 rather than applying independent host-local paint fixes

#### Scenario: Projection does not retain selected text as owner truth
- **WHEN** a host event changes selection state
- **THEN** the projection host SHALL wait for backend interaction truth or backend overlay publication to render the new selection
- **AND** it SHALL NOT keep host-local selected text as the durable copy source

### Requirement: Offscreen frame projection SHALL route semantic selection gestures to backend owners

The offscreen frame projection component SHALL route terminal-like semantic selection gestures for projected cells to the backend interaction owner. Double-click SHALL request word selection, and triple-click SHALL request row selection. The projection layer MAY classify valid click clusters, but it SHALL NOT compute the selected word, selected row, selected text, or selection overlay as terminal truth.

#### Scenario: Double click requests backend word selection
- **WHEN** the user double-clicks a word-like segment inside a projected terminal region
- **THEN** the offscreen frame projection SHALL route a backend word-selection request to the active owner
- **AND** the backend interaction owner SHALL compute and publish the selected range or overlay
- **AND** the projection host SHALL NOT split words by ASCII whitespace as durable selection truth

#### Scenario: Triple click requests backend row selection
- **WHEN** the user triple-clicks a row inside a projected terminal region
- **THEN** the offscreen frame projection SHALL route a backend row-selection request to the active owner
- **AND** the backend interaction owner SHALL compute and publish the selected row range
- **AND** the selected range SHALL remain bounded to the active owner region

#### Scenario: Semantic selection uses backend copy path
- **WHEN** a word or row is selected by double-click or triple-click
- **THEN** copy extraction SHALL return text through the same backend-selected-text path as drag selection
- **AND** product code SHALL NOT implement a separate copy algorithm for semantic selections

#### Scenario: Click drift resets semantic gesture cluster
- **WHEN** repeated clicks differ by more than one terminal cell in x or cross to another backend row
- **THEN** the offscreen frame projection SHALL reset the semantic click cluster
- **AND** it SHALL NOT send a double-click or triple-click selection request for that cluster

### Requirement: Offscreen terminal interaction enhancements SHALL be configurable

The offscreen terminal projection layer SHALL expose configurable interaction enhancements for behavior that a backend may not provide natively. Product runtime SHALL enable an enhancement only when the backend recommendation says the backend is missing that behavior.

#### Scenario: Backend recommendation enables only missing behavior
- **WHEN** cli-shell resolves the interaction profile for a backend
- **THEN** each enhancement SHALL be enabled only when the backend recommendation marks that behavior as missing
- **AND** capable backend-native behavior SHALL NOT be overridden by default

#### Scenario: Enhancement profile stays product-local
- **WHEN** cli-shell configures offscreen interaction behavior
- **THEN** the configuration SHALL remain inside `@agenter/cli-shell`
- **AND** core terminal-system modules SHALL NOT import cli-shell product policy

### Requirement: Offscreen terminal input SHALL request backend cursor follow

When shell input is sent through an offscreen terminal projection, the projection layer SHALL request the backend viewport to follow the backend cursor instead of changing local viewport state.

#### Scenario: Keyboard input follows the cursor
- **WHEN** the user has scrolled away from the cursor and sends shell keyboard input
- **THEN** the input path SHALL send the encoded terminal input bytes to the backend
- **AND** it SHALL request the existing backend follow-cursor bridge
- **AND** it SHALL NOT create a local frontend viewport override

#### Scenario: Failed input does not move viewport
- **WHEN** terminal input bytes are not accepted by the backend
- **THEN** the projection layer SHALL NOT request follow-cursor

#### Scenario: Follow cursor result is backend published
- **WHEN** cursor-follow changes the visible viewport
- **THEN** the backend SHALL publish the resulting viewport in terminal truth
- **AND** the projection host SHALL update only from that backend-published viewport

### Requirement: Offscreen terminal key input SHALL follow backend cursor after successful navigation

When shell key input is accepted by the backend through the offscreen projection bridge, cli-shell SHALL request the backend cursor-follow bridge for printable text and supported navigation keys.

#### Scenario: Printable input follows cursor
- **WHEN** the user has scrolled away from the cursor and types printable shell text
- **THEN** cli-shell SHALL send the encoded input bytes to the backend
- **AND** it SHALL request backend cursor follow

#### Scenario: Navigation input follows cursor
- **WHEN** the user presses an arrow key, Home, End, Delete, Backspace, Tab, Enter, or supported Ctrl-letter input in the shell region
- **THEN** cli-shell SHALL send the encoded input bytes to the backend
- **AND** it SHALL request backend cursor follow

#### Scenario: Failed navigation input does not move viewport
- **WHEN** the backend does not accept the encoded shell input bytes
- **THEN** cli-shell SHALL NOT request backend cursor follow
- **AND** cli-shell SHALL NOT create a frontend-owned viewport override

### Requirement: Offscreen terminal word navigation SHALL reuse backend-aware word boundaries

When word-navigation enhancement is enabled, Option+Left and Option+Right SHALL use the same backend-aware word-boundary helper as semantic word selection. A backend that can handle native word movement MAY receive native terminal sequences; a backend interaction adapter MAY compute ICU-based boundaries, but the projection host SHALL NOT keep a separate word-navigation text model.

#### Scenario: Option Left navigates to previous word boundary
- **WHEN** word-navigation enhancement is enabled and the user presses Option+Left in the shell region
- **THEN** cli-shell SHALL route the navigation request through the backend interaction or terminal input path
- **AND** the backend-aware word-boundary helper SHALL determine the movement semantics when native terminal input is insufficient
- **AND** it SHALL request backend cursor follow after successful input

#### Scenario: Option Right navigates to next word boundary
- **WHEN** word-navigation enhancement is enabled and the user presses Option+Right in the shell region
- **THEN** cli-shell SHALL route the navigation request through the backend interaction or terminal input path
- **AND** the backend-aware word-boundary helper SHALL determine the movement semantics when native terminal input is insufficient
- **AND** it SHALL request backend cursor follow after successful input

#### Scenario: Option Up and Option Down stay backend native
- **WHEN** the user presses Option+Up or Option+Down
- **THEN** cli-shell SHALL NOT invent product-specific word navigation semantics
- **AND** it SHALL pass through backend/native terminal input when a native sequence is available

### Requirement: Supported terminal key behavior SHALL be covered by BDD matrix tests

cli-shell SHALL maintain a BDD key matrix for supported terminal key encoding and cursor-follow behavior. Unknown keys MAY remain unsupported, but they MUST NOT be silently treated as verified behavior.

#### Scenario: Supported key matrix is tested
- **WHEN** cli-shell changes terminal input encoding
- **THEN** tests SHALL cover printable text, arrows, Home, End, Delete, PageUp, PageDown, Backspace, Tab, Enter, Escape, and Ctrl-letter input
- **AND** the tests SHALL verify whether each supported key routes to backend input and cursor follow

#### Scenario: Unknown keys remain explicit
- **WHEN** cli-shell receives a key outside the supported matrix and no native sequence is available
- **THEN** cli-shell SHALL return no encoded terminal input
- **AND** the key SHALL NOT be counted as covered behavior by the supported key matrix

### Requirement: Offscreen scrollbar progress SHALL be visible backend projection

The offscreen terminal scrollbar SHALL visibly project backend scroll progress from backend `scrollSize`, `viewportSize`, and `scrollPosition`. User scrollbar interactions SHALL produce backend viewport target requests; visual progress SHALL update only from backend state.

#### Scenario: Scrollbar thumb reflects backend viewport
- **WHEN** backend viewport state changes
- **THEN** the offscreen scrollbar SHALL update its visible thumb/progress position from backend state
- **AND** the compositor SHALL NOT draw a replacement scrollbar

#### Scenario: Scrollbar input requests backend target
- **WHEN** the user clicks or drags the scrollbar
- **THEN** the offscreen scrollbar SHALL send a backend viewport target request
- **AND** it SHALL wait for backend state to update the visible progress

### Requirement: Screen frame delivery SHALL use dirty signals and client-paced pull

Where Protocol 2 frames or diffs cross a host boundary, the backend SHALL publish dirty signals and the client SHALL pull frames at its own cadence. A pull request SHALL describe the client's last applied frame and geometry, but viewport movement SHALL be represented by explicit backend scroll events rather than by local viewport selectors inside `pullFrame`. Frontend input events and frontend cell drawing SHALL remain separate paths.

#### Scenario: Backend sends dirty signal instead of pushing full screen
- **WHEN** terminal screen truth changes
- **THEN** the backend sends a `frameDirty` signal with the dirty frame sequence
- **AND** it does not continuously push full screen content to clients that have not pulled

#### Scenario: Client pulls after render cadence allows
- **WHEN** the client has applied its previous frame and its pacing window allows another refresh
- **THEN** it sends `pullFrame` with the last applied frame sequence and current geometry
- **AND** the backend returns a frame patch derived from backend truth, such as full, row-cache, diff, or `notModified`

#### Scenario: Scrollbar event mutates backend viewport truth
- **WHEN** a host wheel, scrollbar click, or scrollbar drag targets a terminal viewport
- **THEN** the host sends an explicit backend `viewportDelta` or `viewportTarget` event
- **AND** the next visible viewport comes back through frame synchronization
- **AND** `pullFrame` does not carry a host-local viewport override

#### Scenario: Backend coalesces only consecutive scroll runs
- **WHEN** a WebSocket attachment receives many queued client messages
- **THEN** the backend SHALL drain them in order
- **AND** consecutive `viewportDelta` messages MAY be summed into one backend `scrollViewport(delta)` call
- **AND** semantic events such as input bytes, click, resize, `viewportTarget`, or `pullFrame` SHALL flush the current scroll run before the event is handled

#### Scenario: Frontend objectively forwards scroll events
- **WHEN** the user continuously scrolls with a wheel, trackpad, scrollbar drag, or scrollbar click
- **THEN** the frontend SHALL send objective `viewportDelta` or `viewportTarget` events
- **AND** it SHALL NOT locally merge those events into a separate viewport truth
- **AND** it SHALL NOT create one frame pull per scroll event
- **AND** it SHALL NOT treat those input events as local screen refresh requests

#### Scenario: Backend viewport input does not bypass frame pacing
- **WHEN** the backend applies `viewportDelta` or `viewportTarget`
- **THEN** it SHALL mutate backend viewport truth and stop there
- **AND** it SHALL NOT synchronously send `frameDirty` just because the viewport input arrived
- **AND** it SHALL NOT create a direct pull activation path from scroll or viewport input
- **AND** the visible viewport SHALL be observed by the shared dirty clock or by the client's next paced `pullFrame`

#### Scenario: Dirty loop is shared per terminal with per-connection dirty state
- **WHEN** multiple WebSocket attachments observe the same terminal backend
- **THEN** the backend SHALL run one shared dirty clock for that terminal, defaulting to 20 FPS
- **AND** each attachment SHALL keep its own `dirtyOutstanding` state
- **AND** the backend SHALL send `frameDirty` only to attachments that have consumed their previous dirty signal

#### Scenario: Dirty check uses backend text plus visible-frame facts
- **WHEN** the dirty clock checks whether the visible terminal frame changed
- **THEN** it SHALL use backend `getText()` as the primary optimized comparison source
- **AND** it SHALL include viewport and cursor facts so pure scrolling and cursor movement can make the visible frame dirty

#### Scenario: Client pull loop is paint paced
- **WHEN** a client is connected to a screen-frame backend
- **THEN** it SHALL default to fixed 20 FPS pull pacing
- **AND** it SHALL only schedule the next pull after the previous pulled frame has been handled and any required paint has committed
- **AND** dirty signals SHALL inform what the next paced pull may return, not create one pull request per input event
- **AND** it SHALL NOT create one pull request per scroll event
- **AND** the backend SHALL return the current backend-authored viewport frame when the client pulls

#### Scenario: Experimental dynamic refresh is opt-in
- **WHEN** experimental dynamic refresh is explicitly enabled
- **THEN** a dirty signal MAY raise the client cadence to active 20 FPS
- **AND** the client MAY fall back to 1 FPS only after its own pulled drawable cells have stayed unchanged for the quiet window
- **AND** dynamic refresh SHALL be treated as a power-saving optimization, not the default correctness path

#### Scenario: Pulled cells replay through one paint path
- **WHEN** the client receives a pulled frame
- **THEN** it SHALL update its latest frame cache and request exactly one frame-buffer replay for that frame
- **AND** mirror subscription or transport status events SHALL NOT form a second cells redraw trigger for the same frame
- **AND** drawing SHALL replay received backend cells into the frontend frame buffer instead of reconstructing terminal cells from input events

#### Scenario: JavaScript event loop owns the current vertical sync boundary
- **WHEN** frame transport runs in the current JavaScript backend
- **THEN** normal event-loop ordering SHALL preserve messages queued before `pullFrame`
- **AND** the implementation SHALL NOT add a separate special flush before `pullFrame` beyond normal input drain semantics
- **AND** a future multi-threaded runtime SHALL revisit this vertical synchronization assumption
