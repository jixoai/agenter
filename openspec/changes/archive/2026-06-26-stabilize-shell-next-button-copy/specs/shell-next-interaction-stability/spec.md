## ADDED Requirements

### Requirement: Shell-next SHALL provide one shared Button primitive

Shell-next SHALL render all interactive text buttons through one shared Button primitive or a direct adapter over that primitive. The primitive SHALL own bracketed labels, hover style, active style, disabled style, visible hit regions, and event consumption.

#### Scenario: Hover style is bold-only everywhere
- **WHEN** a ShellPane titlebar button, ChatPane titlebar button, statusbar button, CloseConfirmDialog content button, or CloseConfirmDialog titlebar button is hovered
- **THEN** only the hovered bracketed label is bold
- **AND** sibling buttons are not bold
- **AND** foreground color does not change because of hover

#### Scenario: Active style is underline-only everywhere
- **WHEN** a statusbar action or ChatPane layout action is active
- **THEN** only the active bracketed label is underlined
- **AND** the label text or glyph is not replaced by a different active variant
- **AND** inactive sibling buttons are not underlined

#### Scenario: Visible cells are clickable cells
- **WHEN** a user clicks any visible bracketed button cell
- **THEN** shell-next runs the matching button action
- **AND** clicking the row or column adjacent to the visible button does not run the action

#### Scenario: Button click commits on mouseup after a matching press
- **GIVEN** a visible shell-next button cell is pressed with `mousedown`
- **WHEN** the pointer is released with `mouseup` on that same button
- **THEN** the matching action fires exactly once
- **AND** `mousedown` alone does not fire the action
- **AND** releasing on a different cell cancels the action

### Requirement: ShellPane selection, copy, and paste SHALL follow backend-owned terminal truth

ShellPane SHALL treat terminal selection, selected text, clear-selection, copy, and paste as backend-owned terminal facts. Shell-next SHALL copy the needed legacy cli-shell behavior into shell-next modules without modifying or importing `apps/cli-shell`.

#### Scenario: Drag selection routes pane-local terminal coordinates
- **WHEN** the user drags visible ShellPane terminal text
- **THEN** shell-next sends selection start, update, and end events to the terminal source
- **AND** each event uses the terminal owner id and pane-local row and column coordinates

#### Scenario: ShellPane copy uses backend-selected text
- **WHEN** a ShellPane is focused and a host copy shortcut is pressed
- **THEN** shell-next asks the terminal backend to copy the terminal selection
- **AND** when backend selected text arrives, shell-next writes exactly one OSC52 clipboard request
- **AND** the copy shortcut is not forwarded as normal terminal input

#### Scenario: ShellPane paste is delivered once
- **WHEN** a ShellPane is focused and one paste event arrives
- **THEN** shell-next writes the pasted text to the terminal backend exactly once
- **AND** the terminal follows the cursor once
- **AND** the paste event is consumed after the terminal frame handles it

#### Scenario: ShellPane selection remains visible after backend overlay update
- **WHEN** the backend publishes a selection overlay without changing drawable terminal text
- **THEN** shell-next still renders the selection overlay on the visible terminal frame

### Requirement: Renderer primary selection SHALL not clear visible selection

Renderer panes, including ChatPane, SHALL mirror completed renderer selection to OSC52 primary without clearing the visible selection or handling middle-click paste locally.

#### Scenario: Completed renderer selection mirrors to primary
- **WHEN** a renderer pane text selection finishes
- **THEN** shell-next emits one OSC52 primary copy request for the selected text
- **AND** the renderer selection remains available for inspection after the request

#### Scenario: Middle click is not consumed by shell-next primary mirroring
- **WHEN** a renderer pane has visible selected text
- **AND** the user middle-clicks
- **THEN** shell-next does not clear the selection because of primary mirroring
- **AND** shell-next does not run a local paste handler for that middle-click

### Requirement: Terminal resize SHALL be debounced and conflated

Terminal backend resize delivery SHALL use both debounce and conflation. During the debounce window, shell-next SHALL keep exactly one pending terminal size, replace it with each newer size, and deliver only the newest size when the window expires.

#### Scenario: Rapid resize delivers only newest size
- **WHEN** a terminal pane receives multiple layout sizes inside one resize debounce window
- **THEN** shell-next sends no immediate backend resize after the first already-delivered size
- **AND** shell-next sends exactly one delayed backend resize
- **AND** that delayed resize contains the newest cols and rows

#### Scenario: Stable resize is still delivered
- **WHEN** a terminal pane receives one new size and no newer size replaces it before the debounce window expires
- **THEN** shell-next delivers that size to the terminal backend once

### Requirement: Shell-next completion SHALL leave no uncommitted workspace residue

The final implementation pass SHALL commit the completed shell-next/OpenSpec changes and leave the workspace clean. Any unrelated dirty state present before the pass SHALL be explicitly resolved without being silently mixed into shell-next commits.

#### Scenario: Final status is clean
- **WHEN** implementation and verification are complete
- **THEN** `git status --short` reports no uncommitted files
- **AND** the final report lists the commits created

#### Scenario: Cli-shell remains read-only
- **WHEN** this change is complete
- **THEN** `git diff -- apps/cli-shell` is empty
- **AND** no shell-next implementation imports from `apps/cli-shell`

### Requirement: Shell-next SHALL preserve legacy terminal keyboard selection affordances

Shell-next SHALL support the terminal keyboard affordances previously validated by cli-shell without importing from or editing `apps/cli-shell`: Option+Left/Right moves by word, Shift+Left/Right extends selection by cell, and Shift+Option+Left/Right extends selection by word. The behavior SHALL use backend-owned terminal range selection and source-owned input bytes.

#### Scenario: Option arrows move by terminal word boundary
- **GIVEN** a focused ShellPane has a visible backend line and cursor position
- **WHEN** the user presses Option+Left or Option+Right
- **THEN** shell-next calculates the previous or next word boundary from the visible terminal line
- **AND** shell-next sends repeated left or right arrow bytes to the terminal source
- **AND** shell-next follows the terminal cursor once

#### Scenario: Shift arrows extend backend selection by one cell
- **GIVEN** a focused ShellPane has a visible backend cursor position
- **WHEN** the user presses Shift+Left or Shift+Right
- **THEN** shell-next creates or updates a backend-owned selection anchor
- **AND** shell-next asks the terminal source to select the range between the anchor and the new focus cell
- **AND** shell-next sends the matching cursor movement byte to the terminal source

#### Scenario: Shift Option arrows extend backend selection by word
- **GIVEN** a focused ShellPane has a visible backend line and cursor position
- **WHEN** the user presses Shift+Option+Left or Shift+Option+Right using either CSI modified arrows or OpenTUI's meta uppercase fallback
- **THEN** shell-next selects the backend range between the original anchor and the resolved word boundary
- **AND** repeated Shift+Option movement preserves the original anchor while moving only the focus

#### Scenario: Plain terminal input clears keyboard selection anchor
- **GIVEN** a ShellPane keyboard selection anchor exists
- **WHEN** the user sends normal terminal input
- **THEN** shell-next clears the keyboard selection anchor before routing the input bytes

### Requirement: Terminal source resize SHALL be debounce plus conflated at the backend boundary

Terminal source implementations SHALL own a debounce plus conflated resize dispatcher in addition to any pane-view size coalescing. The dispatcher SHALL keep only one pending size while the debounce timer or an async backend resize is in flight, and it SHALL deliver only the newest pending size.

#### Scenario: Blocked source resize does not build an obsolete backlog
- **GIVEN** a terminal source resize backend is still processing a previous resize
- **WHEN** several newer sizes arrive
- **THEN** shell-next keeps only the newest pending size
- **AND** after the blocked backend resize resolves, shell-next delivers at most one follow-up resize with the newest size

#### Scenario: Source resize still delivers stable size once
- **WHEN** one terminal source size arrives and no newer size replaces it
- **THEN** shell-next delivers that size to the backend once after the configured debounce window

### Requirement: Resize handle click SHALL be glyph-directional

Resize handles SHALL support drag resizing and click micro-adjustment. Clicking the left/up glyph SHALL resize by `-1`; clicking the right/down glyph SHALL resize by `+1`.

#### Scenario: Horizontal resize handle click uses clicked glyph direction
- **WHEN** a user clicks `◀` in a horizontal handle
- **THEN** shell-next applies a `-1` pane resize delta
- **WHEN** a user clicks `▶`
- **THEN** shell-next applies a `+1` pane resize delta

#### Scenario: Vertical resize handle click uses clicked glyph direction
- **WHEN** a user clicks `▲` in a vertical handle
- **THEN** shell-next applies a `-1` pane resize delta
- **WHEN** a user clicks `▼`
- **THEN** shell-next applies a `+1` pane resize delta

### Requirement: Terminal interactions SHALL live in the shell-next Terminal Engine boundary

Shell-next SHALL keep terminal-specific input, selection, viewport, copy, paste, and follow-cursor behavior inside a shell-next internal Terminal Engine boundary. OpenCompose SHALL remain a generic pane composition layer and SHALL NOT own terminal-specific behavior in this change.

#### Scenario: OpenCompose pane boundary stays terminal-agnostic
- **WHEN** terminal behavior is implemented for ShellPane
- **THEN** OpenCompose still exposes only custom-rendered pane content and OpenTUI `CliRenderer` pane content
- **AND** OpenCompose APIs do not gain terminal-specific methods such as `followCursor`, `selectRange`, or `copySelection`

#### Scenario: ShellNextApp does not own terminal interaction laws
- **WHEN** ShellPane receives normal key input, paste input, selection movement, or viewport interaction
- **THEN** ShellNextApp delegates to the shell-next Terminal Engine boundary
- **AND** ShellNextApp only keeps app decisions such as prefix shortcuts, Help/Chat toggles, statusbar, close confirmation, and Room binding

### Requirement: Terminal input SHALL be one transaction

The shell-next Terminal Engine SHALL route accepted terminal input through one transaction: clear backend terminal selection unless explicitly preserving it, write input bytes/text to the terminal source, and request backend cursor follow exactly once after the backend accepts the input.

#### Scenario: Plain terminal input clears backend selection and follows cursor
- **GIVEN** a focused ShellPane has a backend selection
- **WHEN** the user sends normal terminal input
- **THEN** shell-next clears the backend terminal selection before writing input
- **AND** shell-next writes the input exactly once
- **AND** shell-next requests follow-cursor exactly once after the write is accepted

#### Scenario: Rejected terminal input does not follow cursor
- **GIVEN** a terminal source rejects an input write
- **WHEN** the user sends terminal input
- **THEN** shell-next does not request follow-cursor

#### Scenario: Selection-preserving movement does not clear backend selection
- **GIVEN** Shift+Option word selection is extending a backend-owned terminal range
- **WHEN** shell-next sends cursor movement bytes for that selection operation
- **THEN** shell-next preserves the keyboard selection anchor
- **AND** shell-next does not clear backend terminal selection before writing the movement bytes

#### Scenario: Scrolled terminal input returns viewport to cursor
- **GIVEN** the ShellPane backend viewport is scrolled away from the cursor
- **WHEN** the user sends accepted terminal input or paste text
- **THEN** shell-next requests backend follow-cursor after the write

### Requirement: Room-backed Chat chrome SHALL use the shared pane chrome Button overlay

Room-backed Chat panes SHALL use the same shared pane chrome Button overlay behavior as direct Chat panes. They SHALL NOT rely on unstyled string-only pane titles for layout actions.

#### Scenario: Room-backed Chat titlebar hover is bold-only
- **WHEN** a Room-backed Chat pane titlebar action is hovered
- **THEN** only that bracketed action is bold
- **AND** sibling actions are not bold
- **AND** foreground color does not change because of hover

#### Scenario: Room-backed Chat titlebar active state is underlined
- **WHEN** a Room-backed Chat pane is docked left, docked right, or floating
- **THEN** the matching titlebar action is underlined
- **AND** inactive layout actions are not underlined

### Requirement: Primary clipboard SHALL remain a single capability path

Shell-next SHALL request primary clipboard writes through one host clipboard/OSC52 target path. Shell-next SHALL NOT maintain an app-owned primary selection register and SHALL NOT emulate middle-click paste as a fallback.

#### Scenario: Primary copy reports capability result
- **WHEN** ShellPane or renderer selection completion asks for primary copy
- **THEN** shell-next calls the single primary host clipboard path
- **AND** the result is reported as success or unsupported by that path
- **AND** no local primary buffer is written as a fallback

### Requirement: ShellPane selection SHALL be kernel-owned instead of Shell-view-owned

ShellPane selection intent may originate from pane-local mouse events, but durable selection gesture/state ownership SHALL live in the shell-next terminal kernel boundary, not in the Shell/OpenTUI view layer. The Shell view layer SHALL NOT be the long-lived authority for scroll-aware selection state.

#### Scenario: Shell view only forwards selection intent
- **WHEN** the user starts, updates, or ends ShellPane text selection
- **THEN** the Shell/OpenTUI frame layer translates the gesture into terminal selection intent
- **AND** durable selection state is stored and evolved by the shell-next terminal kernel/source path
- **AND** ShellPane view code does not become the final authority for scroll-aware anchor/focus truth

#### Scenario: Scroll-aware selection is not solved in the Shell view layer
- **GIVEN** ShellPane selection semantics depend on terminal viewport and scrollback truth
- **WHEN** shell-next handles selection updates
- **THEN** the kernel/source path owns the scroll-aware interpretation
- **AND** Shell/OpenTUI view code remains a projection/input adapter only

#### Scenario: Semantic double click selection is not re-cleared by the Shell view
- **GIVEN** a ShellPane semantic double click is accepted by backend/kernel word selection
- **AND** a backend-owned selection overlay becomes visible before the click sequence fully ends
- **WHEN** the double-click sequence completes
- **THEN** shell-next does not issue a Shell-view clear-selection for that semantic selection
- **AND** the backend-owned selection remains visible

#### Scenario: Semantic triple click selection is not re-cleared by the Shell view
- **GIVEN** a ShellPane semantic triple click is accepted by backend/kernel line selection
- **AND** a backend-owned selection overlay becomes visible before the click sequence fully ends
- **WHEN** the triple-click sequence completes
- **THEN** shell-next does not issue a Shell-view clear-selection for that semantic selection
- **AND** the backend-owned selection remains visible

### Requirement: Terminal resize SHALL use top-layer debounce and bottom-layer conflation

Shell-next SHALL apply two separate resize laws with different responsibilities:

- a top-layer `200ms` debounce that suppresses unnecessary resize sends during rapid drag;
- a bottom-layer latest-only conflated backend queue that retains at most one newest pending size while an expensive backend resize is still running.

#### Scenario: Upper-layer debounce suppresses noisy drag updates
- **WHEN** a terminal pane receives several geometry changes inside `200ms`
- **THEN** shell-next does not immediately send each geometry change to the backend boundary
- **AND** only the latest geometry visible after the debounce window is handed to the backend resize queue

#### Scenario: Lower-layer conflation prevents a resize backlog
- **GIVEN** one backend resize is still running
- **WHEN** newer debounced sizes arrive
- **THEN** shell-next keeps only the newest pending size
- **AND** after the running resize completes, shell-next performs at most one more resize for the newest pending size

#### Scenario: Stopping drag leaves at most one final backend resize
- **GIVEN** backend resize work is much slower than user drag updates
- **WHEN** the user stops resizing
- **THEN** shell-next may still have one newest pending resize left
- **AND** after that final resize is processed there is no backlog of obsolete sizes

### Requirement: Active button styling SHALL decorate inner content only

Shell-next active and hover button styling SHALL not decorate the bracket border itself. The bracket border remains plain; only the inner content is bolded and/or underlined.

#### Scenario: Statusbar active action underlines inner content only
- **WHEN** `Help` or `Chat` is active in the statusbar
- **THEN** only the `Help` or `Chat` text inside the brackets is underlined
- **AND** the `[` and `]` cells remain undecorated

#### Scenario: Mouse-toggled statusbar actions still show the active underline
- **WHEN** `Help` or `Chat` is opened through a statusbar mouse click
- **THEN** the matching inner label is underlined in the mixed statusbar path

#### Scenario: Pane title action active styling matches the same law
- **WHEN** a pane title action is active or hovered
- **THEN** only the inner glyph/text content is decorated
- **AND** the bracket cells remain plain
