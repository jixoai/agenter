## MODIFIED Requirements

### Requirement: Message-system SHALL present rooms as a standalone product surface
The WebUI SHALL expose a dedicated message-system route that lists global rooms, renders one selected room transcript through the shared chat surface, and keeps chat as the primary task surface. The selected room view SHALL support explicit viewer selection, while room membership and administration move into a dedicated management dialog instead of a permanently expanded inline rail.

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

#### Scenario: Room administration opens in a management dialog
- **WHEN** the operator needs room users, grants, or membership controls
- **THEN** the route opens a dedicated room-management dialog instead of keeping those controls permanently expanded beside the transcript
- **THEN** the dialog organizes user and access actions without hiding the main chat workflow

## ADDED Requirements

### Requirement: Message-system route SHALL derive room users and viewer choices from canonical actor truth

The room viewer selector, room management dialog, send-as options, and read-progress details SHALL resolve actors from canonical auth/profile or session actor identity instead of local label-only guesses.

#### Scenario: Viewer selector lists canonical actors

- **WHEN** the operator opens the room viewer selector
- **THEN** each option is keyed by canonical actor identity
- **THEN** duplicate visible labels remain selectable as separate actors
