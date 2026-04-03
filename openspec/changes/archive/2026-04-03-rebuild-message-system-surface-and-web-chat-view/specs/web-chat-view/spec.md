## MODIFIED Requirements

### Requirement: Web chat view SHALL connect to one chat channel over websocket
The web chat view SHALL build its runtime state from one room transport websocket plus reverse-time history paging. The shared component SHALL be shipped as a framework-agnostic custom element with a Svelte host wrapper so multiple WebUI clients can reuse the same room transport contract.

#### Scenario: Connect and hydrate a room
- **WHEN** the component receives an authorized room transport URL
- **THEN** it renders the initial room snapshot
- **THEN** it can load older room history without replacing newer messages

#### Scenario: Shared custom element is reusable
- **WHEN** the operator WebUI mounts the shared chat view or another frontend mounts the exported custom element
- **THEN** both consumers use the same room transport contract and transcript behavior
- **THEN** the package does not require React-specific runtime dependencies to render the shared room experience

### Requirement: Web chat view SHALL support large chat histories
The web chat view SHALL use virtualized rendering and reverse-time pagination for long-lived room conversations.

#### Scenario: Years of room history remain navigable
- **WHEN** the room has a long history
- **THEN** the viewport only renders the visible message window
- **THEN** older history is loaded by time-based reverse pagination
