## ADDED Requirements

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
