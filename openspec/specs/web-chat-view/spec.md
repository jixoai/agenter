# web-chat-view Specification

## Purpose
Define the framework-agnostic room-backed Web chat transport contract, including websocket hydration, a reusable custom-element delivery surface, and reverse-time paging for long histories.
## Requirements
### Requirement: Web chat view SHALL connect to one chat channel over websocket
The web chat view SHALL build its runtime state from one room transport websocket plus reverse-time history paging. The shared component SHALL be shipped as a framework-agnostic custom element with a Svelte host wrapper so multiple WebUI clients can reuse the same room transport contract. The component SHALL accept explicit viewer actor context instead of inferring viewer identity from room metadata or message labels, and it SHALL expose that transport state through one conversation-first surface instead of requiring host routes to rebuild transcript chrome around it.

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

### Requirement: Web chat view SHALL present a conversation-first shared surface
The shared room component SHALL render one durable conversation surface with transcript, notices, and composer organized as explicit primary regions. The transcript SHALL remain the dominant viewport, while metadata or helper details SHALL collapse into secondary regions without forcing hosts to duplicate the same controls around the component.

#### Scenario: Transcript remains primary on compact viewports
- **WHEN** the chat component is rendered in a narrow container
- **THEN** the transcript and composer remain immediately usable without a permanently expanded side rail
- **THEN** secondary facts or helper content collapse into secondary affordances instead of shrinking the message viewport first

#### Scenario: Desktop host can reveal richer context without replacing the shared surface
- **WHEN** the chat component is rendered in a wider operator surface
- **THEN** the host can place surrounding metadata or management controls beside the component
- **THEN** the shared component still owns the transcript/composer shell instead of requiring a second route-local transcript renderer

### Requirement: Web chat view SHALL own transcript scrolling through ScrollView
The shared chat component SHALL delegate transcript scrolling to the shared `ScrollView` contract instead of feature-local raw overflow ownership, even when delivered as a reusable custom element.

#### Scenario: Transcript uses shared scroll owner
- **WHEN** the chat transcript exceeds the visible height
- **THEN** the component scrolls through the shared `ScrollView` contract
- **THEN** host surfaces do not need to wrap the transcript in a second competing scroll owner

### Requirement: Web chat view SHALL support large chat histories
The web chat view SHALL use virtualized rendering and reverse-time pagination for long-lived room conversations.

#### Scenario: Years of room history remain navigable
- **WHEN** the room has a long history
- **THEN** the viewport only renders the visible message window
- **THEN** older history is loaded by time-based reverse pagination
