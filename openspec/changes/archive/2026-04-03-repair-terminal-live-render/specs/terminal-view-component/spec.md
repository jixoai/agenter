## MODIFIED Requirements

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
