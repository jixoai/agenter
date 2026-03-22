## Purpose

Define the standalone terminal-view WebComponent contract.

## Requirements

### Requirement: The system SHALL provide a standalone terminal-view WebComponent
The system SHALL provide a standalone `terminal-view` WebComponent implemented with `lit.js`, and renderer hosts SHALL be able to embed it without depending on WebUI-local terminal internals.

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

### Requirement: Terminal-view SHALL support terminal-local presentation controls
The integrated terminal surface SHALL expose terminal-local presentation controls including `fit` and `cover`.

#### Scenario: Switch between fit and cover modes
- **WHEN** the user toggles between `fit` and `cover`
- **THEN** the terminal surface updates its presentation mode
- **THEN** live transport remains connected and terminal content stays readable
