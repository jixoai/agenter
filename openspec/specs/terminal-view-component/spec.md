## Purpose

Define the standalone terminal-view WebComponent contract and its shared controller semantics.
## Requirements

### Requirement: The system SHALL provide a standalone terminal-view WebComponent

The system SHALL provide a standalone `terminal-view` WebComponent implemented with a shared terminal controller contract, and renderer hosts SHALL be able to embed it as a pure terminal viewport without depending on WebUI-local terminal internals.

#### Scenario: Embed terminal-view in a host surface
- **WHEN** a host page instantiates `terminal-view` with a valid terminal transport target
- **THEN** the component renders the terminal viewport and manages its own renderer lifecycle
- **THEN** the host does not need direct access to WebUI-specific terminal internals

### Requirement: Terminal-view SHALL consume websocket PTY transport

The component SHALL connect to the terminal-system websocket PTY transport contract and use that stream as its terminal data source. It SHALL also accept durable snapshot hydration from the host so the surface remains renderable while the live websocket is connecting or recovering.

#### Scenario: Connect terminal-view to a running terminal
- **WHEN** the component is given a websocket PTY endpoint for a running terminal
- **THEN** it opens the websocket connection and renders incoming PTY output
- **THEN** it surfaces connection loss or terminal shutdown through a stable component state

#### Scenario: Snapshot hydrates before live transport is ready
- **WHEN** the host passes a durable terminal snapshot while live transport is still connecting
- **THEN** the component renders the snapshot immediately
- **THEN** live PTY output takes over without clearing the already rendered viewport

### Requirement: Terminal-view SHALL preserve stable live rendering

The terminal renderer SHALL preserve ANSI rendering fidelity and stable fit-driven resizing while live transport is active. Once live transport has hydrated the viewport, redundant same-geometry fallback snapshots SHALL NOT trigger another reactive rehydration cycle.

#### Scenario: Live transport does not jitter under fallback updates
- **WHEN** live websocket transport is connected and fallback snapshots continue to update
- **THEN** the renderer does not reset backwards or visibly jitter
- **THEN** fallback hydration only applies when live transport is unavailable or behind

#### Scenario: Redundant live snapshots do not retrigger fallback hydration

- **WHEN** live websocket transport is already connected and a new snapshot arrives with the same terminal geometry
- **THEN** the component does not reset or rehydrate the viewport from that redundant snapshot
- **AND** live output remains the primary render source

#### Scenario: Geometry change still allows fallback rehydration

- **WHEN** a new snapshot arrives with a changed terminal geometry
- **THEN** the component may rehydrate from that snapshot to realign the viewport
- **AND** the live transport stays connected through that recovery

### Requirement: Terminal-view SHALL support terminal-local presentation controls

The integrated terminal viewport SHALL expose terminal-local presentation controls including `fit` and `cover`, while leaving non-terminal product chrome to the host.

#### Scenario: Switch between fit and cover modes
- **WHEN** the host toggles between `fit` and `cover`
- **THEN** the terminal viewport updates its presentation mode
- **THEN** live transport remains connected and terminal content stays readable

### Requirement: Terminal-view SHALL behave as a viewport primitive

The standalone `terminal-view` component SHALL own terminal renderer lifecycle, snapshot hydration, live transport updates, and viewport sizing only. Product-level chrome such as titlebars, metadata footers, and decorative backgrounds MUST remain in the host surface.

#### Scenario: Host owns product chrome
- **WHEN** a host embeds `terminal-view`
- **THEN** the component renders the terminal viewport without product-level title or footer chrome
- **THEN** the host remains responsible for surrounding shell visuals and metadata placement
