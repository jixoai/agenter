## MODIFIED Requirements

### Requirement: Message-system SHALL present rooms as a standalone product surface

The WebUI SHALL expose a dedicated message-system route that lists global rooms, renders one selected room transcript through the shared chat surface, and keeps the room transcript/composer workflow as the primary operator task. The route shell and room-management dialogs SHALL use the shared scaffold-family primitives so the transcript, management rail, and dialog detail stage no longer repeat their own stretch-layout contracts. The selected room view SHALL support explicit viewer selection, while room membership, metadata, and access administration move into a dedicated management surface instead of a permanently expanded inline rail. When Studio embeds the shared chat surface, Studio SHALL preserve the shared component as the owner of transcript row geometry; Studio MAY tune public composer parts for density, but it SHALL NOT carry route-local patches that are required only because shared package internals depend on host utility CSS.

#### Scenario: Chat-first room transcript layout
- **WHEN** a room is selected
- **THEN** the route shows the transcript pane and composer as the primary surface for that room
- **THEN** the transcript pane is rendered through the shared chat component rather than a route-local one-off renderer

#### Scenario: Embedded shared chat keeps bounded row geometry
- **WHEN** Studio renders a selected room through `WebChatViewHost`
- **THEN** Studio does not need to add route-local sizing rules for shared transcript avatars or images
- **AND** transcript avatars, message bubbles, row actions, and the composer stay visually bounded inside the room body
- **AND** the message stream remains readable on desktop and iPhone 14-sized viewports

#### Scenario: Dense room transcript avoids decorative slack
- **WHEN** the operator reads an active room transcript on desktop or mobile
- **THEN** transcript rows use compact vertical spacing and do not burn height on decorative top/bottom padding
- **THEN** message bubbles keep only the minimum radius, border, and shadow needed to distinguish ownership and tone
- **THEN** the transcript viewport and footer transition keep the message stream dominant instead of creating large dead zones

#### Scenario: Room body switches between chat and assets without extra chrome inside content
- **WHEN** the operator toggles `chat` or `assets`
- **THEN** `page_content` renders exactly one room body mode at a time
- **THEN** `chat` shows the shared transcript/composer surface
- **THEN** `assets` shows the room-owned asset list
- **THEN** the room body does not add a second room header or toolbar inside `page_content`
