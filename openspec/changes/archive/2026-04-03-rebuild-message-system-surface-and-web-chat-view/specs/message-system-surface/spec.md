## MODIFIED Requirements

### Requirement: Message-system SHALL present rooms as a standalone product surface
The WebUI SHALL expose a dedicated message-system route that lists global rooms, renders one selected room transcript through the shared chat surface, and shows room users/access controls without depending on workspace or session ownership.

#### Scenario: Room catalog navigation
- **WHEN** the operator opens the message-system route
- **THEN** they can browse the global room catalog and select a room without first selecting a workspace or session

#### Scenario: Room transcript layout
- **WHEN** a room is selected
- **THEN** the route shows the transcript pane, user/access pane, and composer for that room in one coordinated surface
- **THEN** the transcript pane is rendered through the shared chat component rather than a route-local one-off renderer

### Requirement: Message-system route SHALL reflect room changes live
The message-system route SHALL react to room catalog updates, new messages, read-state changes, grant changes, and seat focus changes without requiring manual refresh or periodic polling to reveal those facts.

#### Scenario: Sent room message appears without refresh
- **WHEN** the operator or another authorized seat sends a room message
- **THEN** the selected room transcript updates in place without a page refresh
- **THEN** the room list ordering and preview facts update from the same live event stream

#### Scenario: Room access state changes propagate live
- **WHEN** a room grant, revoke, read-state, or seat focus update occurs
- **THEN** the user/access sidebar refreshes those facts in place
- **THEN** the `Send as` options and read progress indicators stay consistent with the latest room truth
