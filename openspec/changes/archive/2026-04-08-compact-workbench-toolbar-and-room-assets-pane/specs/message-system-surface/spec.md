## MODIFIED Requirements

### Requirement: Message-system SHALL present rooms as a standalone product surface

The WebUI SHALL expose a dedicated message-system route that lists global rooms, renders one selected room through the shared workbench chrome, and keeps the selected room body focused on one primary content mode at a time. The Room toolbar SHALL present the current viewer identity, room-local actions, and body-mode chips inside the fixed shared toolbar slot, while room administration remains in a dedicated management surface.

#### Scenario: Dense room toolbar shows current viewer identity and room actions

- **WHEN** a room is selected
- **THEN** the fixed room toolbar shows the current `View as` user avatar and label as the primary identity
- **THEN** the toolbar exposes `search-messages`, `add-user`, and `manage` actions in that order
- **THEN** the toolbar exposes `chat` and `assets` chips as room-local body mode switches

#### Scenario: Room body switches between chat and assets without extra chrome inside content

- **WHEN** the operator toggles `chat` or `assets`
- **THEN** `page_content` renders exactly one room body mode at a time
- **THEN** `chat` shows the shared transcript/composer surface
- **THEN** `assets` shows the room-owned asset list
- **THEN** the room body does not add a second room header or toolbar inside `page_content`

### Requirement: Message-system route SHALL expose a rich shared room transcript surface

The selected room transcript SHALL present canonical avatars, improved message bubbles, attachment rendering, local hover/context actions, and local transcript search while keeping room orchestration and management outside the transcript renderer.

#### Scenario: Local transcript search navigates loaded room messages

- **WHEN** the operator invokes `search-messages` from the room toolbar
- **THEN** the room can search within the currently loaded transcript messages
- **THEN** search navigation uses transcript row anchors instead of requiring a second route-local message renderer
