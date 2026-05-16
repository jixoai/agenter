## ADDED Requirements

### Requirement: Terminal-view components SHALL render backend-owned interaction overlays

`web-terminal-view` and `shell-terminal-view` SHALL render backend-owned interaction overlays such as selection ranges, cursor state, focus projection, and visible scrollbar state as projections of backend truth. These components SHALL NOT turn rendered overlays into a second terminal interaction authority.

#### Scenario: Shell-terminal-view paints backend selection overlay
- **WHEN** a terminal frame includes backend selection overlay rows
- **THEN** `shell-terminal-view` SHALL paint those selected cell ranges
- **AND** it SHALL NOT compute selected text from the painted overlay as durable copy truth

#### Scenario: Web-terminal-view clears stale overlay from backend truth
- **WHEN** a later terminal frame omits selection overlay for an owner
- **THEN** `web-terminal-view` SHALL clear the prior visible selection for that owner
- **AND** it SHALL NOT preserve a host-local selection highlight after backend selection is gone

### Requirement: Terminal-view components SHALL route terminal interaction events without owning selection truth

Terminal-view components SHALL capture pointer, drag, wheel, keyboard, paste, copy, focus, and resize events and route them to the backend or offscreen renderer that owns the target region. Event capture and coordinate mapping are projection responsibilities; terminal selection, copy, cursor-follow, scrollback, and wrapping truth are backend responsibilities.

#### Scenario: Pointer drag routes to backend selection owner
- **WHEN** the user drags inside a terminal owner region
- **THEN** the terminal-view component SHALL route start/update/end selection events to the backend interaction owner
- **AND** it SHALL NOT store the drag range as durable terminal selection truth

#### Scenario: Copy routes to active backend owner
- **WHEN** the user invokes copy while a backend owner has an active selection
- **THEN** the terminal-view component SHALL request selected text from that owner
- **AND** native shell projection MAY deliver the result through OSC 52 or another host clipboard adapter

#### Scenario: Cursor-follow routes to backend owner
- **WHEN** terminal-view accepts printable or supported navigation input
- **THEN** it SHALL route cursor-follow to the backend owner after the input is accepted
- **AND** it SHALL NOT compute a frontend-only viewport target from a previously pulled frame

### Requirement: OpenTUI native projection SHALL keep selection state out of FrameBufferRenderable truth

When OpenTUI core primitives are used for native projection, `FrameBufferRenderable`-based renderers SHALL draw backend cells and overlays only. OpenTUI selection objects MAY be used as raw input signals during migration, but they MUST NOT remain the source of terminal selected text, scrollback selection ranges, or semantic word/row selection truth.

#### Scenario: FrameBufferRenderable receives backend overlay instead of local selection truth
- **WHEN** backend-owned selection changes
- **THEN** the OpenTUI frame renderer SHALL receive updated overlay data through projection state
- **AND** the renderer SHALL repaint from that data rather than from an OpenTUI-local selected range

#### Scenario: Local OpenTUI selection cannot outlive backend selection
- **WHEN** backend selection is cleared or moves outside the viewport
- **THEN** the OpenTUI renderer SHALL clear the visible selection projection
- **AND** any local OpenTUI selection object SHALL NOT keep the old selection alive

### Requirement: Terminal-view debug traces SHALL expose interaction ownership

When debug tracing is enabled for interaction filters, terminal-view components SHALL log enough information to prove event target owner, backend action, selected range publication, cursor-follow request, and viewport result without requiring native app automation.

#### Scenario: Selection debug trace identifies owner
- **WHEN** `--debug=selection` is enabled and the user starts a selection
- **THEN** debug output SHALL identify the owner region, backend coordinates, and backend action name
- **AND** it SHALL distinguish backend-owned overlay publication from host-local event capture

#### Scenario: Follow debug trace identifies backend result
- **WHEN** `--debug=follow` is enabled and cursor-follow is requested
- **THEN** debug output SHALL identify the request reason and the backend-published viewport result
- **AND** it SHALL not report a frontend-only target as completion truth
