## MODIFIED Requirements

### Requirement: Web chat view SHALL connect to one chat channel over websocket
The web chat view SHALL build its runtime state from one room transport websocket plus reverse-time history paging. The shared component SHALL be shipped as a framework-agnostic custom element with a Svelte host wrapper so multiple WebUI clients can reuse the same room transport contract. The component SHALL accept explicit viewer actor context instead of inferring viewer identity from room metadata or message labels.

#### Scenario: Connect and hydrate a room
- **WHEN** the component receives an authorized room transport URL
- **THEN** it renders the initial room snapshot
- **THEN** it can load older room history without replacing newer messages

#### Scenario: Empty resolved room snapshot does not look like a hanging transport
- **WHEN** the host has already resolved the room snapshot and that snapshot contains zero messages
- **THEN** the transcript stops rendering the initial loading shell
- **THEN** the empty-state copy is shown until new messages arrive or the websocket pushes a later snapshot

#### Scenario: Shared custom element is reusable
- **WHEN** the operator WebUI mounts the shared chat view or another frontend mounts the exported custom element
- **THEN** both consumers use the same room transport contract and transcript behavior
- **THEN** the package does not require React-specific runtime dependencies to render the shared room experience

#### Scenario: Viewer perspective uses canonical actor identity
- **WHEN** the host passes an explicit viewer actor id to the shared chat view
- **THEN** the component aligns "mine vs others" from that actor identity
- **THEN** it does not guess viewer ownership from duplicate labels or unrelated room metadata

## ADDED Requirements

### Requirement: Web chat view SHALL own transcript scrolling through ScrollView

The shared chat component SHALL delegate transcript scrolling to the shared `ScrollView` contract instead of feature-local raw overflow ownership, even when delivered as a reusable custom element.

#### Scenario: Transcript uses shared scroll owner

- **WHEN** the chat transcript exceeds the visible height
- **THEN** the component scrolls through the shared `ScrollView` contract
- **THEN** host surfaces do not need to wrap the transcript in a second competing scroll owner
