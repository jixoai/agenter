## MODIFIED Requirements

### Requirement: Web chat view SHALL connect to one chat channel over websocket
The web chat view SHALL build its runtime state from one room transport websocket plus reverse-time history paging. The shared component SHALL be shipped as a framework-agnostic custom element with a Svelte host wrapper so multiple WebUI clients can reuse the same room transport contract.

#### Scenario: Connect and hydrate a room
- **WHEN** the component receives an authorized room transport URL
- **THEN** it renders the initial room snapshot
- **THEN** it can load older room history without replacing newer messages

#### Scenario: Empty resolved room snapshot does not look like a hanging transport
- **WHEN** the host has already resolved the room snapshot and that snapshot contains zero messages
- **THEN** the transcript stops rendering the initial loading shell
- **THEN** the empty-state copy is shown until new messages arrive or the websocket pushes a later snapshot
