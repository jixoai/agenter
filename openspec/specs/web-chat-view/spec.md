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

### Requirement: Viewer changes SHALL replay the current visibility fact once
When the host changes `viewerActorId`, the shared chat view SHALL treat that change as a new reader identity for read-ack projection. If the component already knows the current latest visible durable message, it SHALL re-emit that same visibility fact exactly once for the new viewer and SHALL stay idle afterwards until visibility advances again.

#### Scenario: Viewer switch replays the current latest visible message once
- **WHEN** the host changes `viewerActorId`
- **AND** the transcript still shows the same latest visible durable message
- **THEN** the component emits one visibility callback for that message under the new viewer identity
- **THEN** it does not keep replaying the same message again while the viewport stays unchanged

### Requirement: Web chat view SHALL present a conversation-first shared surface
The shared room component SHALL render one durable conversation surface with transcript, notices, and composer organized as explicit primary regions. The transcript SHALL remain the dominant viewport, while metadata or helper details SHALL collapse into secondary regions without forcing hosts to duplicate the same controls around the component. The transcript/composer shell SHALL compose shared Svelte structural primitives from `@agenter/svelte-components` instead of maintaining a private layout law inside the package.

#### Scenario: Transcript remains primary on compact viewports
- **WHEN** the chat component is rendered in a narrow container
- **THEN** the transcript and composer remain immediately usable without a permanently expanded side rail
- **THEN** secondary facts or helper content collapse into secondary affordances instead of shrinking the message viewport first

#### Scenario: Desktop host can reveal richer context without replacing the shared surface
- **WHEN** the chat component is rendered in a wider operator surface
- **THEN** the host can place surrounding metadata or management controls beside the component
- **THEN** the shared component still owns the transcript/composer shell instead of requiring a second route-local transcript renderer

#### Scenario: Chat shell reuses shared Svelte layout law
- **WHEN** the shared chat package renders its transcript shell
- **THEN** it uses `Scaffold` and `ScrollView` from `@agenter/svelte-components`
- **THEN** chat-specific visuals and transport behavior remain local to `web-chat-view`
- **THEN** the package still avoids any dependency on `@agenter/webui`

### Requirement: Web chat view SHALL expose a rich shared composer surface
The shared chat package SHALL render a responsive CodeMirror-based composer surface with attachment previews, action/status toolbars, help hints, and host-driven send orchestration instead of a minimal textarea-only input.

#### Scenario: Composer shows rich pending attachment state
- **WHEN** the host adds pending files, images, or screenshots to the shared composer
- **THEN** the chat package renders visible pending attachment previews before send
- **THEN** the same composer surface still owns Enter/Shift+Enter and toolbar interaction semantics

#### Scenario: Composer toolbar stays responsive
- **WHEN** the chat package is rendered in a compact or desktop container
- **THEN** the composer toolbar adapts its controls without hiding the primary send action
- **THEN** help/status hints remain available through the same shared surface

#### Scenario: Host-managed send keeps the host hint text
- **WHEN** the host supplies its own send handler for a room/chat surface
- **THEN** the shared composer renders the host-provided hint text as-is
- **THEN** transport-only copy such as `Waiting for channel transport` does not override that host-managed hint

### Requirement: Web chat view SHALL render canonical avatar and message action affordances
The shared chat package SHALL support host-provided canonical avatar/icon resolution for room and actor identity, and it SHALL expose local hover/context message action affordances from the shared message row implementation.

#### Scenario: Host resolves canonical avatars
- **WHEN** the host provides canonical icon or avatar URLs for the channel or participants
- **THEN** the shared message rows render those canonical avatars in transcript presentation
- **THEN** the chat package does not guess durable identity solely from visible labels

#### Scenario: Shared row exposes local message actions
- **WHEN** the operator hovers or context-clicks a transcript row
- **THEN** the row reveals the shared local message action affordance
- **THEN** host routes can extend those actions without replacing the shared row renderer

#### Scenario: Inline-end read indicator discloses message-local reader detail
- **WHEN** a transcript row has frozen `read` and `unread` actor projections
- **THEN** the inline-end read indicator stays compact by default
- **THEN** opening that indicator reveals the canonical `Read` and `Unread` actor lists for that specific message without adding room-header aggregate chrome

#### Scenario: Message-local read disclosure keeps a readable compact width
- **WHEN** the operator opens a message-local read disclosure on desktop or compact viewport
- **THEN** the disclosure renders as a readable card instead of collapsing to content width
- **THEN** compact layouts may collapse to one column, but they still keep the disclosure fully legible within the viewport

#### Scenario: Viewer-owned layout keeps the read trigger on the bubble edge
- **WHEN** the transcript renders a viewer-owned room message with read-progress metadata
- **THEN** the read-progress trigger stays adjacent to that bubble's inline-end edge
- **THEN** reversing viewer-owned layout does not move the trigger to the opposite side of the message

### Requirement: Web chat view SHALL own transcript scrolling through ScrollView
The shared chat component SHALL delegate transcript scrolling to the shared `ScrollView` contract instead of feature-local raw overflow ownership, even when delivered as a reusable custom element. Inside host-provided `page_content`, the chat stage SHALL keep `messages_list` as the only scroll owner and `message_toolbar` pinned to the stage bottom.

#### Scenario: Transcript uses shared scroll owner
- **WHEN** the chat transcript exceeds the visible height
- **THEN** the component scrolls through the shared `ScrollView` contract
- **THEN** host surfaces do not need to wrap the transcript in a second competing scroll owner

#### Scenario: Composer stays pinned while transcript scrolls
- **WHEN** the transcript grows beyond the available room stage height
- **THEN** only `messages_list` scrolls
- **THEN** the composer stays pinned at the bottom of the shared chat stage instead of entering a second page-level scroll region

### Requirement: Web chat view SHALL support large chat histories
The web chat view SHALL use virtualized rendering and reverse-time pagination for long-lived room conversations.

#### Scenario: Years of room history remain navigable
- **WHEN** the room has a long history
- **THEN** the viewport only renders the visible message window
- **THEN** older history is loaded by time-based reverse pagination
