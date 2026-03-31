## MODIFIED Requirements

### Requirement: The system SHALL provide a standalone terminal-view WebComponent
The system SHALL provide a standalone `terminal-view` WebComponent implemented with a shared terminal controller contract, and renderer hosts SHALL be able to embed it without depending on WebUI-local terminal internals.

#### Scenario: Embed terminal-view in a host surface
- **WHEN** a host page instantiates `terminal-view` with a valid terminal transport target
- **THEN** the component renders the terminal surface and manages its own renderer lifecycle
- **THEN** the host does not need direct access to WebUI-specific terminal internals

### Requirement: Terminal-view SHALL consume websocket PTY transport
The component SHALL connect to the terminal-system websocket PTY transport contract and use that stream as its terminal data source.

#### Scenario: Connect terminal-view to a running terminal
- **WHEN** the component is given a websocket PTY endpoint for a running terminal
- **THEN** it opens the websocket connection and renders incoming PTY output
- **THEN** it surfaces connection loss or terminal shutdown through a stable component state

### Requirement: Terminal-view SHALL preserve stable live rendering
The terminal renderer SHALL preserve ANSI rendering fidelity and stable fit-driven resizing while live transport is active.

#### Scenario: Live transport does not jitter under fallback updates
- **WHEN** live websocket transport is connected and fallback snapshots continue to update
- **THEN** the renderer does not reset backwards or visibly jitter
- **THEN** fallback hydration only applies when live transport is unavailable or behind

### Requirement: Terminal-view SHALL support renderer-engine selection and terminal titles
The integrated terminal surface SHALL expose a formal renderer-engine choice and SHALL surface terminal title/status data through the same shared controller model instead of keeping those concerns as host-local ad hoc state.

#### Scenario: Renderer engine changes without changing terminal identity
- **WHEN** the host switches between supported renderer engines for the same terminal session
- **THEN** the terminal view reuses the same terminal identity and controller state
- **THEN** the renderer change does not fabricate a second terminal session

#### Scenario: Shared controller publishes display title
- **WHEN** the terminal title changes because the foreground process changes
- **THEN** the terminal view reflects the updated display title from the shared controller state
- **THEN** host surfaces can label tabs without inventing a second title source
