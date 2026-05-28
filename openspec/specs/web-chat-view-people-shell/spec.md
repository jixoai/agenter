# web-chat-view-people-shell Specification

## Purpose
Define the host-owned people/source shell law for the `web-chat-view` review example after `message-system` gained first-class contacts, contact requests, source subscriptions, and direct-room linkage.
## Requirements
### Requirement: Example app SHALL expose a three-destination chat shell
The `web-chat-view` example SHALL present message-system as a mobile-first Framework7 app with `Messages`, `Contacts`, and `Me` as primary destinations. Room chat SHALL be a child surface of Messages rather than the whole app.

#### Scenario: Mobile shell opens with WeChat-style destinations
- **WHEN** the operator opens the example on an iPhone-class viewport
- **THEN** the bottom tabbar exposes `Messages`, `Contacts`, and `Me`
- **THEN** each destination owns a distinct Framework7 page surface
- **THEN** the room transcript is reached from Messages instead of being the only application screen

#### Scenario: Child pages suspend primary tabbar
- **WHEN** the operator opens room chat, contact detail, source management, or source detail
- **THEN** the primary bottom tabbar is hidden
- **THEN** the child page returns through the Framework7 Navbar back affordance
- **THEN** global navigation returns only after the operator leaves the child surface

#### Scenario: Desktop derives from the same destination model
- **WHEN** the operator opens the example on a wide viewport
- **THEN** the app may use split-view or master-detail layout
- **THEN** the visible navigation still maps to `Messages`, `Contacts`, and `Me`
- **THEN** desktop does not introduce a separate admin-dashboard IA for the same facts

#### Scenario: Root destinations stay list-driven and quiet
- **WHEN** the operator opens `Messages`, `Contacts`, or `Me` on mobile
- **THEN** the first viewport is dominated by grouped list content, search, summary rows, and primary navigation affordances
- **THEN** the page does not spend the first viewport on isolated explainer blocks, oversized spacer rhythm, or demo-style shell narration

#### Scenario: Wide split view keeps explicit app/master/detail responsibility
- **WHEN** the operator opens the example on a wide viewport
- **THEN** the left rail remains app-level navigation
- **THEN** the middle rail remains destination-owned master content
- **THEN** the right rail remains detail or room content
- **THEN** the shell does not visually flatten those three responsibilities into one custom white-pane workspace

### Requirement: Messages destination SHALL separate conversation list from room chat
The Messages destination SHALL list conversations/direct rooms first and open a room chat child page for transcript/composer work. Global profile, source management, and contact directory concerns SHALL not remain crowded into the room chat first viewport.

#### Scenario: Conversation list leads to room chat
- **WHEN** the operator opens the Messages destination
- **THEN** the page shows room or direct conversation rows with unread and latest-message projections
- **THEN** selecting a conversation opens a room chat page using the shared `@agenter/web-chat-view` transcript/composer
- **THEN** the message list does not duplicate the transcript renderer

#### Scenario: Room chat delegates global actions out
- **WHEN** the operator is inside a room chat page
- **THEN** the room page keeps room actions, transcript, composer, resources, and message-local actions
- **THEN** source management, current actor profile, and global review setup are reached through child pages or the Me destination

### Requirement: Contacts destination SHALL consume source-scoped contact truth
The Contacts destination SHALL render durable contacts from message-system contact records, preserving source-scoped identity and request lifecycle facts instead of inferring a directory only from room participant labels.

#### Scenario: Contact list groups without merging source identities
- **WHEN** two contacts share the same visible label but come from different `sourceId` values
- **THEN** the contact list may group or sort them for readability
- **THEN** each contact row still keeps distinct `ownerActorId + sourceId + remoteActorId` identity
- **THEN** the UI does not merge them into one durable person

#### Scenario: Contact requests stay outside transcript history
- **WHEN** the operator opens the Contacts destination
- **THEN** pending inbound and outbound contact requests are visible as contact-request facts
- **THEN** those requests do not render as room transcript messages
- **THEN** accept, reject, revoke, expired, and superseded states are represented as contact-request lifecycle state

### Requirement: Contact detail SHALL own relationship actions
Contact detail SHALL show remote identity, source provenance, request state, direct-room linkage, and relationship actions. Starting a chat from contact detail SHALL use explicit direct-room linkage or explicit first-chat bootstrap.

#### Scenario: Contact detail exposes source provenance
- **WHEN** the operator opens a contact detail page
- **THEN** the page shows label, subtitle, avatar, source label or id, remote actor id, and direct-room status
- **THEN** source provenance is visible enough to distinguish same-label contacts from different sources

#### Scenario: Start chat is explicit
- **WHEN** the operator activates `Start Chat` from contact detail
- **THEN** the app opens an existing `localDirectChatId` when one exists
- **THEN** otherwise it asks for or creates an explicit first-chat/direct-room bootstrap flow
- **THEN** accepting a contact alone is not treated as implicit room creation

### Requirement: Source management SHALL be first-class under Me
The Me destination SHALL own source management for actor-private source subscriptions. Source management SHALL include source list, source add/edit/detail, callback/source endpoint facts, and clear links to contact discovery or request delivery.

#### Scenario: Me exposes source management
- **WHEN** the operator opens the Me destination
- **THEN** there is a first-class `Sources` entry
- **THEN** the entry opens a source management child page rather than a room setting

#### Scenario: Source detail preserves actor-private scope
- **WHEN** the operator opens a source detail page
- **THEN** the page shows source id, label, endpoint, callback source facts, and credential presence without exposing raw secrets as primary visible text
- **THEN** another actor's source subscriptions are not shown unless explicitly provided by the host as that actor's state

### Requirement: People shell blueprints SHALL guide implementation
The change SHALL include blueprint artifacts for the redesigned app IA before implementation. These artifacts are UX references; Framework7 atoms and OpenSpec remain the source of implementation law.

#### Scenario: Blueprint set covers major mobile surfaces
- **WHEN** the design phase is complete
- **THEN** blueprint image artifacts exist for shell map, Messages/chat flow, Contacts/contact detail, and Me/source management
- **THEN** those artifacts are grouped under `output/imagegen/flutter-chat-view-plan-mockups/iteration-11/`
- **THEN** the OpenSpec change references the same surface set in implementation tasks

