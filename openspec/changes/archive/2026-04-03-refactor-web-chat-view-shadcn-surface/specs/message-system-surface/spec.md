## MODIFIED Requirements

### Requirement: Message-system SHALL present rooms as a standalone product surface
The WebUI SHALL expose a dedicated message-system route that lists global rooms, renders one selected room transcript through the shared chat surface, and keeps the room transcript/composer workflow as the primary operator task. The selected room view SHALL support explicit viewer selection, while room membership, metadata, and access administration move into a dedicated management surface instead of a permanently expanded inline rail.

#### Scenario: Room catalog navigation
- **WHEN** the operator opens the message-system route
- **THEN** they can browse the global room catalog and select a room without first selecting a workspace or session

#### Scenario: Chat-first room transcript layout
- **WHEN** a room is selected
- **THEN** the route shows the transcript pane and composer as the primary surface for that room
- **THEN** the transcript pane is rendered through the shared chat component rather than a route-local one-off renderer

#### Scenario: Explicit viewer perspective
- **WHEN** the operator changes the selected room viewer
- **THEN** the transcript rerenders from that viewer's perspective instead of guessing from message labels or the current route owner
- **THEN** the selected viewer does not change which actor is configured in the `Send as` control unless the operator changes it explicitly

#### Scenario: Room administration opens in a management surface
- **WHEN** the operator needs room users, grants, or membership controls
- **THEN** the route opens a dedicated management surface instead of keeping those controls permanently expanded beside the transcript
- **THEN** the management surface organizes room overview, users, and access actions without hiding the main chat workflow

## ADDED Requirements

### Requirement: Message-system route SHALL place secondary room controls responsively
The message-system route SHALL treat the transcript as the primary center surface and place navigation, management, and secondary facts into responsive containers such as left-side room lists, dialog sidebars, tabs, or compact sheets according to available space.

#### Scenario: Compact viewport preserves the transcript stage
- **WHEN** the operator uses the message-system route on a narrow viewport
- **THEN** the room list and room management controls are available through compact navigation or dialog surfaces
- **THEN** the transcript and composer remain the default visible stage

#### Scenario: Desktop viewport reveals richer secondary context
- **WHEN** the operator uses the message-system route on a desktop-sized viewport
- **THEN** the room catalog may remain visible beside the selected transcript
- **THEN** secondary room controls can expand without demoting the transcript from the primary task surface
