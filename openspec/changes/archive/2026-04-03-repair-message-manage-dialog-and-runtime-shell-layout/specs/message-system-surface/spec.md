## MODIFIED Requirements

### Requirement: Message-system SHALL present rooms as a standalone app surface
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

#### Scenario: Room administration opens in a dialog-sidebar management shell
- **WHEN** the operator needs room users, grants, or membership controls
- **THEN** the route opens a dedicated management dialog with a left management rail and a right detail stage
- **THEN** the dialog organizes `Overview`, `Users`, and `Access` as section-level destinations without hiding the main transcript workflow
- **THEN** each stretchable detail section uses one explicit `ScrollView` owner instead of ad hoc overflow behavior
