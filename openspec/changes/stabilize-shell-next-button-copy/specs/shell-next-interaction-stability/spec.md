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

### Requirement: ShellPane selection, copy, and paste SHALL follow backend-owned terminal truth

ShellPane SHALL treat terminal selection, selected text, clear-selection, copy, and paste as backend-owned terminal facts. Shell-next SHALL copy the needed legacy cli-shell behavior into shell-next modules without modifying or importing `extensions/cli-shell`.

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
- **THEN** `git diff -- extensions/cli-shell` is empty
- **AND** no shell-next implementation imports from `extensions/cli-shell`

### Requirement: Shell-next SHALL preserve legacy terminal keyboard selection affordances

Shell-next SHALL support the terminal keyboard affordances previously validated by cli-shell without importing from or editing `extensions/cli-shell`: Option+Left/Right moves by word, Shift+Left/Right extends selection by cell, and Shift+Option+Left/Right extends selection by word. The behavior SHALL use backend-owned terminal range selection and source-owned input bytes.

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
